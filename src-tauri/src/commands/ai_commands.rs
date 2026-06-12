use tauri::{Emitter, State};

use serde_json::Value;
use crate::ai::client;
use crate::ai::{context, prompts, router, tool_executor, tools};
use std::path::Path;
use crate::commands::ai_tool_helper::{cleanup_orphaned_tool_calls, ensure_assistant_content, execute_async_tool};
use crate::db::connection::{AppDataState, DbState};
use crate::db::repositories::{ai_repo, memory_repo, setting_repo};

fn get_setting_or(conn: &rusqlite::Connection, key: &str, fallback: &str) -> String {
    setting_repo::get_setting(conn, key)
        .ok()
        .flatten()
        .map(|s| s.value)
        .unwrap_or_else(|| fallback.to_string())
}

/// 从 Option<Value> 中提取字符串用于 DB 存储
fn content_to_str(content: &Option<Value>) -> Option<&str> {
    content.as_ref().and_then(|v| {
        if let Value::String(s) = v { Some(s.as_str()) } else { None }
    })
}

/// 将 base64 data URI 图片保存到文件，返回相对路径列表
fn save_images_to_files(
    app_data_dir: &Path,
    conversation_id: &str,
    images: &[String],
) -> Vec<String> {
    let img_dir = app_data_dir.join("chat_images").join(conversation_id);
    if std::fs::create_dir_all(&img_dir).is_err() {
        return Vec::new();
    }

    let mut paths = Vec::new();
    for (i, data_uri) in images.iter().enumerate() {
        // 解析 data:image/jpeg;base64,xxx 格式
        let (mime, b64_data) = if let Some(pos) = data_uri.find(";base64,") {
            let mime_part = &data_uri[..pos];
            let mime = mime_part.strip_prefix("data:").unwrap_or("image/jpeg");
            (mime, &data_uri[pos + 8..])
        } else {
            ("image/jpeg", data_uri.as_str())
        };

        let ext = match mime {
            "image/png" => "png",
            "image/gif" => "gif",
            "image/webp" => "webp",
            _ => "jpg",
        };

        let filename = format!("img_{}_{}.{}", chrono::Local::now().timestamp_millis() + i as i64, nanoid::nanoid!(4), ext);
        let file_path = img_dir.join(&filename);

        use base64::Engine;
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64_data) {
            if std::fs::write(&file_path, &bytes).is_ok() {
                let relative = format!("chat_images/{}/{}", conversation_id, filename);
                paths.push(relative);
            }
        }
    }
    paths
}

/// 意图分析失败时，从用户消息关键词推断状态提示
fn infer_status_from_message(content: &str) -> Option<String> {
    let mut parts: Vec<&str> = Vec::new();
    if content.contains("任务") || content.contains("待办") || content.contains("todo") {
        parts.push("查看待办");
    }
    if content.contains("日程") || content.contains("日历") || content.contains("安排") {
        parts.push("翻看日历");
    }
    if content.contains("日记") || content.contains("回忆") || content.contains("记录") {
        parts.push("翻阅日记");
    }
    if content.contains("习惯") || content.contains("打卡") {
        parts.push("查看习惯");
    }
    if parts.is_empty() {
        return None;
    }
    Some(if parts.len() > 1 {
        format!("正在{}、{}...", parts[0], parts[1])
    } else {
        format!("正在{}...", parts[0])
    })
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

/// 核心命令：发送用户消息 → 两阶段调用（意图分析 + 增强回答）→ 自动执行查询工具 → 保存最终回复
///
/// 通过 Tauri 事件实时推送状态和流式 token：
/// - `ai:status` — 当前处理阶段（字符串）
/// - `ai:token`  — 流式输出的每个 token（字符串）
/// - `ai:done`   — 响应完成（null）
#[tauri::command]
pub async fn send_message(
    app_handle: tauri::AppHandle,
    state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    conversation_id: String,
    content: String,
    images: Option<Vec<String>>,
) -> Result<ai_repo::Message, String> {
    // 1. 保存用户消息 + 读取配置，然后释放锁（不能在 await 期间持锁）
    let has_images = images.as_ref().map_or(false, |v| !v.is_empty());
    // 图片存文件，DB 存路径引用
    let image_paths: Option<Vec<String>> = if has_images {
        Some(save_images_to_files(&app_data.dir, &conversation_id, images.as_ref().unwrap()))
    } else {
        None
    };

    let (personality, config, app_data_dir) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let images_json = image_paths.as_ref().map(|paths| serde_json::to_string(paths).unwrap_or_default());
        ai_repo::create_message_with_images(&conn, &conversation_id, "user", Some(&content), None, None, None, images_json.as_deref())?;
        let personality = get_setting_or(&conn, "ai.personality", "你是提灯，一盏有诗意的灯。说话轻盈、有画面感，情绪细腻，相信日常琐碎里藏着诗意。不用 emoji。");
        // 如果有图片且配置了视觉模型，使用视觉模型
        let config = if has_images {
            let vision_model = get_setting_or(&conn, "ai.vision_model", "");
            if !vision_model.is_empty() {
                let vision_api_url = get_setting_or(&conn, "ai.vision_api_url", "");
                let vision_api_key = get_setting_or(&conn, "ai.vision_api_key", "");
                client::AiConfig {
                    api_url: if vision_api_url.is_empty() { get_setting_or(&conn, "ai.api_url", "https://api.deepseek.com") } else { vision_api_url },
                    api_key: if vision_api_key.is_empty() { get_setting_or(&conn, "ai.api_key", "") } else { vision_api_key },
                    model: vision_model,
                }
            } else {
                client::AiConfig {
                    api_url: get_setting_or(&conn, "ai.api_url", "https://api.deepseek.com"),
                    api_key: get_setting_or(&conn, "ai.api_key", ""),
                    model: get_setting_or(&conn, "ai.model", "deepseek-v4-flash"),
                }
            }
        } else {
            client::AiConfig {
                api_url: get_setting_or(&conn, "ai.api_url", "https://api.deepseek.com"),
                api_key: get_setting_or(&conn, "ai.api_key", ""),
                model: get_setting_or(&conn, "ai.model", "deepseek-v4-flash"),
            }
        };
        (personality, config, app_data.dir.clone())
    };

    // 2. 第一阶段：意图分析（异步，不持锁，5秒超时自动降级）
    let _ = app_handle.emit("ai:status", "正在理解...");
    let intent_analysis = router::analyze_user_intent(&config, &content).await;

    // 3. 搜索上下文 + 构建系统提示词（需持锁）
    let (mut chat_messages, tool_defs) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;

        let system_prompt = match intent_analysis {
            Some(ref analysis) => {
                // 根据意图发出对应状态提示
                let mut status_parts: Vec<&str> = Vec::new();
                if !analysis.keywords.is_empty() {
                    status_parts.push("翻阅记忆");
                }
                if !analysis.journal_queries.is_empty() {
                    status_parts.push("轻轻翻阅日记");
                }
                if analysis.intent == router::IntentType::Task
                    || analysis.keywords.iter().any(|k| k.contains("任务") || k.contains("待办"))
                {
                    status_parts.push("查看待办");
                }
                if analysis.intent == router::IntentType::Schedule
                    || analysis.keywords.iter().any(|k| k.contains("日程") || k.contains("日历") || k.contains("安排"))
                {
                    status_parts.push("翻看日历");
                }
                let has_person = analysis.keywords.iter().any(|k| {
                    let len = k.chars().count();
                    len >= 2 && len <= 4
                        && k.chars().all(|c| c.is_ascii_alphanumeric() || ('\u{4e00}' <= c && c <= '\u{9fff}'))
                });
                if has_person {
                    status_parts.push("想起相关的人");
                }
                if !status_parts.is_empty() {
                    let status = if status_parts.len() > 1 {
                        format!("正在{}、{}...", status_parts[0], status_parts[1])
                    } else {
                        format!("正在{}...", status_parts[0])
                    };
                    let _ = app_handle.emit("ai:status", status);
                }

                let ctx = context::gather_context(&conn, &app_data_dir, analysis);
                prompts::build_enhanced_system_prompt(&conn, &personality, &ctx)
            }
            None => {
                // 意图分析超时/失败，从用户消息推断上下文状态
                let fallback_status = infer_status_from_message(&content);
                if let Some(status) = fallback_status {
                    let _ = app_handle.emit("ai:status", status);
                }

                let memories = memory_repo::list_memories_for_injection(&conn, 50).unwrap_or_default();
                prompts::build_system_prompt(&conn, &personality, &memories)
            }
        };

        let mut chat_messages: Vec<client::ChatMessage> = Vec::new();
        chat_messages.push(client::text_message("system", &system_prompt));

        let db_messages = ai_repo::list_messages(&conn, &conversation_id)?;
        for m in &db_messages {
            let tc: Option<Vec<serde_json::Value>> = m
                .tool_calls
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok());
            chat_messages.push(client::ChatMessage {
                role: m.role.clone(),
                content: m.content.clone().map(|s| Value::String(s)),
                tool_calls: tc,
                tool_call_id: m.tool_call_id.clone(),
                name: None,
                reasoning_content: m.reasoning_content.clone(),
            });
        }

        // 如果用户消息带图片，替换最后一条 user 消息为 multimodal 格式
        if has_images {
            // 从文件读取图片 base64 用于 API 请求
            use base64::Engine;
            let mut img_base64_list: Vec<String> = Vec::new();
            if let Some(ref paths) = image_paths {
                for rel_path in paths {
                    let full_path = app_data_dir.join(rel_path);
                    if let Ok(bytes) = std::fs::read(&full_path) {
                        let ext = full_path.extension().and_then(|e| e.to_str()).unwrap_or("jpg");
                        let mime = match ext {
                            "png" => "image/png",
                            "gif" => "image/gif",
                            "webp" => "image/webp",
                            _ => "image/jpeg",
                        };
                        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                        img_base64_list.push(format!("data:{};base64,{}", mime, b64));
                    }
                }
            }
            if !img_base64_list.is_empty() {
                if let Some(last_user) = chat_messages.iter_mut().rev().find(|m| m.role == "user") {
                    last_user.content = Some(client::multimodal_message("user", &content, &img_base64_list).content.unwrap());
                }
            }
        }

        cleanup_orphaned_tool_calls(&mut chat_messages);
        ensure_assistant_content(&mut chat_messages);

        let tool_defs = tools::get_tools(&conn);
        (chat_messages, tool_defs)
    };

    // 4. 调用 AI（流式模式，通过事件推送 token）
    let _ = app_handle.emit("ai:status", "正在输入中...");
    let handle = app_handle.clone();
    let on_token = move |token: String| {
        let _ = handle.emit("ai:token", token);
    };
    let mut ai_reply = match client::chat_completion(&config, chat_messages.clone(), Some(tool_defs.clone()), Some(&on_token)).await {
        Ok(reply) => reply,
        Err(e) => {
            if has_images && (e.contains("400") || e.contains("invalid") || e.contains("image") || e.contains("vision")) {
                return Err("当前模型不支持图片理解。请在「设置 → AI 助手设置 → 视觉辅助模型」中配置一个支持视觉的模型（如 gpt-4o），或将对话模型更换为支持视觉的模型。".to_string());
            }
            return Err(e);
        }
    };

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
                content_to_str(&ai_reply.content),
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
        let _ = app_handle.emit("ai:status", "正在查阅...");

        // 第一步：执行所有工具（不持有 DB 锁，避免 MutexGuard 跨 .await）
        let mut tool_results: Vec<(String, String)> = Vec::new(); // (tc_id, result)
        for tc in &parsed_tc {
            let tool_name = &tc.function.name;
            let tool_args = &tc.function.arguments;

            let result = if tool_executor::is_async_tool(tool_name) {
                execute_async_tool(tool_name, tool_args).await.unwrap_or_else(|e| e)
            } else {
                let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
                tool_executor::execute_tool(
                    &mut *conn, Some(&app_data_dir),
                    tool_name, tool_args,
                )
                .unwrap_or_else(|e| e)
            };
            tool_results.push((tc.id.clone(), result));
        }

        // 第二步：保存结果到 DB（持锁，无 .await）
        {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            for (tc_id, result) in &tool_results {
                ai_repo::create_message(
                    &conn, &conversation_id, "tool",
                    Some(result), None, Some(tc_id), None,
                )?;
            }
        }

        // 第三步：更新 chat_messages
        for (tc_id, result) in tool_results {
            chat_messages.push(client::ChatMessage {
                role: "tool".to_string(),
                content: Some(Value::String(result)),
                tool_calls: None,
                tool_call_id: Some(tc_id),
                name: None,
                reasoning_content: None,
            });
        }

        // 重新调用 AI（流式）
        let _ = app_handle.emit("ai:status", "正在输入中...");
        let handle2 = app_handle.clone();
        let on_token2 = move |token: String| {
            let _ = handle2.emit("ai:token", token);
        };
        ai_reply = client::chat_completion(&config, chat_messages.clone(), Some(tool_defs.clone()), Some(&on_token2)).await?;
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
            content_to_str(&ai_reply.content),
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

    let _ = app_handle.emit("ai:done", ());
    Ok(saved_msg)
}

// ========== 工具执行 + AI 跟进 ==========

fn build_chat_context(
    conn: &rusqlite::Connection,
    conversation_id: &str,
) -> Result<(Vec<client::ChatMessage>, client::AiConfig), String> {
    let personality = get_setting_or(
        conn,
        "ai.personality",
        "你是提灯，一盏有诗意的灯。说话轻盈、有画面感，情绪细腻，相信日常琐碎里藏着诗意。不用 emoji。",
    );
    let memories = memory_repo::list_memories_for_injection(conn, 50).unwrap_or_default();
    let system_prompt = prompts::build_system_prompt(conn, &personality, &memories);

    let mut chat_messages = vec![client::text_message("system", &system_prompt)];

    let db_messages = ai_repo::list_messages(conn, conversation_id)?;
    for m in &db_messages {
        let tc: Option<Vec<serde_json::Value>> = m
            .tool_calls
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());

        chat_messages.push(client::ChatMessage {
            role: m.role.clone(),
            content: m.content.clone().map(|s| Value::String(s)),
            tool_calls: tc,
            tool_call_id: m.tool_call_id.clone(),
            name: None,
            reasoning_content: m.reasoning_content.clone(),
        });
    }

    // 清理孤立的 tool_calls：如果 assistant 消息有 tool_calls 但后续没有对应的 tool 结果，
    // 则移除 tool_calls（避免 API 400 错误）
    cleanup_orphaned_tool_calls(&mut chat_messages);
    ensure_assistant_content(&mut chat_messages);

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
        // 读取工具调用列表（短时持锁）
        let tool_calls: Vec<tools::ToolCall> = {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            let ai_msg = ai_repo::get_message(&conn, &message_id)?;
            let tool_calls_str = ai_msg
                .tool_calls
                .ok_or("该消息不包含 tool_calls".to_string())?;
            serde_json::from_str(&tool_calls_str)
                .map_err(|e| format!("tool_calls 解析失败: {}", e))?
        };

        // 执行所有工具（不持有 DB 锁）
        let mut tool_results: Vec<(String, String)> = Vec::new();
        for tc in &tool_calls {
            let tool_name = &tc.function.name;
            let tool_args = &tc.function.arguments;
            let result = if tool_executor::is_async_tool(tool_name) {
                execute_async_tool(tool_name, tool_args).await.unwrap_or_else(|e| e)
            } else {
                let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
                tool_executor::execute_tool(&mut *conn, Some(&app_data.dir.clone()), tool_name, tool_args)
                    .unwrap_or_else(|e| e)
            };
            tool_results.push((tc.id.clone(), result));
        }

        // 保存结果到 DB
        {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            for (tc_id, result) in &tool_results {
                ai_repo::create_message(&conn, &conversation_id, "tool", Some(result), None, Some(tc_id), None)?;
            }
        }

        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let (_, config) = build_chat_context(&conn, &conversation_id)?;
        config
    };

    // 2. 构建聊天上下文 + 调 AI 跟进（带工具，AI 可能继续调下一步）
    let (chat_messages, tool_defs) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let (msgs, _) = build_chat_context(&conn, &conversation_id)?;
        (msgs, tools::get_tools(&conn))
    };

    let follow_up_msg = match client::chat_completion(&config, chat_messages, Some(tool_defs), None).await {
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
        content_to_str(&follow_up_msg.content),
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
        let tool_defs = tools::get_tools(&conn);

        let config = client::AiConfig {
            api_url: get_setting_or(&conn, "ai.api_url", "https://api.deepseek.com"),
            api_key: get_setting_or(&conn, "ai.api_key", ""),
            model: get_setting_or(&conn, "ai.model", "deepseek-v4-flash"),
        };

        (chat_messages, config, tool_defs)
    };

    // 2. 调 AI 重新生成（带工具定义，AI 可能更新 tool_calls）
    let ai_reply = client::chat_completion(&config, chat_messages, Some(tool_defs), None).await?;

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
        content_to_str(&ai_reply.content),
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
    // 读取工具调用列表（短时持锁）
    let (tc_id, tool_name, tool_args_owned) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let ai_msg = ai_repo::get_message(&conn, &message_id)?;
        let tool_calls_str = ai_msg
            .tool_calls
            .ok_or("该消息不包含 tool_calls".to_string())?;
        let tool_calls: Vec<tools::ToolCall> =
            serde_json::from_str(&tool_calls_str)
                .map_err(|e| format!("tool_calls 解析失败: {}", e))?;
        let target = tool_calls
            .into_iter()
            .find(|tc| tc.id == tool_call_id)
            .ok_or(format!("找不到指定的工具调用: {}", tool_call_id))?;
        (target.id, target.function.name, target.function.arguments)
    };

    // 执行工具（不持有 DB 锁）
    let result = if tool_executor::is_async_tool(&tool_name) {
        execute_async_tool(&tool_name, &tool_args_owned).await.unwrap_or_else(|e| e)
    } else {
        let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
        tool_executor::execute_tool(&mut *conn, Some(&app_data.dir.clone()), &tool_name, &tool_args_owned)
            .unwrap_or_else(|e| e)
    };

    // 保存结果到 DB
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    ai_repo::create_message(
        &conn,
        &conversation_id,
        "tool",
        Some(&result),
        None,
        Some(&tc_id),
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
    let (chat_messages, config, tool_defs) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let (msgs, cfg) = build_chat_context(&conn, &conversation_id)?;
        (msgs, cfg, tools::get_tools(&conn))
    };
    let follow_up_msg = match client::chat_completion(&config, chat_messages, Some(tool_defs), None).await {
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
        content_to_str(&follow_up_msg.content),
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
        (msgs, tools::get_tools(&conn))
    };

    let follow_up_msg = match client::chat_completion(&config, chat_messages, Some(tool_defs), None).await {
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
        content_to_str(&follow_up_msg.content),
        tool_calls_json.as_deref(),
        None,
        follow_up_msg.reasoning_content.as_deref(),
    )?;
    ai_repo::list_messages(&conn, &conversation_id)
}

/// 测试 AI API 连通性：发一个极轻量请求，验证 URL + Key 是否可用
#[tauri::command]
pub async fn test_ai_connection(
    api_url: String,
    api_key: String,
    model: String,
) -> Result<String, String> {
    let config = client::AiConfig {
        api_url,
        api_key,
        model,
    };
    let messages = vec![client::text_message("user", "hi")];
    // 用非流式模式，限制超时 15 秒
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let url = format!("{}/chat/completions", config.api_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": config.model,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 5,
    });

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("timeout") || msg.contains("Timeout") {
                "连接超时，请检查 API 地址".to_string()
            } else if msg.contains("refused") || msg.contains("resolve") || msg.contains("dns") {
                "无法连接，请检查 API 地址".to_string()
            } else {
                format!("连接失败: {}", msg)
            }
        })?;

    let status = resp.status();
    if status.is_success() {
        Ok("连接成功".to_string())
    } else {
        let err_text = resp.text().await.unwrap_or_default();
        let msg = match status.as_u16() {
            401 | 403 => "API Key 无效".to_string(),
            404 => "API 地址无效（404）".to_string(),
            429 => "请求频率超限，请稍后重试".to_string(),
            _ => format!("服务器返回错误 {}: {}", status.as_u16(), err_text.chars().take(100).collect::<String>()),
        };
        Err(msg)
    }
}

/// 读取聊天图片文件并返回 base64 data URI（用于前端显示）
#[tauri::command]
pub async fn get_chat_image_data(
    app_data: State<'_, AppDataState>,
    file_path: String,
) -> Result<String, String> {
    let full_path = app_data.dir.join(&file_path);
    let data = std::fs::read(&full_path)
        .map_err(|e| format!("读取图片失败: {}", e))?;

    let mime = match full_path.extension().and_then(|e| e.to_str()) {
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        _ => "image/jpeg",
    };

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}
