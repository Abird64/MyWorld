//! 变更追踪模块 - 轻量级 CRDT 实现
//!
//! 设计思路：
//! 1. 应用层拦截所有写操作，记录到 sync_changes 表
//! 2. 使用 db_version 全局版本号 + site_id 区分来源
//! 3. 列级 CRDT：支持 LWW 和 Counter 两种语义

use rusqlite::{Connection, params};
use serde::{Serialize, Deserialize};

/// 数据库版本管理：获取下一个版本号
pub fn next_db_version(conn: &Connection) -> Result<i64, String> {
    conn.execute(
        "UPDATE sync_db_version SET version = version + 1, updated_at = datetime('now') WHERE id = 1",
        [],
    )
    .map_err(|e| format!("Failed to increment db_version: {}", e))?;

    let version: i64 = conn
        .query_row(
            "SELECT version FROM sync_db_version WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get db_version: {}", e))?;

    Ok(version)
}

/// 获取当前数据库版本
pub fn get_current_db_version(conn: &Connection) -> Result<i64, String> {
    let version: i64 = conn
        .query_row(
            "SELECT COALESCE(version, 0) FROM sync_db_version WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    Ok(version)
}

/// 变更类型
#[derive(Debug, Clone)]
pub enum ChangeType {
    Insert,
    Update,
    Delete,
}

impl ChangeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ChangeType::Insert => "insert",
            ChangeType::Update => "update",
            ChangeType::Delete => "delete",
        }
    }
}

/// 变更记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Change {
    pub table_name: String,
    pub row_pk: String,       // JSON 格式的主键
    pub column_name: Option<String>,
    pub value: Option<String>, // JSON 格式的值
    pub col_version: i64,
    pub db_version: i64,
    pub site_id: String,
    pub seq: i32,
    pub is_delete: bool,
}

/// 记录变更
pub fn record_change(
    conn: &Connection,
    table_name: &str,
    row_pk: &str,
    column_name: Option<&str>,
    value: Option<&str>,
    db_version: i64,
    site_id: &str,
    seq: i32,
    is_delete: bool,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO sync_changes
         (table_name, row_pk, column_name, value, col_version, db_version, site_id, seq, is_delete)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT DO UPDATE SET
            value = excluded.value,
            col_version = excluded.col_version,
            db_version = excluded.db_version,
            seq = excluded.seq,
            is_delete = excluded.is_delete",
        params![
            table_name,
            row_pk,
            column_name,
            value,
            1i64, // col_version 从1开始
            db_version,
            site_id,
            seq,
            if is_delete { 1i64 } else { 0i64 }
        ],
    )
    .map_err(|e| format!("Failed to record change: {}", e))?;

    Ok(())
}

/// 记录整行变更（简化版）
pub fn record_row_change(
    conn: &Connection,
    table_name: &str,
    row_pk: &str,
    change_type: ChangeType,
    site_id: &str,
    seq: i32,
) -> Result<(), String> {
    let db_version = next_db_version(conn)?;
    record_change(
        conn,
        table_name,
        row_pk,
        None,
        None,
        db_version,
        site_id,
        seq,
        matches!(change_type, ChangeType::Delete),
    )
}

/// 导出变更（自指定版本以来）
pub fn export_changes(conn: &Connection, since_version: i64) -> Result<Vec<Change>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT table_name, row_pk, column_name, value, col_version, db_version, site_id, seq, is_delete
             FROM sync_changes
             WHERE db_version > ?1
             ORDER BY db_version, seq"
        )
        .map_err(|e| format!("Failed to prepare export_changes: {}", e))?;

    let changes = stmt
        .query_map([since_version], |row| {
            Ok(Change {
                table_name: row.get(0)?,
                row_pk: row.get(1)?,
                column_name: row.get(2)?,
                value: row.get(3)?,
                col_version: row.get(4)?,
                db_version: row.get(5)?,
                site_id: row.get(6)?,
                seq: row.get(7)?,
                is_delete: row.get::<_, i64>(8)? != 0,
            })
        })
        .map_err(|e| format!("Failed to query changes: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(changes)
}

/// 导出变更（按表分组，用于分批传输）
pub fn export_changes_by_table(
    conn: &Connection,
    since_version: i64,
) -> Result<std::collections::HashMap<String, Vec<Change>>, String> {
    let changes = export_changes(conn, since_version)?;
    let mut grouped: std::collections::HashMap<String, Vec<Change>> = std::collections::HashMap::new();

    for change in changes {
        grouped
            .entry(change.table_name.clone())
            .or_default()
            .push(change);
    }

    Ok(grouped)
}

/// 清理旧变更记录（保留最近N个版本）
pub fn cleanup_old_changes(conn: &Connection, keep_versions: i64) -> Result<(), String> {
    let current = get_current_db_version(conn)?;
    let cutoff = current - keep_versions;

    if cutoff > 0 {
        conn.execute(
            "DELETE FROM sync_changes WHERE db_version < ?1",
            [cutoff],
        )
        .map_err(|e| format!("Failed to cleanup old changes: {}", e))?;
    }

    Ok(())
}

/// Counter CRDT：记录增量
pub fn record_counter_delta(
    conn: &Connection,
    table_name: &str,
    row_pk: &str,
    column_name: &str,
    delta: i64,
    site_id: &str,
) -> Result<(), String> {
    let db_version = next_db_version(conn)?;

    conn.execute(
        "INSERT INTO sync_counters (table_name, row_pk, column_name, site_id, delta, db_version)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![table_name, row_pk, column_name, site_id, delta, db_version],
    )
    .map_err(|e| format!("Failed to record counter delta: {}", e))?;

    Ok(())
}

/// Counter CRDT：计算累计值（所有站点的增量之和）
pub fn calculate_counter_value(
    conn: &Connection,
    table_name: &str,
    row_pk: &str,
    column_name: &str,
) -> Result<i64, String> {
    let sum: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(delta), 0) FROM sync_counters
             WHERE table_name = ?1 AND row_pk = ?2 AND column_name = ?3",
            params![table_name, row_pk, column_name],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(sum)
}

/// 获取最后一次变更的版本号（用于 last_sync_time 的替代）
pub fn get_last_change_version(conn: &Connection) -> Result<i64, String> {
    let version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(db_version), 0) FROM sync_changes",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(version)
}

/// 获取站点ID
pub fn get_site_id(conn: &Connection) -> Result<String, String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = 'sync.site_id'",
        [],
        |r| r.get::<_, String>(0),
    )
    .map_err(|e| format!("Failed to get site_id: {}", e))
}

/// 获取或创建站点ID
pub fn ensure_site_id(conn: &Connection) -> String {
    match get_site_id(conn) {
        Ok(id) if !id.is_empty() => id,
        _ => {
            let id = nanoid::nanoid!(12);
            let now = chrono::Utc::now().to_rfc3339();
            let _ = conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sync.site_id', ?1, ?2)",
                params![id, now],
            );
            id
        }
    }
}
