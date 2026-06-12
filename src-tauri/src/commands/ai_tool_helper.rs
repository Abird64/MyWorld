use serde_json::Value;
use crate::ai::client;
use crate::ai::tool_executor::aihot;

/// 异步执行需要 HTTP 请求的工具（如 search_ai_news）
/// 使用 spawn_blocking 在独立线程池中执行阻塞 I/O，避免阻塞 tokio 运行时
pub async fn execute_async_tool(name: &str, arguments: &str) -> Result<String, String> {
    match name {
        "search_ai_news" => {
            let args = arguments.to_string();
            tokio::task::spawn_blocking(move || aihot::execute_search_ai_news_sync(&args))
                .await
                .map_err(|e| format!("任务执行失败: {}", e))?
        }
        _ => Err(format!("{} 不是异步工具", name)),
    }
}

/// 检查 content Value 是否为空（None、空字符串、或 null）
fn is_content_empty(content: &Option<Value>) -> bool {
    match content {
        None => true,
        Some(Value::String(s)) => s.is_empty(),
        Some(Value::Null) => true,
        _ => false,
    }
}

/// 清理孤立的 tool_calls：如果 assistant 消息有 tool_calls 但后续没有对应的 tool 结果，
/// 则移除 tool_calls。这避免了 API 返回 400 错误（"assistant with tool_calls must be followed by tool messages"）。
pub fn cleanup_orphaned_tool_calls(messages: &mut Vec<client::ChatMessage>) {
    let len = messages.len();
    for i in 0..len {
        // 只处理有 tool_calls 的 assistant 消息
        let has_tc = messages[i].role == "assistant"
            && messages[i].tool_calls.as_ref().map_or(false, |tc| !tc.is_empty());
        if !has_tc {
            continue;
        }

        // 收集这条 assistant 消息的所有 tool_call_id
        let tc_ids: std::collections::HashSet<String> = messages[i]
            .tool_calls
            .as_ref()
            .unwrap()
            .iter()
            .filter_map(|tc| tc.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();

        // 检查后续消息中是否有对应的 tool 结果
        let mut matched_ids = std::collections::HashSet::new();
        for j in (i + 1)..len {
            if messages[j].role != "tool" {
                break; // tool 消息必须紧跟 assistant 消息
            }
            if let Some(ref tid) = messages[j].tool_call_id {
                if tc_ids.contains(tid) {
                    matched_ids.insert(tid.clone());
                }
            }
        }

        // 如果有未匹配的 tool_call_id，清除 tool_calls
        if matched_ids.len() < tc_ids.len() {
            log::warn!(
                "[cleanup] assistant msg at index {} has {} tool_calls but only {} matched tool results, clearing tool_calls",
                i, tc_ids.len(), matched_ids.len()
            );
            messages[i].tool_calls = None;
            // 如果 content 也是空的，给一个占位内容，避免 API 报错 "content or tool_calls must be set"
            if is_content_empty(&messages[i].content) {
                messages[i].content = Some(Value::String("(工具调用已过期)".to_string()));
            }
        }
    }
}

/// 兜底：确保所有 assistant 消息都有 content 或 tool_calls（API 硬性要求）
pub fn ensure_assistant_content(messages: &mut Vec<client::ChatMessage>) {
    for msg in messages.iter_mut() {
        if msg.role == "assistant" {
            let has_content = !is_content_empty(&msg.content);
            let has_tc = msg.tool_calls.as_ref().map_or(false, |tc| !tc.is_empty());
            if !has_content && !has_tc {
                msg.content = Some(Value::String("...".to_string()));
            }
        }
    }
}
