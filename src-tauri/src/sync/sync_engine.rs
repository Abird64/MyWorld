use chrono::{DateTime, Utc};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use tauri::Manager;

use super::change_tracking::{export_changes, Change, ensure_site_id, get_current_db_version};
use super::lan_client::LanClient;
use super::r2_client::R2Client;
use super::remote_storage::{RemoteFile, RemoteStorage};
use super::webdav_client::WebDavClient;
use crate::db::connection::{AppDataState, DbState};
use crate::db::repositories::setting_repo;

/// 需要同步的表名白名单（仅包含 migrations.rs 中 CREATE TABLE 的表）
const SYNC_TABLES: &[&str] = &[
    "tasks", "skills", "task_skills", "skill_events",
    "schedules",
    "contacts", "diary_contacts", "task_contacts", "contact_methods",
    "journals",
    "habits", "habit_records",
    "settings",
    "ai_conversations", "ai_messages", "ai_favorites", "ai_memories",
    "calendars",
];

/// 快照中的一行数据
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SnapshotRow {
    pk: String,
    data: HashMap<String, serde_json::Value>,
    updated_at: String,
    deleted_at: Option<String>,
}

/// 快照文件格式
#[derive(Debug, Serialize, Deserialize)]
struct Snapshot {
    site_id: String,
    timestamp: String,
    tables: HashMap<String, Vec<SnapshotRow>>,
}

/// 同步结果
#[derive(Debug, Clone, Serialize)]
pub struct SyncResult {
    pub success: bool,
    pub db_action: String,
    pub journals_uploaded: u32,
    pub journals_downloaded: u32,
    pub errors: Vec<String>,
    pub message: String,
    pub bytes_uploaded: u64,
    pub bytes_downloaded: u64,
}

/// 同步状态（Tauri 管理的状态）
pub struct SyncState {
    pub in_progress: Mutex<bool>,
    /// 同步开始时间，用于检测卡死
    pub started_at: Mutex<Option<std::time::Instant>>,
    /// 限流冷却：在此时间之前跳过同步
    pub rate_limited_until: Mutex<Option<std::time::Instant>>,
}

impl SyncState {
    pub fn new() -> Self {
        Self {
            in_progress: Mutex::new(false),
            started_at: Mutex::new(None),
            rate_limited_until: Mutex::new(None),
        }
    }

    /// 检查是否在限流冷却期内
    pub fn is_rate_limited(&self) -> bool {
        if let Ok(guard) = self.rate_limited_until.lock() {
            guard.map_or(false, |t| t.elapsed().is_zero())
        } else {
            false
        }
    }

    /// 设置限流冷却（5 分钟后才能再次同步）
    pub fn set_rate_limited(&self) {
        if let Ok(mut guard) = self.rate_limited_until.lock() {
            *guard = Some(std::time::Instant::now() + std::time::Duration::from_secs(300));
        }
    }

    /// 标记同步开始
    pub fn mark_started(&self) {
        if let Ok(mut guard) = self.in_progress.lock() {
            *guard = true;
        }
        if let Ok(mut guard) = self.started_at.lock() {
            *guard = Some(std::time::Instant::now());
        }
    }

    /// 标记同步结束
    pub fn mark_finished(&self) {
        if let Ok(mut guard) = self.in_progress.lock() {
            *guard = false;
        }
        if let Ok(mut guard) = self.started_at.lock() {
            *guard = None;
        }
    }

    /// 检查同步是否卡死（超过 5 分钟），如果是则重置状态
    pub fn check_and_reset_if_stale(&self) -> bool {
        let is_stale = if let Ok(guard) = self.started_at.lock() {
            guard.map_or(false, |t| t.elapsed().as_secs() > 300)
        } else {
            false
        };
        if is_stale {
            log::warn!("[SYNC] 检测到同步卡死（超过 5 分钟），自动重置");
            self.mark_finished();
            return true;
        }
        false
    }
}

/// 同步配置
struct SyncConfig {
    storage_type: String,  // "webdav"、"r2" 或 "lan"
    // WebDAV
    url: String,
    username: String,
    password: String,
    // R2
    r2_account_id: String,
    r2_access_key: String,
    r2_secret_key: String,
    r2_bucket: String,
    // LAN
    lan_peer_ip: String,
    lan_peer_port: u16,
    // 通用
    remote_path: String,
}

impl SyncResult {
    fn new() -> Self {
        Self {
            success: false,
            db_action: "none".to_string(),
            journals_uploaded: 0,
            journals_downloaded: 0,
            errors: Vec::new(),
            message: String::new(),
            bytes_uploaded: 0,
            bytes_downloaded: 0,
        }
    }

    pub fn error(msg: String) -> Self {
        Self {
            success: false,
            db_action: "error".to_string(),
            journals_uploaded: 0,
            journals_downloaded: 0,
            errors: vec![msg.clone()],
            message: msg,
            bytes_uploaded: 0,
            bytes_downloaded: 0,
        }
    }

    /// 检查是否有限流错误
    pub fn has_rate_limit_error(&self) -> bool {
        self.errors.iter().any(|e| e.contains("限流"))
    }
}

/// 从设置中读取同步配置
fn read_config(conn: &rusqlite::Connection) -> Result<SyncConfig, String> {
    let storage_type = setting_repo::get_setting(conn, "sync.storage_type")?
        .map(|s| s.value)
        .unwrap_or_else(|| "webdav".to_string());

    let url = setting_repo::get_setting(conn, "sync.url")?
        .map(|s| s.value)
        .unwrap_or_default();
    let username = setting_repo::get_setting(conn, "sync.username")?
        .map(|s| s.value)
        .unwrap_or_default();
    let password = setting_repo::get_setting(conn, "sync.password")?
        .map(|s| s.value)
        .unwrap_or_default();

    let r2_account_id = setting_repo::get_setting(conn, "sync.r2.account_id")?
        .map(|s| s.value)
        .unwrap_or_default();
    let r2_access_key = setting_repo::get_setting(conn, "sync.r2.access_key")?
        .map(|s| s.value)
        .unwrap_or_default();
    let r2_secret_key = setting_repo::get_setting(conn, "sync.r2.secret_key")?
        .map(|s| s.value)
        .unwrap_or_default();
    let r2_bucket = setting_repo::get_setting(conn, "sync.r2.bucket")?
        .map(|s| s.value)
        .unwrap_or_default();

    let lan_peer_ip = setting_repo::get_setting(conn, "sync.lan.peer_ip")?
        .map(|s| s.value)
        .unwrap_or_default();
    let lan_peer_port: u16 = setting_repo::get_setting(conn, "sync.lan.peer_port")?
        .map(|s| s.value.parse().unwrap_or(9821))
        .unwrap_or(9821);

    let remote_path = setting_repo::get_setting(conn, "sync.remote_path")?
        .map(|s| s.value)
        .unwrap_or_else(|| "/lantern/".to_string());

    Ok(SyncConfig {
        storage_type,
        url,
        username,
        password,
        r2_account_id,
        r2_access_key,
        r2_secret_key,
        r2_bucket,
        lan_peer_ip,
        lan_peer_port,
        remote_path,
    })
}

/// 运行完整同步
pub async fn run_full_sync(db_state: &DbState, app_data: &AppDataState) -> SyncResult {
    log::info!("[SYNC] ===== 开始同步 =====");
    let config = {
        let conn = match db_state.conn.lock() {
            Ok(c) => c,
            Err(e) => return SyncResult::error(format!("获取数据库锁失败: {}", e)),
        };
        // 确保本地设备有唯一 site_id
        ensure_site_id(&conn);
        match read_config(&conn) {
            Ok(c) => c,
            Err(e) => return SyncResult::error(e),
        }
    };

    let client: Box<dyn RemoteStorage> = match config.storage_type.as_str() {
        "r2" => {
            if config.r2_account_id.is_empty() || config.r2_access_key.is_empty()
                || config.r2_secret_key.is_empty() || config.r2_bucket.is_empty()
            {
                return SyncResult::error("R2 配置不完整，请填写 Account ID、Access Key、Secret Key 和 Bucket".to_string());
            }
            match R2Client::new(&config.r2_account_id, &config.r2_access_key, &config.r2_secret_key, &config.r2_bucket) {
                Ok(c) => Box::new(c),
                Err(e) => return SyncResult::error(e),
            }
        }
        "lan" => {
            if config.lan_peer_ip.is_empty() {
                return SyncResult::error("局域网同步未配置，请先选择对端设备".to_string());
            }
            let url = format!("http://{}:{}", config.lan_peer_ip, config.lan_peer_port);
            Box::new(LanClient::new(&url))
        }
        _ => {
            if config.url.is_empty() || config.username.is_empty() || config.password.is_empty() {
                return SyncResult::error("WebDAV 配置不完整，请填写服务器地址、用户名和密码".to_string());
            }
            match WebDavClient::new(&config.url, &config.username, &config.password) {
                Ok(c) => Box::new(c),
                Err(e) => return SyncResult::error(e),
            }
        }
    };

    let remote_path = config.remote_path.trim_end_matches('/');

    // 确保远端目录存在
    if let Err(e) = client.ensure_dir(remote_path).await {
        return SyncResult::error(format!("创建远端目录失败: {}", e));
    }
    if let Err(e) = client.ensure_dir(&format!("{}/journals", remote_path)).await {
        log::warn!("[SYNC] 创建 journals 目录失败: {}", e);
    }

    let mut result = SyncResult::new();
    let mut bytes_uploaded: u64 = 0;
    let mut bytes_downloaded: u64 = 0;

    // === 1. 快照同步数据库 ===
    let mut site_id_conflict = false;
    match sync_snapshot(&*client, db_state, remote_path, &config.storage_type).await {
        Ok((action, up, down, conflict)) => {
            result.db_action = action;
            bytes_uploaded += up;
            bytes_downloaded += down;
            site_id_conflict = conflict;
        }
        Err(e) => {
            result.errors.push(format!("快照同步失败: {}", e));
        }
    }

    // === 2. 同步日记文件 ===
    let journals_local = app_data.dir.join("journals");
    let journals_remote = format!("{}/journals", remote_path);

    // 只在本地有日记变更时才同步（避免大量 PROPFIND 请求触发坚果云限流）
    // 本地无变更时跳过 → 节省请求数；如需拉取远端新日记，等下次本地有变更时自动拉取
    let last_sync = {
        let conn = db_state.conn.lock();
        conn.ok().and_then(|c| {
            setting_repo::get_setting(&c, "sync.last_sync_time")
                .ok()
                .flatten()
                .map(|s| s.value)
        })
    };
    let should_sync_journals = match &last_sync {
        Some(t) => has_journal_changes_since(&journals_local, t),
        None => true, // 首次同步，必须检查
    };

    if should_sync_journals {
        log::info!("[SYNC] 检测到本地日记变更，开始同步日记...");
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        match sync_journals(&*client, &journals_local, &journals_remote).await {
        Ok((uploaded, downloaded, up_bytes, down_bytes, errs)) => {
            result.journals_uploaded = uploaded;
            result.journals_downloaded = downloaded;
            bytes_uploaded += up_bytes;
            bytes_downloaded += down_bytes;
            result.errors.extend(errs);
        }
        Err(e) => {
                result.errors.push(format!("日记同步失败: {}", e));
            }
        }
    } else {
        log::info!("[SYNC] 本地日记无变更，跳过日记同步（节省请求）");
    }

    // === 3. 记录同步时间（site_id 冲突时不更新，保留 epoch 以便下次全量导出） ===
    if result.errors.is_empty() && !site_id_conflict {
        let now = Utc::now().to_rfc3339();
        if let Ok(conn) = db_state.conn.lock() {
            let _ = setting_repo::set_setting(&conn, "sync.last_sync_time", &now);
        }
    }

    result.bytes_uploaded = bytes_uploaded;
    result.bytes_downloaded = bytes_downloaded;

    log::info!(
        "[SYNC] 结果: db_action={}, uploaded={}, downloaded={}, bytes_up={}, bytes_down={}, errors={:?}",
        result.db_action, result.journals_uploaded, result.journals_downloaded,
        bytes_uploaded, bytes_downloaded, result.errors
    );
    result.success = result.errors.is_empty();
    result.message = if result.errors.is_empty() {
        format!(
            "同步完成 — {}, 日记上传: {}, 下载: {}",
            result.db_action, result.journals_uploaded, result.journals_downloaded
        )
    } else {
        format!("同步完成但有错误: {}", result.errors.join("; "))
    };

    log::info!("[SYNC] ===== 同步结束: {} =====", if result.success { "成功" } else { "有错误" });
    result
}

/// 导出所有表的变更行（updated_at > since 或 deleted_at > since）
fn export_snapshot(conn: &rusqlite::Connection, site_id: &str, since: &str) -> Snapshot {
    let mut tables: HashMap<String, Vec<SnapshotRow>> = HashMap::new();

    for &table in SYNC_TABLES {
        let rows = export_table_changes(conn, table, since);
        if !rows.is_empty() {
            tables.insert(table.to_string(), rows);
        }
    }

    Snapshot {
        site_id: site_id.to_string(),
        timestamp: Utc::now().to_rfc3339(),
        tables,
    }
}

/// 导出单个表的变更行（出错时返回空而非中断整个同步）
fn export_table_changes(conn: &rusqlite::Connection, table: &str, since: &str) -> Vec<SnapshotRow> {
    let pk_col = if table == "settings" { "key" } else { "id" };

    let sql = format!(
        "SELECT * FROM \"{table}\" WHERE updated_at > ?1 OR (deleted_at IS NOT NULL AND deleted_at > ?1)"
    );

    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(e) => {
            log::warn!("[SYNC] 准备导出表 {table} 失败: {e}");
            return Vec::new();
        }
    };

    let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let pk_idx = match column_names.iter().position(|c| c == pk_col) {
        Some(i) => i,
        None => {
            log::warn!("[SYNC] 表 {table} 缺少主键列 {pk_col}");
            return Vec::new();
        }
    };
    let updated_at_idx = column_names.iter().position(|c| c == "updated_at");
    let deleted_at_idx = column_names.iter().position(|c| c == "deleted_at");

    let rows = match stmt.query_map(params![since], |row| {
        let pk: String = row.get(pk_idx)?;
        let updated_at = updated_at_idx
            .and_then(|i| row.get::<_, Option<String>>(i).ok().flatten())
            .unwrap_or_default();
        let deleted_at = deleted_at_idx
            .and_then(|i| row.get::<_, Option<String>>(i).ok().flatten());

        let mut data = HashMap::new();
        for (i, col_name) in column_names.iter().enumerate() {
            if col_name == pk_col || col_name == "deleted_at" {
                continue;
            }
            // 尝试读取为文本；如果不是文本类型则尝试整数
            let val: Option<serde_json::Value> = match row.get::<_, Option<String>>(i) {
                Ok(Some(s)) => Some(serde_json::Value::String(s)),
                Ok(None) => None,
                Err(_) => match row.get::<_, Option<i64>>(i) {
                    Ok(Some(n)) => Some(serde_json::Value::Number(n.into())),
                    _ => None,
                },
            };
            if let Some(v) = val {
                data.insert(col_name.clone(), v);
            }
        }

        Ok(SnapshotRow { pk, data, updated_at, deleted_at })
    }) {
        Ok(mapped) => mapped,
        Err(e) => {
            log::warn!("[SYNC] 查询表 {table} 变更失败: {e}");
            return Vec::new();
        }
    };

    let mut result: Vec<SnapshotRow> = rows.filter_map(|r| r.ok()).collect();

    // settings 表中过滤掉设备特定的 sync.* 配置，避免设备间互相覆盖
    if table == "settings" {
        result.retain(|row| !row.pk.starts_with("sync."));
    }

    result
}

/// 单个批次的最大字节数（100KB）
const BATCH_SIZE_LIMIT: usize = 100 * 1024;

/// 将快照按大小分批（每批不超过 BATCH_SIZE_LIMIT）
fn split_snapshot_into_batches(snapshot: &Snapshot) -> Vec<Snapshot> {
    let total_estimate: usize = snapshot.tables.values()
        .map(|rows| rows.len() * 200) // 估算每行 ~200 字节
        .sum();

    // 如果总量不大，直接返回单个快照
    if total_estimate <= BATCH_SIZE_LIMIT {
        return vec![Snapshot {
            site_id: snapshot.site_id.clone(),
            timestamp: snapshot.timestamp.clone(),
            tables: snapshot.tables.clone(),
        }];
    }

    // 按表分批：每个表独立一批，大表按行数拆分
    let mut batches = Vec::new();
    let max_rows_per_batch = BATCH_SIZE_LIMIT / 200; // 每批最大行数

    for (table, rows) in &snapshot.tables {
        if rows.len() <= max_rows_per_batch {
            // 小表：整个表一批
            let mut tables = std::collections::HashMap::new();
            tables.insert(table.clone(), rows.clone());
            batches.push(Snapshot {
                site_id: snapshot.site_id.clone(),
                timestamp: snapshot.timestamp.clone(),
                tables,
            });
        } else {
            // 大表：按行数拆分
            for (i, chunk) in rows.chunks(max_rows_per_batch).enumerate() {
                let mut tables = std::collections::HashMap::new();
                tables.insert(format!("{}_part{}", table, i), chunk.to_vec());
                batches.push(Snapshot {
                    site_id: snapshot.site_id.clone(),
                    timestamp: snapshot.timestamp.clone(),
                    tables,
                });
            }
        }
    }

    log::info!("[SYNC] 快照分批: {} 表 → {} 批", snapshot.tables.len(), batches.len());
    batches
}

/// 快照同步数据库（行级 LWW，支持分批）
async fn sync_snapshot(
    client: &dyn RemoteStorage,
    db_state: &DbState,
    remote_path: &str,
    storage_type: &str,
) -> Result<(String, u64, u64, bool), String> {
    let remote_snapshots_dir = format!("{}/snapshots", remote_path);

    // 确保远端 snapshots 目录存在
    client.ensure_dir(&remote_snapshots_dir).await?;

    // 读取配置
    let (mut site_id, last_sync_time) = {
        let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
        let site_id = ensure_site_id(&conn);
        let last_sync = setting_repo::get_setting(&conn, "sync.last_sync_time")
            .ok()
            .flatten()
            .map(|s| s.value)
            .unwrap_or_else(|| "1970-01-01T00:00:00+00:00".to_string());
        (site_id, last_sync)
    };

    let mut bytes_uploaded: u64 = 0;
    let mut bytes_downloaded: u64 = 0;
    let mut actions = Vec::new();

    // === 1. 导出本地变更并分批上传 ===
    let snapshot = {
        let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
        export_snapshot(&conn, &site_id, &last_sync_time)
    };

    let has_local_changes = !snapshot.tables.is_empty();
    if has_local_changes {
        let batches = split_snapshot_into_batches(&snapshot);
        let batch_count = batches.len();
        log::info!("[SYNC] 导出快照: {} 表, 分 {} 批上传", snapshot.tables.len(), batch_count);

        for (i, batch) in batches.iter().enumerate() {
            let json = serde_json::to_vec(batch).map_err(|e| format!("序列化快照批次: {e}"))?;
            let filename = if batch_count == 1 {
                format!("{}/snapshot_{}.json", remote_snapshots_dir, site_id)
            } else {
                format!("{}/snapshot_{}_batch{}.json", remote_snapshots_dir, site_id, i)
            };
            client.upload(&filename, &json).await?;
            bytes_uploaded += json.len() as u64;
            let total_rows: usize = batch.tables.values().map(|v| v.len()).sum();
            actions.push(format!("batch_{}_{}rows", i, total_rows));

            // 批次间暂停，避免限流
            if i < batch_count - 1 {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
        }
    } else {
        log::info!("[SYNC] 本地无变更，跳过上传");
    }

    // === 2. 列出远端快照文件，下载对方的 ===
    log::info!("[SYNC] 正在检查远端快照... (本机 site_id: {})", site_id);
    let remote_files = match client.list_remote(&remote_snapshots_dir).await {
        Ok(files) => {
            log::info!("[SYNC] 远端快照目录: {} 个文件", files.len());
            for f in &files {
                log::info!("[SYNC]   - {} (collection={})", f.display_name, f.is_collection);
            }
            files
        }
        Err(e) => {
            log::warn!("[SYNC] 列出远端快照失败: {}，跳过下载", e);
            Vec::new()
        }
    };
    // 检测 site_id 冲突：如果远端已有同名文件但本次没有上传（说明另一台设备用了相同 ID）
    // 注意：LAN 模式是点对点，对端设备有自己的快照是正常的，不是冲突
    let mut my_prefix = format!("snapshot_{}", site_id);
    let has_conflict = if storage_type == "lan" {
        false // LAN 模式下不检测 site_id 冲突
    } else {
        remote_files.iter().any(|f| f.display_name.starts_with(&my_prefix)) && !has_local_changes
    };
    if has_conflict {
        let new_id = nanoid::nanoid!(12);
        log::warn!("[SYNC] 检测到 site_id 冲突！远端已有同名快照，重新生成: {} → {}", site_id, new_id);
        {
            let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
            let _ = setting_repo::set_setting(&conn, "sync.site_id", &new_id);
            // 重置 last_sync_time 到 epoch，下次同步全量重新导出
            let _ = setting_repo::set_setting(&conn, "sync.last_sync_time", "1970-01-01T00:00:00+00:00");
        }
        site_id = new_id;
        my_prefix = format!("snapshot_{}", site_id);
    }

    // 按设备分组：找到每个对端设备的所有批次文件
    let mut peer_files: std::collections::HashMap<String, Vec<&RemoteFile>> = std::collections::HashMap::new();
    for file in &remote_files {
        if file.is_collection || !file.display_name.ends_with(".json") {
            continue;
        }
        if file.display_name.starts_with(&my_prefix) {
            continue;
        }
        let name = file.display_name.strip_suffix(".json").unwrap_or("");
        let peer_id = if let Some(rest) = name.strip_prefix("snapshot_") {
            rest.split("_batch").next().unwrap_or(rest)
        } else {
            continue;
        };
        peer_files.entry(peer_id.to_string()).or_default().push(file);
    }

    // 下载并合并每个对端设备的快照
    if peer_files.is_empty() {
        log::info!("[SYNC] 远端无其他设备快照（my_prefix: snapshot_{}）", site_id);
    } else {
        log::info!("[SYNC] 发现 {} 个对端设备，开始下载...", peer_files.len());
    }
    for (peer_id, files) in &peer_files {
        for file in files {
            match client.download(&file.href).await {
                Ok(data) => {
                    bytes_downloaded += data.len() as u64;
                    let peer_snapshot: Snapshot = match serde_json::from_slice(&data) {
                        Ok(s) => s,
                        Err(e) => {
                            log::warn!("[SYNC] 解析快照 {} 失败: {}", file.display_name, e);
                            continue;
                        }
                    };

                    let applied = merge_snapshot(db_state, &peer_snapshot).await?;
                    if applied > 0 {
                        actions.push(format!("merged_{}_from_{}", applied, peer_id));
                    }
                }
                Err(e) => {
                    log::warn!("[SYNC] 下载快照 {} 失败: {}", file.display_name, e);
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }
    }

    // site_id 冲突已处理：跳过上传，等待下次同步用新 ID 全量导出
    if has_conflict {
        log::info!("[SYNC] site_id 冲突处理完成，跳过上传，等待下次同步全量导出");
        let action = if actions.is_empty() {
            "site_id冲突已修复，等待下次同步全量导出".to_string()
        } else {
            actions.join(", ")
        };
        return Ok((action, bytes_uploaded, bytes_downloaded, true));
    }

    // 注意：不在这里更新 last_sync_time，由 run_full_sync 统一在所有阶段完成后更新
    // 否则快照成功但日记同步失败时，last_sync_time 已被推进，会导致数据变更丢失

    let action = if actions.is_empty() {
        "无变更".to_string()
    } else {
        actions.join(", ")
    };

    Ok((action, bytes_uploaded, bytes_downloaded, false))
}

/// 合并远端快照到本地数据库
async fn merge_snapshot(db_state: &DbState, peer: &Snapshot) -> Result<usize, String> {
    let mut total_applied = 0;

    for (table, rows) in &peer.tables {
        // 处理分批表名：tasks_part0 → tasks（仅匹配 _part + 纯数字后缀）
        let real_table = if let Some(idx) = table.rfind("_part") {
            let suffix = &table[idx + 5..];
            if !suffix.is_empty() && suffix.bytes().all(|b| b.is_ascii_digit()) {
                &table[..idx]
            } else {
                table.as_str()
            }
        } else {
            table.as_str()
        };

        // 分批合并，避免长时间持锁
        const BATCH_SIZE: usize = 50;
        for chunk in rows.chunks(BATCH_SIZE) {
            let applied = {
                let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
                merge_table_rows(&conn, real_table, chunk)?
            };
            total_applied += applied;
            tokio::task::yield_now().await;
        }
    }

    Ok(total_applied)
}

/// 合并单个表的行（LWW: updated_at 大的赢）
fn merge_table_rows(
    conn: &rusqlite::Connection,
    table: &str,
    rows: &[SnapshotRow],
) -> Result<usize, String> {
    let pk_col = if table == "settings" { "key" } else { "id" };
    let mut applied = 0;

    for row in rows {
        // settings 表中跳过设备特定的 sync.* 配置
        if table == "settings" && row.pk.starts_with("sync.") {
            continue;
        }

        // 查本地行的 updated_at
        let local_updated: Option<String> = conn.query_row(
            &format!("SELECT updated_at FROM \"{table}\" WHERE \"{pk_col}\" = ?1"),
            params![row.pk],
            |r| r.get(0),
        ).ok();

        // 决定是否应用：本地不存在 → 插入；远端 updated_at 更新 → 更新
        let should_apply = match &local_updated {
            None => true,
            Some(local_ts) => row.updated_at > *local_ts,
        };

        if !should_apply {
            continue;
        }

        // 处理软删除
        if row.deleted_at.is_some() {
            let _ = conn.execute(
                &format!("DELETE FROM \"{table}\" WHERE \"{pk_col}\" = ?1"),
                params![row.pk],
            );
            applied += 1;
            continue;
        }

        // Upsert：如果行不存在则插入骨架，然后更新各列
        let exists = local_updated.is_some();
        if !exists {
            let skeleton_sql = if table == "settings" {
                format!("INSERT OR IGNORE INTO \"{table}\" (\"key\", value, updated_at) VALUES (?1, '', '')")
            } else {
                format!("INSERT OR IGNORE INTO \"{table}\" (\"{pk_col}\", created_at, updated_at) VALUES (?1, '', '')")
            };
            let _ = conn.execute(&skeleton_sql, params![row.pk]);
        }

        // 更新各列
        for (col, val) in &row.data {
            // 安全校验列名
            if !col.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') || col.len() > 64 {
                continue;
            }
            // 跳过主键列
            if col == pk_col || col == "deleted_at" {
                continue;
            }
            let val_str = match val {
                serde_json::Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            let _ = conn.execute(
                &format!("UPDATE \"{table}\" SET \"{col}\" = ?1 WHERE \"{pk_col}\" = ?2"),
                params![val_str, row.pk],
            );
        }

        // 更新 updated_at
        let _ = conn.execute(
            &format!("UPDATE \"{table}\" SET updated_at = ?1 WHERE \"{pk_col}\" = ?2"),
            params![row.updated_at, row.pk],
        );

        applied += 1;
    }

    Ok(applied)
}

/// 同步日记文件（逐文件比较）
async fn sync_journals(
    client: &dyn RemoteStorage,
    local_dir: &Path,
    remote_dir: &str,
) -> Result<(u32, u32, u64, u64, Vec<String>), String> {
    let mut uploaded: u32 = 0;
    let mut downloaded: u32 = 0;
    let mut bytes_up: u64 = 0;
    let mut bytes_down: u64 = 0;
    let mut errors = Vec::new();

    let local_files = collect_local_md_files(local_dir)?;
    let remote_files = list_remote_recursive(client, remote_dir).await?;

    log::info!(
        "[SYNC] journals: local_dir={:?}, remote_dir={}, local_count={}",
        local_dir, remote_dir, local_files.len()
    );

    let remote_map: std::collections::HashMap<String, &RemoteFile> = remote_files
        .iter()
        .filter(|f| !f.is_collection && f.display_name.ends_with(".md"))
        .filter_map(|f| {
            let norm_remote = remote_dir.trim_end_matches('/');
            let relative = if let Some(pos) = f.href.find(norm_remote) {
                &f.href[pos + norm_remote.len()..]
            } else {
                f.href.rsplit('/').next().unwrap_or("")
            };
            let relative = relative.trim_start_matches('/');
            if relative.is_empty() {
                None
            } else {
                Some((relative.to_string(), f))
            }
        })
        .collect();

    // 上传本地新增/更新的文件（每 3 个文件暂停 1 秒避免限流）
    let mut op_count: u32 = 0;
    for (rel_path, local_mtime) in &local_files {
        let local_full = local_dir.join(rel_path);
        match remote_map.get(rel_path) {
            None => {
                if let Ok(data) = std::fs::read(&local_full) {
                    let remote_path = format!("{}/{}", remote_dir, rel_path);
                    if let Some(parent) = Path::new(rel_path).parent() {
                        if !parent.as_os_str().is_empty() {
                            let dir_path = format!("{}/{}", remote_dir, parent.display());
                            let _ = client.ensure_dir(&dir_path).await;
                        }
                    }
                    match client.upload(&remote_path, &data).await {
                        Ok(()) => {
                            uploaded += 1;
                            bytes_up += data.len() as u64;
                        }
                        Err(e) => errors.push(format!("上传 {} 失败: {}", rel_path, e)),
                    }
                    op_count += 1;
                    if op_count % 3 == 0 {
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    }
                }
            }
            Some(remote_file) => {
                let should_upload = match (local_mtime, remote_file.last_modified) {
                    (Some(lm), Some(rm)) => lm > &rm,
                    (Some(_), None) => true,
                    _ => false,
                };
                if should_upload {
                    if let Ok(data) = std::fs::read(&local_full) {
                        let remote_path = format!("{}/{}", remote_dir, rel_path);
                        match client.upload(&remote_path, &data).await {
                            Ok(()) => {
                                uploaded += 1;
                                bytes_up += data.len() as u64;
                            }
                            Err(e) => errors.push(format!("上传 {} 失败: {}", rel_path, e)),
                        }
                        op_count += 1;
                        if op_count % 3 == 0 {
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                        }
                    }
                }
            }
        }
    }

    // 下载远端新增/更新的文件（每 3 个文件暂停 1 秒避免限流）
    let mut op_count: u32 = 0;
    for (remote_rel, remote_file) in &remote_map {
        let local_full = local_dir.join(remote_rel);
        let local_mtime = if local_full.exists() {
            fs_mtime(&local_full)?
        } else {
            None
        };

        let should_download = match local_mtime {
            None => true,
            Some(lm) => match remote_file.last_modified {
                Some(rm) => rm > lm,
                None => false,
            },
        };

        if should_download {
            match client.download(&remote_file.href).await {
                Ok(data) => {
                    if let Some(parent) = local_full.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    match std::fs::write(&local_full, &data) {
                        Ok(()) => {
                            downloaded += 1;
                            bytes_down += data.len() as u64;
                        }
                        Err(e) => errors.push(format!("写入 {} 失败: {}", remote_rel, e)),
                    }
                    op_count += 1;
                    if op_count % 3 == 0 {
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    }
                }
                Err(e) => errors.push(format!("下载 {} 失败: {}", remote_rel, e)),
            }
        }
    }

    Ok((uploaded, downloaded, bytes_up, bytes_down, errors))
}

/// 递归列出远端目录下所有文件
async fn list_remote_recursive(
    client: &dyn RemoteStorage,
    path: &str,
) -> Result<Vec<RemoteFile>, String> {
    let mut all_files = Vec::new();
    let entries = client.list_remote(path).await?;

    for entry in entries {
        if entry.is_collection {
            // 用 href 构造子路径，避免 display_name 与 path 重复拼接
            // href 格式可能是 "/dav/lantern/journals/2026/" 或 "lantern/journals/2026/"
            // 需要提取相对于 remote_path 的部分
            let sub_path = if entry.href.starts_with('/') {
                // 绝对路径 href：去掉 base_url 前缀
                client.relative_path_from_href(&entry.href)
            } else {
                // 相对路径 href：直接使用
                entry.href.trim_end_matches('/').to_string()
            };
            if sub_path.is_empty() {
                continue;
            }
            // 每次递归前暂停，避免坚果云限流
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            match Box::pin(list_remote_recursive(client, &sub_path)).await {
                Ok(mut sub_files) => all_files.append(&mut sub_files),
                Err(e) => {
                    log::warn!("[SYNC] 递归列出子目录 {} 失败: {}", sub_path, e);
                }
            }
        } else {
            all_files.push(entry);
        }
    }

    Ok(all_files)
}

/// 获取文件修改时间（UTC）
fn fs_mtime(path: &Path) -> Result<Option<DateTime<Utc>>, String> {
    let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    let dt: DateTime<Utc> = modified.into();
    Ok(Some(dt))
}

/// 检查本地日记目录是否有文件比 since 更新
fn has_journal_changes_since(dir: &Path, since: &str) -> bool {
    if !dir.exists() {
        return false;
    }
    let since_dt = match chrono::DateTime::parse_from_rfc3339(since) {
        Ok(dt) => dt.with_timezone(&Utc),
        Err(_) => return true, // 解析失败，保守地认为有变更
    };
    check_dir_newer(dir, &since_dt)
}

fn check_dir_newer(dir: &Path, since: &DateTime<Utc>) -> bool {
    for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
        let path = entry.path();
        if path.is_dir() {
            if check_dir_newer(&path, since) {
                return true;
            }
        } else if path.extension().map_or(false, |e| e == "md") {
            if let Ok(Some(mtime)) = fs_mtime(&path) {
                if mtime > *since {
                    return true;
                }
            }
        }
    }
    false
}

/// 递归收集本地 .md 文件（返回相对路径 → mtime）
fn collect_local_md_files(dir: &Path) -> Result<Vec<(String, Option<DateTime<Utc>>)>, String> {
    let mut files = Vec::new();
    if !dir.exists() {
        return Ok(files);
    }
    collect_md_recursive(dir, dir, &mut files)?;
    Ok(files)
}

fn collect_md_recursive(
    base: &Path,
    current: &Path,
    files: &mut Vec<(String, Option<DateTime<Utc>>)>,
) -> Result<(), String> {
    for entry in std::fs::read_dir(current).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            collect_md_recursive(base, &path, files)?;
        } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.ends_with(".md") {
                let relative = path
                    .strip_prefix(base)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                let mtime = fs_mtime(&path).ok().flatten();
                files.push((relative, mtime));
            }
        }
    }
    Ok(())
}

/// 后台同步任务
pub fn spawn_background_sync(handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;

        loop {
            let should_sync = {
                let db_state = handle.state::<DbState>();
                let guard = db_state.conn.lock();
                match guard {
                    Ok(conn) => {
                        let enabled = setting_repo::get_setting(&conn, "sync.enabled")
                            .ok()
                            .flatten()
                            .map(|s| s.value == "true")
                            .unwrap_or(false);
                        if !enabled {
                            false
                        } else {
                            let last = setting_repo::get_setting(&conn, "sync.last_sync_time")
                                .ok()
                                .flatten()
                                .map(|s| s.value);
                            let interval: u64 =
                                setting_repo::get_setting(&conn, "sync.interval_minutes")
                                    .ok()
                                    .flatten()
                                    .map(|s| s.value.parse().unwrap_or(30))
                                    .unwrap_or(30);
                            match last {
                                Some(t) => {
                                    let elapsed = DateTime::parse_from_rfc3339(&t)
                                        .ok()
                                        .map(|t| {
                                            Utc::now().signed_duration_since(t).num_seconds()
                                                as u64
                                        })
                                        .unwrap_or(u64::MAX);
                                    elapsed >= interval * 60
                                }
                                None => true,
                            }
                        }
                    }
                    Err(_) => false,
                }
            };

            if should_sync {
                let sync_state = handle.state::<SyncState>();

                // 检测并重置卡死的同步状态
                sync_state.check_and_reset_if_stale();

                // 检查限流冷却期
                if sync_state.is_rate_limited() {
                    log::info!("[SYNC] 限流冷却期内，跳过本次后台同步");
                    continue;
                }

                let in_progress = sync_state
                    .in_progress
                    .lock()
                    .map(|g| *g)
                    .unwrap_or(true);

                if !in_progress {
                    sync_state.mark_started();

                    let db_state = handle.state::<DbState>();
                    let app_data = handle.state::<AppDataState>();

                    // 5 分钟超时保护，防止 WebDAV 操作卡死
                    let result = match tokio::time::timeout(
                        std::time::Duration::from_secs(300),
                        run_full_sync(&db_state, &app_data),
                    ).await {
                        Ok(r) => r,
                        Err(_) => {
                            log::error!("[SYNC] 后台同步超时（5 分钟），强制结束");
                            SyncResult::error("同步超时，请检查网络连接".to_string())
                        }
                    };

                    log::info!(
                        "Background sync completed: {} - {}",
                        if result.success { "OK" } else { "WARN" },
                        result.message
                    );

                    // 如果被限流，设置冷却期
                    if result.has_rate_limit_error() {
                        sync_state.set_rate_limited();
                        log::warn!("[SYNC] 检测到限流，5 分钟内不再自动同步");
                    }

                    sync_state.mark_finished();
                }
            }

            let sleep_secs = {
                let db_state = handle.state::<DbState>();
                let guard = db_state.conn.lock();
                guard
                    .ok()
                    .and_then(|conn| {
                        setting_repo::get_setting(&conn, "sync.interval_minutes")
                            .ok()
                            .flatten()
                            .map(|s| s.value.parse::<u64>().unwrap_or(30) * 60)
                    })
                    .unwrap_or(1800)
            };
            tokio::time::sleep(std::time::Duration::from_secs(sleep_secs)).await;
        }
    });
}

// ============ CRDT 变更同步（新增） ============

/// 导出变更数据（新版本）
pub async fn export_changes_data(
    db_state: &DbState,
    since_version: i64,
) -> Result<Vec<u8>, String> {
    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
    let changes = export_changes(&conn, since_version)?;
    let site_id = ensure_site_id(&conn);
    let current_version = get_current_db_version(&conn)?;

    let export = CrdtExport {
        site_id,
        version: current_version,
        since_version,
        changes,
        timestamp: Utc::now().to_rfc3339(),
    };

    serde_json::to_vec(&export).map_err(|e| e.to_string())
}

/// 导入变更数据（新版本）
pub async fn import_changes_data(
    db_state: &DbState,
    data: &[u8],
) -> Result<ImportResult, String> {
    let import: CrdtExport = serde_json::from_slice(data).map_err(|e| format!("解析导入数据失败: {}", e))?;

    // 检查站点冲突
    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
    let local_site_id = ensure_site_id(&conn);

    if import.site_id == local_site_id {
        return Err("无法导入本机数据".to_string());
    }

    // 应用变更
    let applied = import_changes(&conn, &import.changes)?;

    // 记录同步点
    let _ = setting_repo::set_setting(&conn, "sync.last_sync_version", &import.version.to_string());

    Ok(ImportResult {
        peer_site_id: import.site_id,
        applied,
        peer_version: import.version,
    })
}

/// CRDT 导出数据结构
#[derive(Debug, Serialize, Deserialize)]
struct CrdtExport {
    site_id: String,
    version: i64,
    since_version: i64,
    changes: Vec<Change>,
    timestamp: String,
}

/// 导入结果
#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub peer_site_id: String,
    pub applied: usize,
    pub peer_version: i64,
}

/// 应用单个变更到数据库
fn apply_change(
    conn: &rusqlite::Connection,
    change: &Change,
) -> Result<bool, String> {
    // 检查本地是否有更新版本
    let local_version: Option<i64> = conn.query_row(
        "SELECT db_version FROM sync_changes
         WHERE table_name = ?1 AND row_pk = ?2 AND column_name = ?3
         ORDER BY db_version DESC LIMIT 1",
        params![change.table_name, change.row_pk, change.column_name],
        |row| row.get(0),
    ).ok();

    if let Some(lv) = local_version {
        if lv >= change.db_version {
            // 本地版本更新或相同，跳过
            return Ok(false);
        }
    }

    // 插入变更记录
    conn.execute(
        "INSERT INTO sync_changes
         (table_name, row_pk, column_name, value, col_version, db_version, site_id, seq, is_delete)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            change.table_name,
            change.row_pk,
            change.column_name,
            change.value,
            change.col_version,
            change.db_version,
            change.site_id,
            change.seq,
            if change.is_delete { 1i64 } else { 0i64 }
        ],
    ).map_err(|e| format!("插入变更记录失败: {}", e))?;

    // 应用到实际表
    if change.is_delete {
        // 软删除
        let time = Utc::now().to_rfc3339();
        conn.execute(
            &format!("UPDATE {} SET deleted_at = ?1 WHERE id = ?2", change.table_name),
            params![time, change.row_pk],
        ).ok();
    } else {
        // 解析主键和值
        let pk: serde_json::Value = serde_json::from_str(&change.row_pk)
            .map_err(|e| format!("解析主键失败: {}", e))?;
        let id = pk.get("id").and_then(|v| v.as_str())
            .ok_or("主键缺少id字段")?;

        if let Some(column) = &change.column_name {
            if let Some(value_json) = &change.value {
                // 列级更新
                let value: serde_json::Value = serde_json::from_str(value_json)
                    .map_err(|e| format!("解析值失败: {}", e))?;
                if let Some(val) = value.get("v") {
                    let val_str = if let Some(s) = val.as_str() {
                        s.to_string()
                    } else {
                        val.to_string()
                    };
                    conn.execute(
                        &format!("UPDATE {} SET {} = ?1 WHERE id = ?2", change.table_name, column),
                        params![val_str, id],
                    ).ok();
                }
            }
        }
    }

    Ok(true)
}

/// 导入变更（批量）
fn import_changes(
    conn: &rusqlite::Connection,
    changes: &[Change],
) -> Result<usize, String> {
    let mut applied = 0;
    for change in changes {
        if apply_change(conn, change)? {
            applied += 1;
        }
    }
    Ok(applied)
}
