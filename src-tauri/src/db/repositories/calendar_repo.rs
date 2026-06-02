use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Calendar {
    pub id: String,
    pub name: String,
    pub color: String,
    pub is_default: i32,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

fn now() -> String {
    chrono::Local::now().to_rfc3339()
}

fn gen_id() -> String {
    nanoid::nanoid!()
}

fn calendar_from_row(row: &rusqlite::Row) -> rusqlite::Result<Calendar> {
    Ok(Calendar {
        id: row.get("id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        is_default: row.get("is_default")?,
        sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn list_calendars(conn: &Connection) -> Result<Vec<Calendar>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, color, is_default, sort_order, created_at, updated_at FROM calendars WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC")
        .map_err(|e| format!("Failed to query calendars: {}", e))?;
    let rows = stmt.query_map([], calendar_from_row)
        .map_err(|e| format!("Failed to query calendars: {}", e))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect calendars: {}", e))
}

pub fn create_calendar(
    conn: &Connection,
    name: &str,
    color: &str,
    is_default: i32,
) -> Result<Calendar, String> {
    let id = gen_id();
    let time = now();

    conn.execute(
        "INSERT INTO calendars (id, name, color, is_default, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM calendars WHERE deleted_at IS NULL), ?5, ?5)",
        params![id, name, color, is_default, time],
    )
    .map_err(|e| format!("Failed to create calendar: {}", e))?;

    get_calendar(conn, &id)
}

pub fn get_calendar(conn: &Connection, id: &str) -> Result<Calendar, String> {
    conn.query_row(
        "SELECT id, name, color, is_default, sort_order, created_at, updated_at FROM calendars WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        calendar_from_row,
    )
    .map_err(|e| format!("Calendar not found: {}", e))
}

pub fn get_default_calendar(conn: &Connection) -> Result<Calendar, String> {
    conn.query_row(
        "SELECT id, name, color, is_default, sort_order, created_at, updated_at FROM calendars WHERE is_default = 1 AND deleted_at IS NULL LIMIT 1",
        [],
        calendar_from_row,
    )
    .map_err(|e| format!("No default calendar: {}", e))
}

pub fn update_calendar(
    conn: &Connection,
    id: &str,
    name: Option<&str>,
    color: Option<&str>,
) -> Result<Calendar, String> {
    let time = now();
    let mut sets: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(v) = name {
        sets.push("name = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = color {
        sets.push("color = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }

    if sets.is_empty() {
        return get_calendar(conn, id);
    }

    sets.push("updated_at = ?".to_string());
    param_values.push(Box::new(time));

    let sql = format!("UPDATE calendars SET {} WHERE id = ?", sets.join(", "));
    param_values.push(Box::new(id.to_string()));

    let param_refs: Vec<&dyn rusqlite::ToSql> = param_values
        .iter()
        .map(|v| v.as_ref() as &dyn rusqlite::ToSql)
        .collect();

    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update calendar: {}", e))?;

    get_calendar(conn, id)
}

pub fn delete_calendar(conn: &Connection, id: &str) -> Result<u64, String> {
    // 将关联日程的 calendar_id 置 NULL（不删除日程）
    conn.execute(
        "UPDATE schedules SET calendar_id = NULL WHERE calendar_id = ?1",
        params![id],
    )
    .map_err(|e| format!("Failed to detach schedules: {}", e))?;

    let time = now();
    let affected = conn
        .execute("UPDATE calendars SET deleted_at = ?1 WHERE id = ?2", params![time, id])
        .map_err(|e| format!("Failed to delete calendar: {}", e))?;

    Ok(affected as u64)
}
