use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: Option<String>,
    pub tool_calls: Option<String>,
    pub tool_call_id: Option<String>,
    pub reasoning_content: Option<String>,
    pub images: Option<String>,
    pub created_at: String,
}

fn conversation_from_row(row: &Row) -> rusqlite::Result<Conversation> {
    Ok(Conversation {
        id: row.get("id")?,
        title: row.get("title")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn message_from_row(row: &Row) -> rusqlite::Result<Message> {
    Ok(Message {
        id: row.get("id")?,
        conversation_id: row.get("conversation_id")?,
        role: row.get("role")?,
        content: row.get("content")?,
        tool_calls: row.get("tool_calls")?,
        tool_call_id: row.get("tool_call_id")?,
        reasoning_content: row.get("reasoning_content")?,
        images: row.get("images").ok(),
        created_at: row.get("created_at")?,
    })
}

fn now() -> String {
    chrono::Local::now().to_rfc3339()
}

fn gen_id() -> String {
    nanoid::nanoid!()
}

// ========== 对话 CRUD ==========

pub fn create_conversation(conn: &Connection, title: Option<&str>) -> Result<Conversation, String> {
    let id = gen_id();
    let ts = now();
    let title = title.unwrap_or("新对话");

    conn.execute(
        "INSERT INTO ai_conversations (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        params![id, title, ts],
    )
    .map_err(|e| e.to_string())?;

    Ok(Conversation {
        id,
        title: title.to_string(),
        created_at: ts.clone(),
        updated_at: ts,
    })
}

pub fn list_conversations(conn: &Connection) -> Result<Vec<Conversation>, String> {
    let mut stmt = conn
        .prepare("SELECT id, title, created_at, updated_at FROM ai_conversations WHERE deleted_at IS NULL ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], conversation_from_row).map_err(|e| e.to_string())?;

    let mut conversations = Vec::new();
    for row in rows {
        conversations.push(row.map_err(|e| e.to_string())?);
    }
    Ok(conversations)
}

pub fn get_conversation(conn: &Connection, id: &str) -> Result<Conversation, String> {
    let mut stmt = conn
        .prepare("SELECT id, title, created_at, updated_at FROM ai_conversations WHERE id = ?1 AND deleted_at IS NULL")
        .map_err(|e| e.to_string())?;

    let mut rows = stmt.query_map(params![id], conversation_from_row).map_err(|e| e.to_string())?;

    match rows.next() {
        Some(row) => Ok(row.map_err(|e| e.to_string())?),
        None => Err(format!("Conversation {} not found", id)),
    }
}

pub fn delete_conversation(conn: &Connection, id: &str) -> Result<(), String> {
    let time = now();
    // 软删除消息
    conn.execute("UPDATE ai_messages SET deleted_at = ?1 WHERE conversation_id = ?2", params![time, id])
        .map_err(|e| e.to_string())?;
    // 软删除对话
    conn.execute("UPDATE ai_conversations SET deleted_at = ?1 WHERE id = ?2", params![time, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn rename_conversation(conn: &Connection, id: &str, title: &str) -> Result<(), String> {
    let ts = now();
    conn.execute(
        "UPDATE ai_conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, ts, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ========== 消息 CRUD ==========

pub fn create_message(
    conn: &Connection,
    conversation_id: &str,
    role: &str,
    content: Option<&str>,
    tool_calls: Option<&str>,
    tool_call_id: Option<&str>,
    reasoning_content: Option<&str>,
) -> Result<Message, String> {
    create_message_with_images(conn, conversation_id, role, content, tool_calls, tool_call_id, reasoning_content, None)
}

/// 创建消息，支持附带图片数据（JSON 数组字符串）
pub fn create_message_with_images(
    conn: &Connection,
    conversation_id: &str,
    role: &str,
    content: Option<&str>,
    tool_calls: Option<&str>,
    tool_call_id: Option<&str>,
    reasoning_content: Option<&str>,
    images: Option<&str>,
) -> Result<Message, String> {
    let id = gen_id();
    let ts = now();

    conn.execute(
        "INSERT INTO ai_messages (id, conversation_id, role, content, tool_calls, tool_call_id, reasoning_content, images, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
        params![id, conversation_id, role, content, tool_calls, tool_call_id, reasoning_content, images, ts],
    )
    .map_err(|e| e.to_string())?;

    // 更新对话的 updated_at
    conn.execute(
        "UPDATE ai_conversations SET updated_at = ?1 WHERE id = ?2",
        params![ts, conversation_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(Message {
        id,
        conversation_id: conversation_id.to_string(),
        role: role.to_string(),
        content: content.map(|s| s.to_string()),
        tool_calls: tool_calls.map(|s| s.to_string()),
        tool_call_id: tool_call_id.map(|s| s.to_string()),
        reasoning_content: reasoning_content.map(|s| s.to_string()),
        images: images.map(|s| s.to_string()),
        created_at: ts,
    })
}

pub fn get_message(conn: &Connection, id: &str) -> Result<Message, String> {
    conn.query_row(
        "SELECT id, conversation_id, role, content, tool_calls, tool_call_id, reasoning_content, images, created_at
         FROM ai_messages WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        message_from_row,
    )
    .map_err(|e| format!("Message {} not found: {}", id, e))
}

pub fn list_messages(conn: &Connection, conversation_id: &str) -> Result<Vec<Message>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, conversation_id, role, content, tool_calls, tool_call_id, reasoning_content, images, created_at
             FROM ai_messages WHERE conversation_id = ?1 AND deleted_at IS NULL ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![conversation_id], message_from_row)
        .map_err(|e| e.to_string())?;

    let mut messages = Vec::new();
    for row in rows {
        messages.push(row.map_err(|e| e.to_string())?);
    }
    Ok(messages)
}
