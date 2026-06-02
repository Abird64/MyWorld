use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

fn now() -> String {
    chrono::Local::now().to_rfc3339()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiFavorite {
    pub id: String,
    pub content: String,
    pub role: String,
    pub conversation_title: Option<String>,
    pub message_id: Option<String>,
    pub created_at: String,
}

const COLUMNS: &str = "id, content, role, conversation_title, message_id, created_at";

fn favorite_from_row(row: &Row) -> rusqlite::Result<AiFavorite> {
    Ok(AiFavorite {
        id: row.get("id")?,
        content: row.get("content")?,
        role: row.get("role")?,
        conversation_title: row.get("conversation_title")?,
        message_id: row.get("message_id")?,
        created_at: row.get("created_at")?,
    })
}

pub fn add_favorite(
    conn: &Connection,
    content: &str,
    role: &str,
    conversation_title: Option<&str>,
    message_id: Option<&str>,
) -> Result<AiFavorite, String> {
    let id: String = nanoid::nanoid!();
    let now = now();

    conn.execute(
        "INSERT INTO ai_favorites (id, content, role, conversation_title, message_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![id, content, role, conversation_title, message_id, now],
    )
    .map_err(|e| format!("Failed to add favorite: {}", e))?;

    Ok(AiFavorite {
        id,
        content: content.to_string(),
        role: role.to_string(),
        conversation_title: conversation_title.map(|s| s.to_string()),
        message_id: message_id.map(|s| s.to_string()),
        created_at: now,
    })
}

pub fn list_favorites(conn: &Connection) -> Result<Vec<AiFavorite>, String> {
    let mut stmt = conn
        .prepare(&format!("SELECT {} FROM ai_favorites WHERE deleted_at IS NULL ORDER BY created_at DESC", COLUMNS))
        .map_err(|e| format!("Failed to list favorites: {}", e))?;

    let rows = stmt
        .query_map([], |row| favorite_from_row(row))
        .map_err(|e| format!("Failed to query favorites: {}", e))?;

    let mut favorites = Vec::new();
    for row in rows {
        favorites.push(row.map_err(|e| format!("Failed to read favorite: {}", e))?);
    }
    Ok(favorites)
}

pub fn delete_favorite(conn: &Connection, id: &str) -> Result<(), String> {
    let time = now();
    let affected = conn
        .execute("UPDATE ai_favorites SET deleted_at = ?1 WHERE id = ?2", params![time, id])
        .map_err(|e| format!("Failed to delete favorite: {}", e))?;

    if affected == 0 {
        return Err(format!("Favorite not found: {}", id));
    }
    Ok(())
}

pub fn delete_favorite_by_message_id(conn: &Connection, message_id: &str) -> Result<(), String> {
    let time = now();
    conn.execute(
        "UPDATE ai_favorites SET deleted_at = ?1 WHERE message_id = ?2",
        params![time, message_id],
    )
    .map_err(|e| format!("Failed to delete favorite by message_id: {}", e))?;
    Ok(())
}

pub fn delete_all_favorites(conn: &Connection) -> Result<(), String> {
    let time = now();
    conn.execute("UPDATE ai_favorites SET deleted_at = ?1 WHERE deleted_at IS NULL", params![time])
        .map_err(|e| format!("Failed to delete all favorites: {}", e))?;
    Ok(())
}
