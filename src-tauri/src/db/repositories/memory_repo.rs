use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Memory {
    pub id: String,
    pub content: String,
    pub memory_type: String,
    pub source_text: Option<String>,
    pub conversation_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

const COLUMNS: &str = "id, content, memory_type, source_text, conversation_id, created_at, updated_at";

fn memory_from_row(row: &Row) -> rusqlite::Result<Memory> {
    Ok(Memory {
        id: row.get("id")?,
        content: row.get("content")?,
        memory_type: row.get("memory_type")?,
        source_text: row.get("source_text")?,
        conversation_id: row.get("conversation_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn now() -> String {
    chrono::Local::now().to_rfc3339()
}

fn gen_id() -> String {
    nanoid::nanoid!()
}

pub fn create_memory(
    conn: &Connection,
    content: &str,
    memory_type: &str,
    source_text: Option<&str>,
    conversation_id: Option<&str>,
) -> Result<Memory, String> {
    let id = gen_id();
    let now_str = now();

    conn.execute(
        "INSERT INTO ai_memories (id, content, memory_type, source_text, conversation_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, content, memory_type, source_text, conversation_id, now_str, now_str],
    )
    .map_err(|e| format!("Failed to create memory: {}", e))?;

    Ok(Memory {
        id,
        content: content.to_string(),
        memory_type: memory_type.to_string(),
        source_text: source_text.map(|s| s.to_string()),
        conversation_id: conversation_id.map(|s| s.to_string()),
        created_at: now_str.clone(),
        updated_at: now_str,
    })
}

pub fn list_memories(conn: &Connection, memory_type_filter: Option<&str>) -> Result<Vec<Memory>, String> {
    let mut memories = Vec::new();

    if let Some(filter) = memory_type_filter {
        let sql = format!("SELECT {} FROM ai_memories WHERE memory_type = ?1 AND deleted_at IS NULL ORDER BY created_at DESC", COLUMNS);
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Failed to list memories: {}", e))?;
        let rows = stmt
            .query_map(params![filter], |row| memory_from_row(row))
            .map_err(|e| format!("Failed to query memories: {}", e))?;
        for row in rows {
            memories.push(row.map_err(|e| format!("Failed to read memory: {}", e))?);
        }
    } else {
        let sql = format!("SELECT {} FROM ai_memories WHERE deleted_at IS NULL ORDER BY created_at DESC", COLUMNS);
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Failed to list memories: {}", e))?;
        let rows = stmt
            .query_map([], |row| memory_from_row(row))
            .map_err(|e| format!("Failed to query memories: {}", e))?;
        for row in rows {
            memories.push(row.map_err(|e| format!("Failed to read memory: {}", e))?);
        }
    }
    Ok(memories)
}

pub fn search_memories(
    conn: &Connection,
    query: &str,
    memory_type_filter: Option<&str>,
) -> Result<Vec<Memory>, String> {
    let pattern = format!("%{}%", query);
    let mut memories = Vec::new();

    if let Some(filter) = memory_type_filter {
        let sql = format!("SELECT {} FROM ai_memories WHERE content LIKE ?1 AND memory_type = ?2 AND deleted_at IS NULL ORDER BY created_at DESC", COLUMNS);
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Failed to search memories: {}", e))?;
        let rows = stmt
            .query_map(params![pattern, filter], |row| memory_from_row(row))
            .map_err(|e| format!("Failed to query memories: {}", e))?;
        for row in rows {
            memories.push(row.map_err(|e| format!("Failed to read memory: {}", e))?);
        }
    } else {
        let sql = format!("SELECT {} FROM ai_memories WHERE content LIKE ?1 AND deleted_at IS NULL ORDER BY created_at DESC", COLUMNS);
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Failed to search memories: {}", e))?;
        let rows = stmt
            .query_map(params![pattern], |row| memory_from_row(row))
            .map_err(|e| format!("Failed to query memories: {}", e))?;
        for row in rows {
            memories.push(row.map_err(|e| format!("Failed to read memory: {}", e))?);
        }
    }
    Ok(memories)
}

pub fn get_memory(conn: &Connection, id: &str) -> Result<Memory, String> {
    let sql = format!("SELECT {} FROM ai_memories WHERE id = ?1 AND deleted_at IS NULL", COLUMNS);
    conn.query_row(&sql, params![id], |row| memory_from_row(row))
        .map_err(|e| format!("Memory not found: {}", e))
}

pub fn delete_memory(conn: &Connection, id: &str) -> Result<(), String> {
    let time = now();
    let affected = conn
        .execute("UPDATE ai_memories SET deleted_at = ?1 WHERE id = ?2", params![time, id])
        .map_err(|e| format!("Failed to delete memory: {}", e))?;
    if affected == 0 {
        return Err(format!("Memory not found: {}", id));
    }
    Ok(())
}

pub fn list_memories_for_injection(conn: &Connection, limit: i32) -> Result<Vec<Memory>, String> {
    let sql = format!(
        "SELECT {} FROM ai_memories WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?1",
        COLUMNS
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Failed to list memories for injection: {}", e))?;
    let rows = stmt
        .query_map(params![limit], |row| memory_from_row(row))
        .map_err(|e| format!("Failed to query memories: {}", e))?;
    let mut memories = Vec::new();
    for row in rows {
        memories.push(row.map_err(|e| format!("Failed to read memory: {}", e))?);
    }
    Ok(memories)
}

pub fn count_memories(conn: &Connection) -> Result<i32, String> {
    conn.query_row("SELECT COUNT(*) FROM ai_memories WHERE deleted_at IS NULL", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count memories: {}", e))
}
