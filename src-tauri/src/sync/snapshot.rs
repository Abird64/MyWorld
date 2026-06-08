use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::remote_storage::{RemoteFile, RemoteStorage};
use crate::db::connection::DbState;
use crate::db::repositories::setting_repo;

/// 需要同步的表名白名单（仅包含 migrations.rs 中 CREATE TABLE 的表）
/// 同时作为 SQL 拼接前的安全校验白名单，防止来自同步数据的 SQL 注入
const SYNC_TABLES: &[&str] = &[
    "tasks", "skills", "task_skills", "skill_events",
    "schedules",
    "contacts", "diary_contacts", "task_contacts", "contact_methods",
    "journals",
    "habits", "habit_records",
    "settings",
    "ai_conversations", "ai_messages", "ai_favorites", "ai_memories",
    "calendars",
    "wishes", "wish_draws", "glow_balances", "glow_ledger",
    "pomodoro_sessions",
];

/// 判断敏感配置项，这些不应出现在快照同步中
fn is_sensitive_setting(key: &str) -> bool {
    key.starts_with("sync.") || key == "ai.api_key"
}

/// 校验表名是否在白名单中（防 SQL 注入）
fn validate_table(table: &str) -> Result<(), String> {
    if SYNC_TABLES.contains(&table) {
        Ok(())
    } else {
        Err(format!("非法表名: {}", table))
    }
}

/// 快照中的一行数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct SnapshotRow {
    pub pk: String,
    pub data: HashMap<String, serde_json::Value>,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

/// 快照文件格式
#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct Snapshot {
    pub site_id: String,
    pub timestamp: String,
    pub tables: HashMap<String, Vec<SnapshotRow>>,
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

    // settings 表中过滤掉敏感配置（sync.* 和 ai.api_key），避免泄露或设备间互相覆盖
    if table == "settings" {
        result.retain(|row| !is_sensitive_setting(&row.pk));
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

    if total_estimate <= BATCH_SIZE_LIMIT {
        return vec![Snapshot {
            site_id: snapshot.site_id.clone(),
            timestamp: snapshot.timestamp.clone(),
            tables: snapshot.tables.clone(),
        }];
    }

    let mut batches = Vec::new();
    let max_rows_per_batch = BATCH_SIZE_LIMIT / 200;

    for (table, rows) in &snapshot.tables {
        if rows.len() <= max_rows_per_batch {
            let mut tables = HashMap::new();
            tables.insert(table.clone(), rows.clone());
            batches.push(Snapshot {
                site_id: snapshot.site_id.clone(),
                timestamp: snapshot.timestamp.clone(),
                tables,
            });
        } else {
            for (i, chunk) in rows.chunks(max_rows_per_batch).enumerate() {
                let mut tables = HashMap::new();
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
pub(crate) async fn sync_snapshot(
    client: &dyn RemoteStorage,
    db_state: &DbState,
    remote_path: &str,
    storage_type: &str,
) -> Result<(String, u64, u64, bool), String> {
    let remote_snapshots_dir = format!("{}/snapshots", remote_path);

    client.ensure_dir(&remote_snapshots_dir).await?;

    let (mut site_id, last_sync_time) = {
        let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
        let site_id = super::sync_engine::ensure_site_id(&conn);
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

    // 检测 site_id 冲突
    let mut my_prefix = format!("snapshot_{}", site_id);
    let has_conflict = if storage_type == "lan" {
        false
    } else {
        remote_files.iter().any(|f| f.display_name.starts_with(&my_prefix)) && !has_local_changes
    };
    if has_conflict {
        let new_id = nanoid::nanoid!(12);
        log::warn!("[SYNC] 检测到 site_id 冲突！远端已有同名快照，重新生成: {} → {}", site_id, new_id);
        {
            let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
            let _ = setting_repo::set_setting(&conn, "sync.site_id", &new_id);
            let _ = setting_repo::set_setting(&conn, "sync.last_sync_time", "1970-01-01T00:00:00+00:00");
        }
        site_id = new_id;
        my_prefix = format!("snapshot_{}", site_id);
    }

    // 按设备分组
    let mut peer_files: HashMap<String, Vec<&RemoteFile>> = HashMap::new();
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

    if has_conflict {
        log::info!("[SYNC] site_id 冲突处理完成，跳过上传，等待下次同步全量导出");
        let action = if actions.is_empty() {
            "site_id冲突已修复，等待下次同步全量导出".to_string()
        } else {
            actions.join(", ")
        };
        return Ok((action, bytes_uploaded, bytes_downloaded, true));
    }

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
    validate_table(table)?;
    let pk_col = if table == "settings" { "key" } else { "id" };
    let mut applied = 0;

    for row in rows {
        if table == "settings" && is_sensitive_setting(&row.pk) {
            continue;
        }

        let local_updated: Option<String> = conn.query_row(
            &format!("SELECT updated_at FROM \"{table}\" WHERE \"{pk_col}\" = ?1"),
            params![row.pk],
            |r| r.get(0),
        ).map_err(|e| {
            log::error!("[SYNC] 查询本地行 updated_at 失败 (table={table}, pk={}): {e}", row.pk);
        }).ok().flatten();

        let should_apply = match &local_updated {
            None => true,
            Some(local_ts) => row.updated_at > *local_ts,
        };

        if !should_apply {
            continue;
        }

        if row.deleted_at.is_some() {
            if let Err(e) = conn.execute(
                &format!("DELETE FROM \"{table}\" WHERE \"{pk_col}\" = ?1"),
                params![row.pk],
            ) {
                log::error!("[SYNC] 软删除行失败 (table={table}, pk={}): {e}", row.pk);
            }
            applied += 1;
            continue;
        }

        let exists = local_updated.is_some();
        if !exists {
            // 构建包含所有数据的 INSERT，避免 NOT NULL 列无默认值导致 INSERT OR IGNORE 静默失败
            let mut cols: Vec<String> = vec![format!("\"{}\"", pk_col)];
            let mut placeholders: Vec<String> = vec!["?1".to_string()];
            let mut param_vals: Vec<String> = vec![row.pk.clone()];
            let mut idx = 2;
            for (col, val) in &row.data {
                if !col.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') || col.len() > 64 {
                    continue;
                }
                if col == pk_col || col == "deleted_at" {
                    continue;
                }
                let val_str = match val {
                    serde_json::Value::String(s) => s.clone(),
                    other => other.to_string(),
                };
                cols.push(format!("\"{}\"", col));
                placeholders.push(format!("?{}", idx));
                param_vals.push(val_str);
                idx += 1;
            }
            // 确保 updated_at 包含在内
            if !cols.iter().any(|c| c == "\"updated_at\"") {
                cols.push("\"updated_at\"".to_string());
                placeholders.push(format!("?{}", idx));
                param_vals.push(row.updated_at.clone());
            }
            let sql = format!(
                "INSERT OR IGNORE INTO \"{table}\" ({}) VALUES ({})",
                cols.join(", "),
                placeholders.join(", ")
            );
            let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_vals.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();
            if let Err(e) = conn.execute(&sql, params_refs.as_slice()) {
                log::error!("[SYNC] 插入行失败 (table={table}, pk={}): {e}", row.pk);
            } else {
                applied += 1;
                continue; // 新插入的行已包含所有数据，跳过逐列 UPDATE
            }
        }

        // 已存在的行：逐列更新
        for (col, val) in &row.data {
            if !col.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') || col.len() > 64 {
                continue;
            }
            if col == pk_col || col == "deleted_at" {
                continue;
            }
            let val_str = match val {
                serde_json::Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            if let Err(e) = conn.execute(
                &format!("UPDATE \"{table}\" SET \"{col}\" = ?1 WHERE \"{pk_col}\" = ?2"),
                params![val_str, row.pk],
            ) {
                log::error!("[SYNC] 更新列失败 (table={table}, col={col}, pk={}): {e}", row.pk);
            }
        }

        if let Err(e) = conn.execute(
            &format!("UPDATE \"{table}\" SET updated_at = ?1 WHERE \"{pk_col}\" = ?2"),
            params![row.updated_at, row.pk],
        ) {
            log::error!("[SYNC] 更新 updated_at 失败 (table={table}, pk={}): {e}", row.pk);
        }

        applied += 1;
    }

    Ok(applied)
}

// ============================================================================
// 测试
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    // ── helpers ──

    fn setup_tasks_table(conn: &Connection) {
        conn.execute_batch(
            "CREATE TABLE tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                done INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT '',
                deleted_at TEXT
            );",
        )
        .unwrap();
    }

    fn setup_settings_table(conn: &Connection) {
        conn.execute_batch(
            "CREATE TABLE settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT '',
                deleted_at TEXT
            );",
        )
        .unwrap();
    }

    fn row(pk: &str, updated_at: &str, data: &[(&str, &str)]) -> SnapshotRow {
        SnapshotRow {
            pk: pk.to_string(),
            data: data
                .iter()
                .map(|(k, v)| (k.to_string(), serde_json::Value::String(v.to_string())))
                .collect(),
            updated_at: updated_at.to_string(),
            deleted_at: None,
        }
    }

    fn deleted_row(pk: &str, updated_at: &str, deleted_at: &str) -> SnapshotRow {
        SnapshotRow {
            pk: pk.to_string(),
            data: HashMap::new(),
            updated_at: updated_at.to_string(),
            deleted_at: Some(deleted_at.to_string()),
        }
    }

    // ── validate_table ──

    #[test]
    fn test_validate_table_valid() {
        assert!(validate_table("tasks").is_ok());
        assert!(validate_table("settings").is_ok());
        assert!(validate_table("habits").is_ok());
    }

    #[test]
    fn test_validate_table_invalid() {
        assert!(validate_table("; DROP TABLE tasks;--").is_err());
        assert!(validate_table("nonexistent").is_err());
    }

    // ── merge_table_rows ──

    #[test]
    fn merge_inserts_new_row_when_local_not_exists() {
        let conn = Connection::open_in_memory().unwrap();
        setup_tasks_table(&conn);

        let rows = vec![row("task-1", "2024-06-01T12:00:00Z", &[
            ("title", "Buy milk"),
        ])];

        let applied = merge_table_rows(&conn, "tasks", &rows).unwrap();
        assert_eq!(applied, 1);

        let title: String = conn
            .query_row("SELECT title FROM tasks WHERE id='task-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(title, "Buy milk");
    }

    #[test]
    fn merge_skips_when_local_is_newer() {
        let conn = Connection::open_in_memory().unwrap();
        setup_tasks_table(&conn);

        // 本地已有较新数据
        conn.execute(
            "INSERT INTO tasks (id, title, updated_at) VALUES ('task-1', 'Local title', '2024-06-02T12:00:00Z')",
            [],
        )
        .unwrap();

        // 远端是旧版本
        let rows = vec![row("task-1", "2024-06-01T12:00:00Z", &[
            ("title", "Old remote"),
        ])];

        let applied = merge_table_rows(&conn, "tasks", &rows).unwrap();
        assert_eq!(applied, 0);

        let title: String = conn
            .query_row("SELECT title FROM tasks WHERE id='task-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(title, "Local title");
    }

    #[test]
    fn merge_overwrites_when_remote_is_newer() {
        let conn = Connection::open_in_memory().unwrap();
        setup_tasks_table(&conn);

        // 本地是旧版本
        conn.execute(
            "INSERT INTO tasks (id, title, updated_at) VALUES ('task-1', 'Old local', '2024-06-01T12:00:00Z')",
            [],
        )
        .unwrap();

        // 远端更新
        let rows = vec![row("task-1", "2024-06-02T12:00:00Z", &[
            ("title", "New remote"),
        ])];

        let applied = merge_table_rows(&conn, "tasks", &rows).unwrap();
        assert_eq!(applied, 1);

        let title: String = conn
            .query_row("SELECT title FROM tasks WHERE id='task-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(title, "New remote");
    }

    #[test]
    fn merge_same_timestamp_remote_wins() {
        let conn = Connection::open_in_memory().unwrap();
        setup_tasks_table(&conn);

        conn.execute(
            "INSERT INTO tasks (id, title, updated_at) VALUES ('task-1', 'Local', '2024-06-01T12:00:00Z')",
            [],
        )
        .unwrap();

        // 相同时间戳 → row.updated_at > local_ts 为 false → 跳过
        let rows = vec![row("task-1", "2024-06-01T12:00:00Z", &[
            ("title", "Remote same time"),
        ])];

        let applied = merge_table_rows(&conn, "tasks", &rows).unwrap();
        assert_eq!(applied, 0);
    }

    #[test]
    fn merge_applies_soft_delete() {
        let conn = Connection::open_in_memory().unwrap();
        setup_tasks_table(&conn);

        conn.execute(
            "INSERT INTO tasks (id, title, updated_at) VALUES ('task-1', 'To delete', '2024-06-01T12:00:00Z')",
            [],
        )
        .unwrap();

        let rows = vec![deleted_row(
            "task-1",
            "2024-06-02T12:00:00Z",
            "2024-06-02T12:00:00Z",
        )];

        let applied = merge_table_rows(&conn, "tasks", &rows).unwrap();
        assert_eq!(applied, 1);

        // 行应被删除
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM tasks WHERE id='task-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn merge_skips_soft_delete_when_local_newer() {
        let conn = Connection::open_in_memory().unwrap();
        setup_tasks_table(&conn);

        // 本地数据比远端删除更新 → 删除不应生效
        conn.execute(
            "INSERT INTO tasks (id, title, updated_at) VALUES ('task-1', 'Keep me', '2024-06-03T12:00:00Z')",
            [],
        )
        .unwrap();

        let rows = vec![deleted_row(
            "task-1",
            "2024-06-02T12:00:00Z",
            "2024-06-02T12:00:00Z",
        )];

        let applied = merge_table_rows(&conn, "tasks", &rows).unwrap();
        assert_eq!(applied, 0);
    }

    #[test]
    fn merge_filters_sensitive_settings() {
        let conn = Connection::open_in_memory().unwrap();
        setup_settings_table(&conn);

        // sync.* 和 ai.api_key 都应被过滤
        let rows = vec![
            row("sync.url", "2024-06-02T12:00:00Z", &[
                ("value", "https://evil.com/"),
            ]),
            row("ai.api_key", "2024-06-02T12:00:00Z", &[
                ("value", "sk-secret-key"),
            ]),
        ];

        let applied = merge_table_rows(&conn, "settings", &rows).unwrap();
        assert_eq!(applied, 0, "敏感设置不应被合并");
    }

    #[test]
    fn merge_allows_non_sync_settings() {
        let conn = Connection::open_in_memory().unwrap();
        setup_settings_table(&conn);

        let rows = vec![row("ai.model", "2024-06-02T12:00:00Z", &[
            ("value", "gpt-5"),
        ])];

        let applied = merge_table_rows(&conn, "settings", &rows).unwrap();
        assert_eq!(applied, 1);

        let value: String = conn
            .query_row("SELECT value FROM settings WHERE key='ai.model'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(value, "gpt-5");
    }

    #[test]
    fn merge_rejects_invalid_table() {
        let conn = Connection::open_in_memory().unwrap();
        let rows = vec![row("x", "2024-01-01T00:00:00Z", &[])];
        assert!(merge_table_rows(&conn, "nonexistent", &rows).is_err());
    }

    #[test]
    fn merge_multiple_columns() {
        let conn = Connection::open_in_memory().unwrap();
        setup_tasks_table(&conn);

        let rows = vec![row("task-1", "2024-06-02T12:00:00Z", &[
            ("title", "Updated"),
            ("done", "1"),
        ])];

        let applied = merge_table_rows(&conn, "tasks", &rows).unwrap();
        assert_eq!(applied, 1);

        let title: String = conn
            .query_row("SELECT title FROM tasks WHERE id='task-1'", [], |r| r.get(0))
            .unwrap();
        let done: i32 = conn
            .query_row("SELECT done FROM tasks WHERE id='task-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(title, "Updated");
        assert_eq!(done, 1);
    }

    #[test]
    fn merge_batch_applies_only_newer_rows() {
        let conn = Connection::open_in_memory().unwrap();
        setup_tasks_table(&conn);

        conn.execute(
            "INSERT INTO tasks (id, title, updated_at) VALUES ('t1', 'Local t1', '2024-06-02T00:00:00Z')",
            [],
        )
        .unwrap();

        let rows = vec![
            row("t1", "2024-06-03T00:00:00Z", &[("title", "Remote t1")]), // 更新 → 应用
            row("t2", "2024-06-01T00:00:00Z", &[("title", "Remote t2")]), // 新增 → 应用
        ];

        let applied = merge_table_rows(&conn, "tasks", &rows).unwrap();
        assert_eq!(applied, 2);
    }

    // ── export_table_changes ──

    #[test]
    fn export_finds_changed_rows() {
        let conn = Connection::open_in_memory().unwrap();
        setup_tasks_table(&conn);

        conn.execute(
            "INSERT INTO tasks (id, title, updated_at) VALUES ('old', 'Old', '2024-01-01T00:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO tasks (id, title, updated_at) VALUES ('new', 'New', '2024-06-01T00:00:00Z')",
            [],
        )
        .unwrap();

        let rows = export_table_changes(&conn, "tasks", "2024-03-01T00:00:00Z");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].pk, "new");
    }

    #[test]
    fn export_excludes_sensitive_settings() {
        let conn = Connection::open_in_memory().unwrap();
        setup_settings_table(&conn);

        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES ('sync.url', 'https://a.com/', '2024-06-01T00:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES ('ai.api_key', 'sk-secret', '2024-06-01T00:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES ('ai.model', 'deepseek', '2024-06-01T00:00:00Z')",
            [],
        )
        .unwrap();

        let rows = export_table_changes(&conn, "settings", "2024-01-01T00:00:00Z");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].pk, "ai.model");
    }

    #[test]
    fn export_includes_soft_deleted() {
        let conn = Connection::open_in_memory().unwrap();
        setup_tasks_table(&conn);

        conn.execute(
            "INSERT INTO tasks (id, title, updated_at, deleted_at) VALUES ('del', 'Gone', '2024-06-01T00:00:00Z', '2024-06-02T00:00:00Z')",
            [],
        )
        .unwrap();

        let rows = export_table_changes(&conn, "tasks", "2024-01-01T00:00:00Z");
        assert_eq!(rows.len(), 1);
        assert!(rows[0].deleted_at.is_some());
    }
}

