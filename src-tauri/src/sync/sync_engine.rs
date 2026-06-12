use chrono::{DateTime, Utc};
use serde::Serialize;
use std::sync::Mutex;
#[cfg(feature = "gui")]
use tauri::Manager;

use super::journal_sync;
use super::oss_client::OssClient;
use super::remote_storage::RemoteStorage;
use super::snapshot;
use super::webdav_client::WebDavClient;
use crate::db::connection::{AppDataState, DbState};
use crate::db::repositories::setting_repo;

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

/// 获取站点ID
fn get_site_id(conn: &rusqlite::Connection) -> Result<String, String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = 'sync.site_id'",
        [],
        |r| r.get::<_, String>(0),
    )
    .map_err(|e| format!("Failed to get site_id: {}", e))
}

/// 获取或创建站点ID
pub(crate) fn ensure_site_id(conn: &rusqlite::Connection) -> String {
    match get_site_id(conn) {
        Ok(id) if !id.is_empty() => id,
        _ => {
            let id = nanoid::nanoid!(12);
            let now = chrono::Utc::now().to_rfc3339();
            let _ = conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sync.site_id', ?1, ?2)",
                rusqlite::params![id, now],
            );
            id
        }
    }
}

/// 同步配置
struct SyncConfig {
    storage_type: String,
    url: String,
    username: String,
    password: String,
    oss_access_key_id: String,
    oss_access_key_secret: String,
    oss_bucket: String,
    oss_region: String,
    remote_path: String,
    sync_journal_images: bool,
    sync_chat_images: bool,
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

    let oss_access_key_id = setting_repo::get_setting(conn, "sync.oss.access_key_id")?
        .map(|s| s.value)
        .unwrap_or_default();
    let oss_access_key_secret = setting_repo::get_setting(conn, "sync.oss.access_key_secret")?
        .map(|s| s.value)
        .unwrap_or_default();
    let oss_bucket = setting_repo::get_setting(conn, "sync.oss.bucket")?
        .map(|s| s.value)
        .unwrap_or_default();
    let oss_region = setting_repo::get_setting(conn, "sync.oss.region")?
        .map(|s| s.value)
        .unwrap_or_default();

    let remote_path = setting_repo::get_setting(conn, "sync.remote_path")?
        .map(|s| s.value)
        .unwrap_or_else(|| "/lantern/".to_string());

    let sync_journal_images = setting_repo::get_setting(conn, "sync.journal_images")
        .ok().flatten().map(|s| s.value == "true").unwrap_or(true);
    let sync_chat_images = setting_repo::get_setting(conn, "sync.chat_images")
        .ok().flatten().map(|s| s.value == "true").unwrap_or(false);

    Ok(SyncConfig {
        storage_type,
        url,
        username,
        password,
        oss_access_key_id,
        oss_access_key_secret,
        oss_bucket,
        oss_region,
        remote_path,
        sync_journal_images,
        sync_chat_images,
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
        ensure_site_id(&conn);
        match read_config(&conn) {
            Ok(c) => c,
            Err(e) => return SyncResult::error(e),
        }
    };

    let client: Box<dyn RemoteStorage> = match config.storage_type.as_str() {
        "oss" => {
            if config.oss_access_key_id.is_empty() || config.oss_access_key_secret.is_empty()
                || config.oss_bucket.is_empty() || config.oss_region.is_empty()
            {
                return SyncResult::error("OSS 配置不完整，请填写 AccessKey ID、AccessKey Secret、Bucket 和 Region".to_string());
            }
            match OssClient::new(&config.oss_bucket, &config.oss_region, &config.oss_access_key_id, &config.oss_access_key_secret) {
                Ok(c) => Box::new(c),
                Err(e) => return SyncResult::error(e),
            }
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
    match snapshot::sync_snapshot(&*client, db_state, remote_path, &config.storage_type).await {
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

    // 始终执行日记同步：sync_journals 内部已做增量比对，无变更时上传/下载均为 0，不浪费请求
    // 之前 has_journal_changes_since 只看本地变更，会导致新设备无本地日记时跳过远端日记下载
    log::info!("[SYNC] 开始同步日记... (journal_images={}, chat_images={})", config.sync_journal_images, config.sync_chat_images);
    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    match journal_sync::sync_journals(&*client, &journals_local, &journals_remote, config.sync_journal_images, false).await {
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

    // === 2b. 同步聊天图片（独立目录，由开关控制） ===
    if config.sync_chat_images {
        let chat_images_local = app_data.dir.join("chat_images");
        let chat_images_remote = format!("{}/chat_images", remote_path);
        log::info!("[SYNC] 开始同步聊天图片...");
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        match journal_sync::sync_journals(&*client, &chat_images_local, &chat_images_remote, false, true).await {
            Ok((uploaded, downloaded, up_bytes, down_bytes, errs)) => {
                result.journals_uploaded += uploaded;
                result.journals_downloaded += downloaded;
                bytes_uploaded += up_bytes;
                bytes_downloaded += down_bytes;
                result.errors.extend(errs);
            }
            Err(e) => {
                result.errors.push(format!("聊天图片同步失败: {}", e));
            }
        }
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

/// 后台同步任务
#[cfg(feature = "gui")]
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

                sync_state.check_and_reset_if_stale();

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

// ============================================================================
// 测试
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    // ── SyncResult ──

    #[test]
    fn sync_result_error() {
        let r = SyncResult::error("test error".into());
        assert!(!r.success);
        assert_eq!(r.db_action, "error");
        assert_eq!(r.errors, vec!["test error"]);
    }

    #[test]
    fn sync_result_rate_limit_detection() {
        let r = SyncResult::error("请求过于频繁, 请稍后重试 (限流)".into());
        assert!(r.has_rate_limit_error());

        let r2 = SyncResult::error("normal error".into());
        assert!(!r2.has_rate_limit_error());
    }

    #[test]
    fn sync_result_no_rate_limit_on_success() {
        let mut r = SyncResult::new();
        r.success = true;
        assert!(!r.has_rate_limit_error());
    }

    // ── ensure_site_id ──

    #[test]
    fn ensure_site_id_creates_new() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '')",
            [],
        )
        .unwrap();

        let id = ensure_site_id(&conn);
        assert!(!id.is_empty());
        assert_eq!(id.len(), 12); // nanoid 12

        // 验证已持久化
        let stored: String = conn
            .query_row("SELECT value FROM settings WHERE key='sync.site_id'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(stored, id);
    }

    #[test]
    fn ensure_site_id_reuses_existing() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES ('sync.site_id', 'existing123', '')",
            [],
        )
        .unwrap();

        let id = ensure_site_id(&conn);
        assert_eq!(id, "existing123");
    }

    // ── SyncState ──

    #[test]
    fn sync_state_initial_not_in_progress() {
        let state = SyncState::new();
        assert!(!*state.in_progress.lock().unwrap());
        assert!(!state.is_rate_limited());
    }

    #[test]
    fn sync_state_mark_started_and_finished() {
        let state = SyncState::new();

        state.mark_started();
        assert!(*state.in_progress.lock().unwrap());
        assert!(state.started_at.lock().unwrap().is_some());

        state.mark_finished();
        assert!(!*state.in_progress.lock().unwrap());
        assert!(state.started_at.lock().unwrap().is_none());
    }

    #[test]
    fn sync_state_rate_limiting() {
        let state = SyncState::new();
        assert!(!state.is_rate_limited());

        state.set_rate_limited();
        assert!(state.is_rate_limited());
    }

    #[test]
    fn sync_state_stale_detection_fresh() {
        let state = SyncState::new();
        state.mark_started();
        // 刚刚开始的同步不应检测为卡死
        assert!(!state.check_and_reset_if_stale());
        assert!(*state.in_progress.lock().unwrap()); // 仍在进行中
    }
}

