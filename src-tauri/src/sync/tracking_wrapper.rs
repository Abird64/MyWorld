//! 变更追踪事务包装器
//!
//! 用法：在 commands 层包装数据库操作，自动记录变更

use rusqlite::{Connection, params};
use crate::db::connection::DbState;

use super::change_tracking::{ensure_site_id, record_change, record_counter_delta, next_db_version};

/// 变更上下文，用于追踪一个事务内的所有变更
pub struct ChangeContext {
    pub site_id: String,
    pub db_version: i64,
    pub seq: i32,
}

impl ChangeContext {
    pub fn new(conn: &Connection) -> Result<Self, String> {
        let site_id = ensure_site_id(conn);
        let db_version = next_db_version(conn)?;
        Ok(Self {
            site_id,
            db_version,
            seq: 0,
        })
    }

    pub fn next_seq(&mut self) -> i32 {
        self.seq += 1;
        self.seq
    }
}

/// 记录行级变更（Insert/Update/Delete）
pub fn track_row_change(
    conn: &Connection,
    ctx: &mut ChangeContext,
    table_name: &str,
    row_pk: &str,
    is_delete: bool,
) -> Result<(), String> {
    let seq = ctx.next_seq();
    record_change(
        conn,
        table_name,
        row_pk,
        None, // 行级变更没有具体列
        None,
        ctx.db_version,
        &ctx.site_id,
        seq,
        is_delete,
    )
}

/// 记录列级变更（用于特定列更新）
pub fn track_column_change(
    conn: &Connection,
    ctx: &mut ChangeContext,
    table_name: &str,
    row_pk: &str,
    column_name: &str,
    value: &str,
) -> Result<(), String> {
    let seq = ctx.next_seq();
    record_change(
        conn,
        table_name,
        row_pk,
        Some(column_name),
        Some(value),
        ctx.db_version,
        &ctx.site_id,
        seq,
        false,
    )
}

/// 记录 Counter CRDT 变更（用于 XP 等累加字段）
pub fn track_counter_delta(
    conn: &Connection,
    _ctx: &ChangeContext, // 不使用 ctx 的 seq，counter 是独立的
    table_name: &str,
    row_pk: &str,
    column_name: &str,
    delta: i64,
) -> Result<(), String> {
    let site_id = ensure_site_id(conn);
    record_counter_delta(conn, table_name, row_pk, column_name, delta, &site_id)
}

/// 通用事务包装器 - 自动追踪变更
///
/// 用法：
/// ```rust
/// let result = with_change_tracking(&db_state, |conn, ctx| {
///     // 执行数据库操作
///     create_task(conn, ...)?;
///     // 手动记录变更
///     track_row_change(conn, ctx, "tasks", &task_id, false)?;
///     Ok(task)
/// })?;
/// ```
pub fn with_change_tracking<T, F>(
    db_state: &DbState,
    f: F,
) -> Result<T, String>
where
    F: FnOnce(&Connection, &mut ChangeContext) -> Result<T, String>,
{
    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;

    let mut ctx = ChangeContext::new(&conn)?;

    let result = f(&conn, &mut ctx)?;

    Ok(result)
}

/// 批量变更追踪（用于一次操作影响多行）
///
/// 用法：
/// ```rust
/// let changes = vec![
///     ("tasks", "task-123", false),
///     ("tasks", "task-456", false),
/// ];
/// track_batch_changes(&conn, &mut ctx, &changes)?;
/// ```
pub fn track_batch_changes(
    conn: &Connection,
    ctx: &mut ChangeContext,
    changes: &[(String, String, bool)], // (table, row_pk, is_delete)
) -> Result<(), String> {
    for (table, pk, is_delete) in changes {
        track_row_change(conn, ctx, table, pk, *is_delete)?;
    }
    Ok(())
}

/// JSON 辅助函数：将主键打包成 JSON
pub fn pk_json(pk: &str) -> String {
    serde_json::json!({"id": pk}).to_string()
}

/// JSON 辅助函数：将值打包成 JSON
pub fn value_json<T: serde::Serialize>(value: T) -> String {
    serde_json::json!({"v": value}).to_string()
}
