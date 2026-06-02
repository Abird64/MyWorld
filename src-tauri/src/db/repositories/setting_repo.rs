use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

fn setting_from_row(row: &Row) -> rusqlite::Result<Setting> {
    Ok(Setting {
        key: row.get("key")?,
        value: row.get("value")?,
        updated_at: row.get("updated_at")?,
    })
}

fn now() -> String {
    chrono::Local::now().to_rfc3339()
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<Setting>, String> {
    let mut stmt = conn
        .prepare("SELECT key, value, updated_at FROM settings WHERE key = ?1 AND deleted_at IS NULL")
        .map_err(|e| e.to_string())?;

    let mut rows = stmt.query_map(params![key], setting_from_row).map_err(|e| e.to_string())?;

    match rows.next() {
        Some(row) => Ok(Some(row.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    let ts = now();
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3",
        params![key, value, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_settings(conn: &Connection) -> Result<Vec<Setting>, String> {
    let mut stmt = conn
        .prepare("SELECT key, value, updated_at FROM settings WHERE deleted_at IS NULL ORDER BY key")
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], setting_from_row).map_err(|e| e.to_string())?;

    let mut settings = Vec::new();
    for row in rows {
        settings.push(row.map_err(|e| e.to_string())?);
    }
    Ok(settings)
}

pub fn delete_setting(conn: &Connection, key: &str) -> Result<(), String> {
    let time = now();
    conn.execute("UPDATE settings SET deleted_at = ?1 WHERE key = ?2", params![time, key])
        .map_err(|e| e.to_string())?;
    Ok(())
}
