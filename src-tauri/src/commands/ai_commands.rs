use tauri::State;

use crate::ai::client;
use crate::ai::{prompts, tool_executor, tools};
use crate::db::connection::{AppDataState, DbState};
use crate::db::repositories::{ai_repo, memory_repo, setting_repo};

fn get_setting_or(conn: &rusqlite::Connection, key: &str, fallback: &str) -> String {
    setting_repo::get_setting(conn, key)
        .ok()
        .flatten()
        .map(|s| s.value)
        .unwrap_or_else(|| fallback.to_string())
}

#[tauri::command]
pub fn create_conversation(
    state: State<'_, DbState>,
    title: Option<String>,
) -> Result<ai_repo::Conversation, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    ai_repo::create_conversation(&conn, title.as_deref())
}

#[tauri::command]
pub fn list_conversations(
    state: State<'_, DbState>,
) -> Result<Vec<ai_repo::Conversation>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    ai_repo::list_conversations(&conn)
}

#[tauri::command]
pub fn delete_conversation(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    ai_repo::delete_conversation(&conn, &id)
}

#[tauri::command]
pub fn rename_conversation(
    state: State<'_, DbState>,
    id: String,
    title: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    ai_repo::rename_conversation(&conn, &id, &title)
}

#[tauri::command]
pub fn list_messages(
    state: State<'_, DbState>,
    conversation_id: String,
) -> Result<Vec<ai_repo::Message>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    ai_repo::list_messages(&conn, &conversation_id)
}

/// 核心命令：发送用户消息 → 调用 AI → 自动执行查询工具 → 保存最终回复
#[tauri::command]
pub async fn send_message(
    state: State<'_, DbState>,
    conversation_id: String,
    content: String,
) -> Result<ai_repo::Message, String> {
    // 1. 保存用户消息 + 构建系统提示词 + 读取配置，然后释放锁
    let (mut chat_messages, config, tool_defs) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;

        ai_repo::create_message(&conn, &conversation_id, "user", Some(&content), None, None, None)?;

        let personality = get_setting_or(&conn, "ai.personality", "你是一个温暖的人生管理助手，名叫提灯。");
        let memories = memory_repo::list_memories_for_injection(&conn, 50).unwrap_or_default();
        let system_prompt = prompts::build_system_prompt(&conn, &personality, &memories);

        let mut chat_messages: Vec<client::ChatMessage> = Vec::new();
        chat_messages.push(client::ChatMessage {
            role: "system".to_string(),
            content: Some(system_prompt),
            tool_calls: None,
            tool_call_id: None,
            name: None,
            reasoning_content: None,
        });

        let db_messages = ai_repo::list_messages(&conn, &conversation_id)?;
        for m in &db_messages {
            let tc: Option<Vec<serde_json::Value>> = m
                .tool_calls
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok());
            chat_messages.push(client::ChatMessage {
                role: m.role.clone(),
                content: m.content.clone(),
                tool_calls: tc,
                tool_call_id: m.tool_call_id.clone(),
                name: None,
                reasoning_content: m.reasoning_content.clone(),
            });
        }

        let tool_defs = tools::get_tools();
        let config = client::AiConfig {
            api_url: get_setting_or(&conn, "ai.api_url", "https://api.deepseek.com"),
            api_key: get_setting_or(&conn, "ai.api_key", ""),
            model: get_setting_or(&conn, "ai.model", "deepseek-v4-flash"),
        };

        (chat_messages, config, tool_defs)
    };

    // 2. 调用 AI（不持有锁，带工具定义）
    let mut ai_reply = client::chat_completion(&config, chat_messages.clone(), Some(tool_defs.clone())).await?;

    // 3. 自动执行查询工具的循环（最多3轮，防止无限循环）
    const MAX_AUTO_ROUNDS: usize = 3;
    for _round in 0..MAX_AUTO_ROUNDS {
        let current_tool_calls = match &ai_reply.tool_calls {
            Some(tc) if !tc.is_empty() => tc.clone(),
            _ => break,
        };

        // 解析为 ToolCall 以检查工具类型
        let parsed_tc: Vec<tools::ToolCall> = serde_json::from_str(
            &serde_json::to_string(&current_tool_calls).unwrap_or_default()
        ).unwrap_or_default();

        // 检查是否全是查询工具（只读、安全，无需用户确认）
        let all_query = parsed_tc.iter().all(|tc| tools::is_query_tool(&tc.function.name));
        if !all_query {
            break;
        }

        // 保存 AI 的这条回复（含查询 tool_calls）
        let tc_json = serde_json::to_string(&current_tool_calls).unwrap_or_default();
        {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            ai_repo::create_message(
                &conn, &conversation_id, "assistant",
                ai_reply.content.as_deref(),
                Some(&tc_json), None,
                ai_reply.reasoning_content.as_deref(),
            )?;
        }

        // 把 assistant 消息（含 tool_calls）追加到 chat_messages（必须在 tool 结果之前）
        chat_messages.push(client::ChatMessage {
            role: "assistant".to_string(),
            content: ai_reply.content.clone(),
            tool_calls: Some(current_tool_calls),
            tool_call_id: None,
            name: None,
            reasoning_content: ai_reply.reasoning_content.clone(),
        });

        // 执行查询工具 + 保存 tool 结果 + 更新 chat_messages
        {
            let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
            for tc in &parsed_tc {
                let result = tool_executor::execute_tool(
                    &mut *conn, None,
                    &tc.function.name,
                    &tc.function.arguments,
                )
                .unwrap_or_else(|e| e);

                ai_repo::create_message(
                    &conn, &conversation_id, "tool",
                    Some(&result), None, Some(&tc.id), None,
                )?;

                chat_messages.push(client::ChatMessage {
                    role: "tool".to_string(),
                    content: Some(result),
                    tool_calls: None,
                    tool_call_id: Some(tc.id.clone()),
                    name: None,
                    reasoning_content: None,
                });
            }
        }

        // 重新调用 AI
        ai_reply = client::chat_completion(&config, chat_messages.clone(), Some(tool_defs.clone())).await?;
    }

    // 4. 保存最终 AI 回复
    let saved_msg = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let tool_calls_json = ai_reply
            .tool_calls
            .as_ref()
            .map(|tc| serde_json::to_string(tc).unwrap_or_default());

        ai_repo::create_message(
            &conn,
            &conversation_id,
            "assistant",
            ai_reply.content.as_deref(),
            tool_calls_json.as_deref(),
            None,
            ai_reply.reasoning_content.as_deref(),
        )?
    };

    // 5. 自动生成标题
    {
        let needs_title = {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            let conv = ai_repo::get_conversation(&conn, &conversation_id)?;
            conv.title == "新对话"
        };
        if needs_title {
            let first_user_content = {
                let conn = state.conn.lock().map_err(|e| e.to_string())?;
                let msgs = ai_repo::list_messages(&conn, &conversation_id)?;
                msgs.iter()
                    .find(|m| m.role == "user")
                    .and_then(|m| m.content.clone())
            };
            if let Some(user_msg) = first_user_content {
                match client::generate_title(&config, &user_msg).await {
                    Ok(title) => {
                        if let Ok(conn) = state.conn.lock() {
                            let _ = ai_repo::rename_conversation(&conn, &conversation_id, &title);
                        }
                    }
                    Err(_) => {}
                }
            }
        }
    }

    Ok(saved_msg)
}

// ========== 工具执行 + AI 跟进 ==========

/// 构建发送给 AI 的完整消息上下文（系统提示词 + 历史消息 + 配置）
fn build_chat_context(
    conn: &rusqlite::Connection,
    conversation_id: &str,
) -> Result<(Vec<client::ChatMessage>, client::AiConfig), String> {
    let personality = get_setting_or(
        conn,
        "ai.personality",
        "你是一个温暖的人生管理助手，名叫提灯。",
    );
    let memories = memory_repo::list_memories_for_injection(conn, 50).unwrap_or_default();
    let system_prompt = prompts::build_system_prompt(conn, &personality, &memories);

    let mut chat_messages = vec![client::ChatMessage {
        role: "system".to_string(),
        content: Some(system_prompt),
        tool_calls: None,
        tool_call_id: None,
        name: None,
        reasoning_content: None,
    }];

    let db_messages = ai_repo::list_messages(conn, conversation_id)?;
    for m in &db_messages {
        let tc: Option<Vec<serde_json::Value>> = m
            .tool_calls
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());

        chat_messages.push(client::ChatMessage {
            role: m.role.clone(),
            content: m.content.clone(),
            tool_calls: tc,
            tool_call_id: m.tool_call_id.clone(),
            name: None,
            reasoning_content: m.reasoning_content.clone(),
        });
    }

    let config = client::AiConfig {
        api_url: get_setting_or(conn, "ai.api_url", "https://api.deepseek.com"),
        api_key: get_setting_or(conn, "ai.api_key", ""),
        model: get_setting_or(conn, "ai.model", "deepseek-v4-flash"),
    };

    Ok((chat_messages, config))
}

/// 用户确认执行工具调用
///
/// 1. 解析 AI 消息中的 tool_calls
/// 2. 逐个执行工具，写入 tool 角色消息
/// 3. 调 AI 跟进回复（不带工具）
/// 4. 返回对话全部消息
#[tauri::command]
pub async fn execute_tool_calls(
    state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    conversation_id: String,
    message_id: String,
) -> Result<Vec<ai_repo::Message>, String> {
    // 1. 执行工具 + 获取配置
    let config = {
        let mut conn = state.conn.lock().map_err(|e| e.to_string())?;

        let ai_msg = ai_repo::get_message(&conn, &message_id)?;
        let tool_calls_str = ai_msg
            .tool_calls
            .ok_or("该消息不包含 tool_calls".to_string())?;

        let tool_calls: Vec<tools::ToolCall> =
            serde_json::from_str(&tool_calls_str)
                .map_err(|e| format!("tool_calls 解析失败: {}", e))?;

        for tc in &tool_calls {
            let app_data_path = app_data.dir.clone();
            let result = tool_executor::execute_tool(
                &mut *conn,
                Some(&app_data_path),
                &tc.function.name,
                &tc.function.arguments,
            )
            .unwrap_or_else(|e| e);

            ai_repo::create_message(
                &conn,
                &conversation_id,
                "tool",
                Some(&result),
                None,
                Some(&tc.id),
                None,
            )?;
        }

        drop(conn);
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let (_, config) = build_chat_context(&conn, &conversation_id)?;
        config
    };

    // 2. 构建聊天上下文 + 调 AI 跟进（带工具，AI 可能继续调下一步）
    let (chat_messages, tool_defs) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let (msgs, _) = build_chat_context(&conn, &conversation_id)?;
        (msgs, tools::get_tools())
    };

    let follow_up_msg = match client::chat_completion(&config, chat_messages, Some(tool_defs)).await {
        Ok(msg) => msg,
        Err(e) => {
            let conn = state.conn.lock().map_err(|err| err.to_string())?;
            let fallback = format!("抱歉，AI 服务暂时不可用（{}）。不过你的操作已经完成了。", e);
            ai_repo::create_message(&conn, &conversation_id, "assistant", Some(&fallback), None, None, None)?;
            return ai_repo::list_messages(&conn, &conversation_id);
        }
    };

    // 3. 保存 AI 跟进 + 返回全部消息
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tool_calls_json = follow_up_msg
        .tool_calls
        .as_ref()
        .map(|tc| serde_json::to_string(tc).unwrap_or_default());
    ai_repo::create_message(
        &conn,
        &conversation_id,
        "assistant",
        follow_up_msg.content.as_deref(),
        tool_calls_json.as_deref(),
        None,
        follow_up_msg.reasoning_content.as_deref(),
    )?;
    ai_repo::list_messages(&conn, &conversation_id)
}

/// 用户对工具调用卡片提出修改意见
///
/// 取消未执行的 tool_calls → 写入用户反馈 → AI 重新生成 → 返回全部消息
#[tauri::command]
pub async fn modify_tool_calls(
    state: State<'_, DbState>,
    conversation_id: String,
    feedback: String,
    message_id: Option<String>,
    tool_call_id: Option<String>,
) -> Result<Vec<ai_repo::Message>, String> {
    // 1. 取消指定的 tool_call + 保存反馈 + 构建上下文
    let (chat_messages, config, tool_defs) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;

        // 查找对应 message 中的 tool_calls，取消指定或全部
        {
            let msgs = ai_repo::list_messages(&conn, &conversation_id)?;

            // 如果指定了 message_id，精确定位；否则回退到最后一个有 tool_calls 的 assistant 消息
            let target_msg: Option<&ai_repo::Message> = if let Some(ref mid) = message_id {
                msgs.iter().find(|m| m.id == *mid)
            } else {
                msgs.iter().rev().find(|m| m.role == "assistant" && m.tool_calls.is_some())
            };

            if let Some(target) = target_msg {
                let Some(last_idx) = msgs.iter().position(|m| m.id == target.id) else {
                    return Err("找不到 assistant 消息位置".to_string());
                };
                let has_tool_after = msgs[last_idx + 1..].iter().any(|m| m.role == "tool");
                if !has_tool_after {
                    let tool_calls: Vec<tools::ToolCall> =
                        serde_json::from_str(target.tool_calls.as_deref().unwrap_or("[]"))
                            .unwrap_or_default();

                    // 如果指定了 tool_call_id，只取消那一个；否则全部取消
                    let calls_to_cancel: Vec<&tools::ToolCall> =
                        if let Some(ref tid) = tool_call_id {
                            tool_calls.iter().filter(|tc| tc.id == *tid).collect()
                        } else {
                            tool_calls.iter().collect()
                        };

                    for tc in &calls_to_cancel {
                        ai_repo::create_message(
                            &conn,
                            &conversation_id,
                            "tool",
                            Some("[用户要求修改，此操作已取消]"),
                            None,
                            Some(&tc.id),
                            None,
                        )?;
                    }
                }
            }
        }

        // 保存用户反馈
        ai_repo::create_message(
            &conn,
            &conversation_id,
            "user",
            Some(&feedback),
            None,
            None,
            None,
        )?;

        let (chat_messages, _) = build_chat_context(&conn, &conversation_id)?;
        let tool_defs = tools::get_tools();

        let config = client::AiConfig {
            api_url: get_setting_or(&conn, "ai.api_url", "https://api.deepseek.com"),
            api_key: get_setting_or(&conn, "ai.api_key", ""),
            model: get_setting_or(&conn, "ai.model", "deepseek-v4-flash"),
        };

        (chat_messages, config, tool_defs)
    };

    // 2. 调 AI 重新生成（带工具定义，AI 可能更新 tool_calls）
    let ai_reply = client::chat_completion(&config, chat_messages, Some(tool_defs)).await?;

    // 3. 保存 AI 回复 + 返回全部消息
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tool_calls_json = ai_reply
        .tool_calls
        .as_ref()
        .map(|tc| serde_json::to_string(tc).unwrap_or_default());

    ai_repo::create_message(
        &conn,
        &conversation_id,
        "assistant",
        ai_reply.content.as_deref(),
        tool_calls_json.as_deref(),
        None,
        ai_reply.reasoning_content.as_deref(),
    )?;
    ai_repo::list_messages(&conn, &conversation_id)
}
/// 用户确认执行单个工具调用（不触发 AI 跟进）
#[tauri::command]
pub async fn execute_single_tool_call(
    state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    conversation_id: String,
    message_id: String,
    tool_call_id: String,
) -> Result<Vec<ai_repo::Message>, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;

    let ai_msg = ai_repo::get_message(&conn, &message_id)?;
    let tool_calls_str = ai_msg
        .tool_calls
        .ok_or("该消息不包含 tool_calls".to_string())?;

    let tool_calls: Vec<tools::ToolCall> =
        serde_json::from_str(&tool_calls_str)
            .map_err(|e| format!("tool_calls 解析失败: {}", e))?;

    let target = tool_calls
        .iter()
        .find(|tc| tc.id == tool_call_id)
        .ok_or(format!("找不到指定的工具调用: {}", tool_call_id))?;

    let app_data_path = app_data.dir.clone();
    let result = tool_executor::execute_tool(
        &mut *conn,
        Some(&app_data_path),
        &target.function.name,
        &target.function.arguments,
    )
    .unwrap_or_else(|e| e);

    ai_repo::create_message(
        &conn,
        &conversation_id,
        "tool",
        Some(&result),
        None,
        Some(&target.id),
        None,
    )?;

    ai_repo::list_messages(&conn, &conversation_id)
}

/// 所有工具执行完毕后，触发 AI 跟进回复
#[tauri::command]
pub async fn finalize_tool_calls(
    state: State<'_, DbState>,
    conversation_id: String,
) -> Result<Vec<ai_repo::Message>, String> {
    let (chat_messages, config) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        build_chat_context(&conn, &conversation_id)?
    };

    let tool_defs = tools::get_tools();
    let follow_up_msg = match client::chat_completion(&config, chat_messages, Some(tool_defs)).await {
        Ok(msg) => msg,
        Err(e) => {
            let conn = state.conn.lock().map_err(|err| err.to_string())?;
            let fallback = format!("抱歉，AI 服务暂时不可用（{}）。不过你的操作已经完成了。", e);
            ai_repo::create_message(&conn, &conversation_id, "assistant", Some(&fallback), None, None, None)?;
            return ai_repo::list_messages(&conn, &conversation_id);
        }
    };

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tool_calls_json = follow_up_msg
        .tool_calls
        .as_ref()
        .map(|tc| serde_json::to_string(tc).unwrap_or_default());
    ai_repo::create_message(
        &conn,
        &conversation_id,
        "assistant",
        follow_up_msg.content.as_deref(),
        tool_calls_json.as_deref(),
        None,
        follow_up_msg.reasoning_content.as_deref(),
    )?;
    ai_repo::list_messages(&conn, &conversation_id)
}

/// 用户取消工具调用

/// 写入取消信息为 tool 消息，让 AI 知道用户拒绝了
#[tauri::command]
pub async fn cancel_tool_calls(
    state: State<'_, DbState>,
    conversation_id: String,
    message_id: String,
    tool_call_id: Option<String>,
) -> Result<Vec<ai_repo::Message>, String> {
    // 1. 写入取消 tool 消息 + 获取配置
    let config = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;

        let ai_msg = ai_repo::get_message(&conn, &message_id)?;
        let tool_calls_str = ai_msg
            .tool_calls
            .ok_or("该消息不包含 tool_calls".to_string())?;

        let tool_calls: Vec<tools::ToolCall> =
            serde_json::from_str(&tool_calls_str)
                .map_err(|e| format!("tool_calls 解析失败: {}", e))?;

        // 如果指定了 tool_call_id，只取消那一个；否则全部取消
        let calls_to_cancel: Vec<&tools::ToolCall> = if let Some(ref tc_id) = tool_call_id {
            tool_calls.iter().filter(|tc| tc.id == *tc_id).collect()
        } else {
            tool_calls.iter().collect()
        };

        if calls_to_cancel.is_empty() && tool_call_id.is_some() {
            return Err("未找到指定的 tool_call".to_string());
        }

        for tc in &calls_to_cancel {
            ai_repo::create_message(
                &conn,
                &conversation_id,
                "tool",
                Some("[用户取消了此操作]"),
                None,
                Some(&tc.id),
                None,
            )?;
        }

        drop(conn);
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let (_, config) = build_chat_context(&conn, &conversation_id)?;
        config
    };

    // 2. 构建上下文 + 调 AI 跟进（带工具）
    let (chat_messages, tool_defs) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let (msgs, _) = build_chat_context(&conn, &conversation_id)?;
        (msgs, tools::get_tools())
    };

    let follow_up_msg = match client::chat_completion(&config, chat_messages, Some(tool_defs)).await {
        Ok(msg) => msg,
        Err(e) => {
            let conn = state.conn.lock().map_err(|err| err.to_string())?;
            let fallback = format!("抱歉，AI 服务暂时不可用（{}）。", e);
            ai_repo::create_message(&conn, &conversation_id, "assistant", Some(&fallback), None, None, None)?;
            return ai_repo::list_messages(&conn, &conversation_id);
        }
    };

    // 3. 保存 AI 跟进 + 返回全部消息
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tool_calls_json = follow_up_msg
        .tool_calls
        .as_ref()
        .map(|tc| serde_json::to_string(tc).unwrap_or_default());
    ai_repo::create_message(
        &conn,
        &conversation_id,
        "assistant",
        follow_up_msg.content.as_deref(),
        tool_calls_json.as_deref(),
        None,
        follow_up_msg.reasoning_content.as_deref(),
    )?;
    ai_repo::list_messages(&conn, &conversation_id)
}
