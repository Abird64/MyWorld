use rusqlite::Connection;
use serde::Deserialize;

use crate::db::repositories::memory_repo;

use super::shared::{memory_type_label, VALID_MEMORY_TYPES};

#[derive(Debug, Deserialize)]
struct ToolRecordMemoryArgs {
    content: String,
    memory_type: String,
    #[serde(default)]
    source_text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolSearchMemoriesArgs {
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    memory_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolDeleteMemoryArgs {
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    id: Option<String>,
}

pub fn execute_record_memory(conn: &mut Connection, arguments: &str) -> Result<String, String> {
    let args: ToolRecordMemoryArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("record_memory 参数解析失败: {}", e))?;

    if !VALID_MEMORY_TYPES.contains(&args.memory_type.as_str()) {
        return Err(format!(
            "无效的记忆类型: {}。有效类型: {}",
            args.memory_type,
            VALID_MEMORY_TYPES.join(", ")
        ));
    }

    let existing = memory_repo::list_memories(conn, None).unwrap_or_default();
    for m in &existing {
        if m.content.contains(&args.content) || args.content.contains(&m.content) {
            return Ok(format!(
                "小本本中已有类似记忆：[{}] \"{}\"。跳过重复记录。",
                memory_type_label(&m.memory_type),
                m.content
            ));
        }
    }

    let memory = memory_repo::create_memory(
        conn,
        &args.content,
        &args.memory_type,
        args.source_text.as_deref(),
        None,
    )?;

    Ok(format!(
        "已记入小本本：[{}] {}",
        memory_type_label(&memory.memory_type),
        memory.content
    ))
}

pub fn execute_search_memories(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolSearchMemoriesArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("search_memories 参数解析失败: {}", e))?;

    if let Some(ref t) = args.memory_type {
        if !VALID_MEMORY_TYPES.contains(&t.as_str()) {
            return Err(format!(
                "无效的记忆类型: {}。有效类型: {}",
                t,
                VALID_MEMORY_TYPES.join(", ")
            ));
        }
    }

    let memories = match &args.query {
        Some(q) if !q.trim().is_empty() => {
            memory_repo::search_memories(conn, q, args.memory_type.as_deref())?
        }
        _ => memory_repo::list_memories(conn, args.memory_type.as_deref())?,
    };

    if memories.is_empty() {
        let hint = match (&args.query, &args.memory_type) {
            (Some(q), Some(t)) => {
                format!("小本本中还没有匹配[{}]的{}类记忆。", q, memory_type_label(t))
            }
            (Some(q), _) => format!("小本本中还没有匹配[{}]的记忆。", q),
            (_, Some(t)) => format!("小本本中还没有{}类记忆。", memory_type_label(t)),
            _ => "小本本还是空的。当你在对话中了解到值得记住的信息时，我会帮你记下来。".to_string(),
        };
        return Ok(hint);
    }

    let mut result = format!("小本本中找到{}条记忆：\n\n", memories.len());
    for m in &memories {
        let label = memory_type_label(&m.memory_type);
        let time = &m.created_at[..m.created_at.len().min(16)];
        result.push_str(&format!("- [{}] {}（{}）\n", label, m.content, time));
    }
    result.push_str("\n提示：你可以说「帮我记住xxx」来添加新记忆。");
    Ok(result)
}

pub fn execute_delete_memory(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolDeleteMemoryArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("delete_memory 参数解析失败: {}", e))?;

    if let Some(ref id) = args.id {
        if !id.is_empty() {
            let memory = memory_repo::get_memory(conn, id)?;
            let content = memory.content.clone();
            memory_repo::delete_memory(conn, id)?;
            return Ok(format!("已从小本本中删除记忆：{}", content));
        }
    }

    let query = args.query.as_deref().unwrap_or("");
    if query.is_empty() {
        return Err("请提供 id 或 query 来指定要删除的记忆".to_string());
    }

    let results = memory_repo::search_memories(conn, query, None)?;

    if results.is_empty() {
        return Ok(format!("小本本中没有找到匹配[{}]的记忆。", query));
    }

    if results.len() == 1 {
        let m = &results[0];
        let content = m.content.clone();
        memory_repo::delete_memory(conn, &m.id)?;
        return Ok(format!("已从小本本中删除记忆：{}", content));
    }

    let mut msg = format!("找到{}条匹配[{}]的记忆，请告诉用户具体要删哪一条，然后用对应的 id 重新调用 delete_memory：\n\n", results.len(), query);
    for m in &results {
        let label = memory_type_label(&m.memory_type);
        msg.push_str(&format!("- [{}] {} (id: {})\n", label, m.content, m.id));
    }
    Err(msg)
}
