use crate::ai::client::{self, text_message};
use crate::ai::{prompts, tools};
use crate::db::connection::{AppDataState, DbState};
use crate::db::repositories::{journal_repo, setting_repo, task_repo, schedule_repo, contact_repo};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::State;

#[derive(Deserialize)]
pub struct GetJournalInput {
    pub date: String,
}

#[derive(Deserialize)]
pub struct SaveJournalInput {
    pub date: String,
    pub content: String,
    pub mood: Option<String>,
}

#[derive(Deserialize)]
pub struct GetTimelineInput {
    pub year: i32,
    pub month: i32,
}

#[derive(Deserialize)]
pub struct GetAiDiaryInput {
    pub date: String,
}

#[derive(Deserialize)]
pub struct SaveAiDiaryInput {
    pub date: String,
    pub content: String,
}

/// 获取或创建指定日期的日记（返回元数据 + 文件内容）
#[tauri::command]
pub fn get_journal_by_date(
    db_state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    input: GetJournalInput,
) -> Result<serde_json::Value, String> {
    let conn = db_state
        .conn
        .lock()
        .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;

    let journal =
        journal_repo::get_or_create_journal(&conn, &app_data.dir, &input.date)?;

    let content = journal_repo::read_md_file(PathBuf::from(&journal.file_path).as_path())?;

    serde_json::to_value(serde_json::json!({
        "journal": journal,
        "content": content,
    }))
    .map_err(|e| e.to_string())
}

/// 保存日记内容（写 .md 文件 + 更新 DB 元数据）
#[tauri::command]
pub fn save_journal(
    db_state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    input: SaveJournalInput,
) -> Result<serde_json::Value, String> {
    let conn = db_state
        .conn
        .lock()
        .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;

    // 确保 journal 记录存在
    let journal =
        journal_repo::get_or_create_journal(&conn, &app_data.dir, &input.date)?;

    // 计算字数
    let word_count = if input.content.trim().is_empty() {
        0
    } else {
        input.content.split_whitespace().count() as i32
    };

    // 写入 .md 文件
    let file_path = PathBuf::from(&journal.file_path);
    let actual_path = journal_repo::write_md_file(
        &file_path,
        &input.date,
        input.mood.as_deref(),
        journal.tags.as_deref(),
        word_count,
        "user",
        &input.content,
    )?;

    // 如果降级到了新路径，更新 DB
    if actual_path != file_path {
        let _ = journal_repo::update_journal_file_path(&conn, &journal.id, &actual_path);
    }

    // 更新 DB 元数据
    let title = if input.content.trim().is_empty() {
        None
    } else {
        // 取第一行作为标题（最多30字）
        let first_line = input.content.lines().next().unwrap_or("");
        let title_text: String = first_line.chars().take(30).collect();
        Some(format!("{} 尘笺", if title_text.is_empty() { &input.date } else { &title_text }))
    };

    let updated = journal_repo::update_journal_metadata(
        &conn,
        &journal.id,
        title.as_deref(),
        input.mood.as_deref(),
        None,
        word_count,
    )?;

    serde_json::to_value(updated).map_err(|e| e.to_string())
}

/// 获取某月有日记的日期列表
#[tauri::command]
pub fn get_timeline(
    db_state: State<'_, DbState>,
    input: GetTimelineInput,
) -> Result<serde_json::Value, String> {
    let conn = db_state
        .conn
        .lock()
        .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;

    let dates = journal_repo::get_timeline_entries(&conn, input.year, input.month)?;
    serde_json::to_value(dates).map_err(|e| e.to_string())
}

/// 获取指定日期的 AI 尘笺
#[tauri::command]
pub fn get_ai_diary(
    _db_state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    input: GetAiDiaryInput,
) -> Result<serde_json::Value, String> {
    let ai_path = journal_repo::date_to_file_path(&app_data.dir, &input.date, true);

    if ai_path.exists() {
        let content = journal_repo::read_md_file(&ai_path)?;
        let exists = !content.trim().is_empty();
        serde_json::to_value(serde_json::json!({
            "content": content,
            "exists": exists,
        }))
    } else {
        serde_json::to_value(serde_json::json!({
            "content": "",
            "exists": false,
        }))
    }
    .map_err(|e| e.to_string())
}

/// 保存 AI 尘笺
#[tauri::command]
pub fn save_ai_diary(
    db_state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    input: SaveAiDiaryInput,
) -> Result<(), String> {
    let conn = db_state
        .conn
        .lock()
        .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;

    // 确保 AI 日记 DB 记录存在
    journal_repo::save_ai_diary_meta(&conn, &app_data.dir, &input.date)?;

    // 写入 .md 文件
    let ai_path = journal_repo::date_to_file_path(&app_data.dir, &input.date, true);
    let word_count = if input.content.trim().is_empty() {
        0
    } else {
        input.content.split_whitespace().count() as i32
    };

    journal_repo::write_md_file(
        &ai_path,
        &input.date,
        None,
        None,
        word_count,
        "ai",
        &input.content,
    )?;

    Ok(())
}

/// 日记 XP 结算（日省按钮触发）
#[tauri::command]
pub fn complete_diary(
    db_state: State<'_, DbState>,
    input: GetJournalInput,
) -> Result<serde_json::Value, String> {
    let mut conn = db_state
        .conn
        .lock()
        .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;

    let result = journal_repo::complete_diary(&mut conn, &input.date)?;
    serde_json::to_value(result).map_err(|e| e.to_string())
}

fn get_setting_or(conn: &rusqlite::Connection, key: &str, fallback: &str) -> String {
    setting_repo::get_setting(conn, key)
        .ok()
        .flatten()
        .map(|s| s.value)
        .unwrap_or_else(|| fallback.to_string())
}

fn format_tasks_for_reflection(tasks: &[task_repo::Task]) -> String {
    let mut lines = Vec::new();
    for t in tasks {
        let status_icon = match t.status.as_str() {
            "completed" => "[已完成]",
            "in_progress" => "[进行中]",
            "pending" => "[待办]",
            _ => "",
        };
        let mut line = format!("{} {}", status_icon, t.title);
        if let Some(ref p) = t.priority {
            if p != "none" {
                let label = match p.as_str() {
                    "high" => "紧急", "medium" => "重要", "low" => "一般", _ => p,
                };
                line.push_str(&format!(" [{}]", label));
            }
        }
        if let Some(ref d) = t.deadline {
            line.push_str(&format!(" 截止:{}", d));
        }
        lines.push(line);
    }
    if lines.is_empty() {
        "（暂无任务）".to_string()
    } else {
        lines.join("\n")
    }
}

fn format_schedules_for_reflection(schedules: &[schedule_repo::Schedule]) -> String {
    let mut lines = Vec::new();
    for s in schedules {
        let mut line = format!("- {}", s.title);
        let start = if s.start_at.len() >= 16 { &s.start_at[11..16] } else { &s.start_at };
        match &s.end_at {
            Some(end) => {
                let end_time = if end.len() >= 16 { &end[11..16] } else { end };
                line.push_str(&format!(" {}→{}", start, end_time));
            }
            None => line.push_str(&format!(" {}", start)),
        }
        if let Some(ref cat) = s.category {
            line.push_str(&format!(" ({})", cat));
        }
        if s.is_all_day == 1 {
            line.push_str(" [全天]");
        }
        lines.push(line);
    }
    if lines.is_empty() {
        "（暂无日程）".to_string()
    } else {
        lines.join("\n")
    }
}

/// 日省反思 v2：三路并行 AI 调用（XP 结算 + 旁白生成 + 联系人提取）
#[tauri::command]
pub async fn daily_reflection(
    db_state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    input: GetJournalInput,
) -> Result<serde_json::Value, String> {
    // 1. 读取所有上下文数据
    let (diary_content, tasks, schedules, config) = {
        let conn = db_state
            .conn
            .lock()
            .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;

        let journal = journal_repo::get_or_create_journal(&conn, &app_data.dir, &input.date)?;
        let diary_content = journal_repo::read_md_file(PathBuf::from(&journal.file_path).as_path())?;

        let all_tasks = task_repo::list_tasks(&conn, None, Some(None))?;
        let tasks: Vec<task_repo::Task> = all_tasks
            .into_iter()
            .filter(|t| t.status != "cancelled")
            .collect();

        let schedules = schedule_repo::list_schedules_in_range(&conn, &input.date, &input.date)?;

        let config = client::AiConfig {
            api_url: get_setting_or(&conn, "ai.api_url", "https://api.deepseek.com"),
            api_key: get_setting_or(&conn, "ai.api_key", ""),
            model: get_setting_or(&conn, "ai.model", "deepseek-v4-flash"),
        };

        (diary_content, tasks, schedules, config)
    };

    let tasks_text = format_tasks_for_reflection(&tasks);
    let schedules_text = format_schedules_for_reflection(&schedules);

    // 2. 构建三个独立提示词
    let xp_prompt = prompts::build_xp_settle_prompt(&diary_content, &tasks_text, &schedules_text);
    let refl_prompt = prompts::build_reflection_prompt(&diary_content, &tasks_text, &schedules_text);
    let contact_prompt = prompts::build_contact_extraction_prompt(&diary_content);

    // 3. 三路并行 AI 调用
    let settle_tool = tools::settle_diary_definition();
    let config_xp = config.clone();
    let config_refl = config.clone();
    let config_contact = config;

    let (xp_result, reflection, contacts_raw) = tokio::join!(
        call_xp_ai(config_xp, &xp_prompt, &settle_tool),
        call_refl_ai(config_refl, &refl_prompt),
        call_contact_ai(config_contact, &contact_prompt),
    );

    // 4. 执行 XP 结算
    let xp_json = settle_xp_from_reply(&db_state, &input.date, &xp_result);

    // 5. 保存旁白文件
    let refl_text = reflection.unwrap_or_default();
    {
        let conn = db_state
            .conn
            .lock()
            .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
        journal_repo::save_ai_diary_meta(&conn, &app_data.dir, &input.date)?;
        let ai_path = journal_repo::date_to_file_path(&app_data.dir, &input.date, true);
        let word_count = refl_text.chars().count() as i32;
        let _ = journal_repo::write_md_file(&ai_path, &input.date, None, None, word_count, "ai", &refl_text);
    }

    // 6. 联系人匹配 + mood/tags 提取
    let (contacts_json, mood, tags) = match_contacts_and_meta(&db_state, &contacts_raw);

    // 7. 持久化 mood/tags 到日记记录
    {
        let conn = db_state
            .conn
            .lock()
            .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
        if let Ok(journal) = journal_repo::get_or_create_journal(&conn, &app_data.dir, &input.date) {
            let _ = journal_repo::update_journal_metadata(
                &conn, &journal.id, None,
                mood.as_deref(),
                tags.as_deref(),
                journal.word_count,
            );
        }
    }

    // 8. 返回
    Ok(serde_json::json!({
        "xp_result": xp_json,
        "reflection": refl_text,
        "contacts": contacts_json,
        "mood": mood,
        "tags": tags,
    }))
}

// ─── 三路 AI 子调用 ───

async fn call_xp_ai(
    config: client::AiConfig,
    prompt: &str,
    settle_tool: &tools::ToolDefinition,
) -> Result<client::ChatMessage, String> {
    let messages = vec![
        text_message("system", prompt),
    ];
    client::chat_completion(&config, messages, Some(vec![settle_tool.clone()]), None).await
}

async fn call_refl_ai(
    config: client::AiConfig,
    prompt: &str,
) -> Result<String, String> {
    let messages = vec![
        text_message("system", prompt),
        text_message("user", "请写今天的日记旁白。"),
    ];
    let reply = client::chat_completion(&config, messages, None, None).await?;
    Ok(reply.content
        .map(|v| match v { Value::String(s) => s, other => other.to_string() })
        .unwrap_or_default())
}

async fn call_contact_ai(
    config: client::AiConfig,
    prompt: &str,
) -> Result<String, String> {
    let messages = vec![
        text_message("system", prompt),
        text_message("user", "请提取日记中的人物。"),
    ];
    let reply = client::chat_completion(&config, messages, None, None).await?;
    Ok(reply.content
        .map(|v| match v { Value::String(s) => s, other => other.to_string() })
        .unwrap_or_default())
}

// ─── XP 结算 ───

fn settle_xp_from_reply(
    db_state: &State<'_, DbState>,
    date: &str,
    ai_result: &Result<client::ChatMessage, String>,
) -> serde_json::Value {
    let empty = || serde_json::json!({ "xp_earned": 0, "skill_xps": [] });

    let reply = match ai_result {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[daily_reflection] XP AI 调用失败: {}", e);
            return empty();
        }
    };

    let allocations: Vec<(String, i32)> = reply
        .tool_calls
        .as_ref()
        .and_then(|tc| {
            let parsed: Vec<tools::ToolCall> = serde_json::from_str(
                &serde_json::to_string(tc).unwrap_or_default()
            ).ok()?;
            let call = parsed.iter().find(|t| t.function.name == "settle_diary")?;
            #[derive(Deserialize)]
            struct A { xp_allocations: Vec<B> }
            #[derive(Deserialize)]
            struct B { skill_id: String, xp_amount: i32 }
            let args: A = serde_json::from_str(&call.function.arguments).ok()?;
            Some(args.xp_allocations.iter().map(|a| (a.skill_id.clone(), a.xp_amount)).collect())
        })
        .unwrap_or_default();

    let mut conn = match db_state.conn.lock() {
        Ok(c) => c,
        Err(_) => return empty(),
    };

    let result = if allocations.is_empty() {
        journal_repo::complete_diary(&mut conn, date)
    } else {
        journal_repo::complete_diary_with_xp(&mut conn, date, &allocations)
    };

    match result {
        Ok(r) => serde_json::to_value(r).unwrap_or_else(|_| empty()),
        Err(e) => {
            eprintln!("[daily_reflection] XP 结算跳过: {}", e);
            empty()
        }
    }
}

// ─── 联系人 DB 匹配 ───

#[derive(Serialize)]
struct ExtractedContact {
    name: String,
    event_summary: String,
    existing_contact_id: Option<String>,
    existing_contact_name: Option<String>,
    is_new: bool,
}

fn match_contacts_and_meta(
    db_state: &State<'_, DbState>,
    contacts_raw: &Result<String, String>,
) -> (serde_json::Value, Option<String>, Option<String>) {
    let raw = match contacts_raw {
        Ok(s) => s.clone(),
        Err(e) => {
            eprintln!("[daily_reflection] 联系人 AI 调用失败: {}", e);
            return (serde_json::json!([]), None, None);
        }
    };

    #[derive(Deserialize)]
    struct RawContact {
        name: String,
        event_summary: String,
    }
    #[derive(Deserialize)]
    struct ExtractionResult {
        #[serde(default)]
        contacts: Vec<RawContact>,
        mood: Option<String>,
        #[serde(default)]
        tags: Vec<String>,
    }

    // 先尝试从原始文本直接解析（新格式：对象包含 mood/tags）
    // 再尝试从提取的 JSON 片段解析（兼容旧格式：纯数组）
    let json_str = extract_json_from_text(&raw);
    let parsed: ExtractionResult = serde_json::from_str(&json_str)
        .or_else(|_| {
            serde_json::from_str::<Vec<RawContact>>(&json_str).map(|contacts| {
                ExtractionResult { contacts, mood: None, tags: vec![] }
            })
        })
        .unwrap_or_else(|_| {
            // 回退：可能是旧格式的纯数组
            let contacts: Vec<RawContact> = serde_json::from_str(&json_str).unwrap_or_default();
            ExtractionResult { contacts, mood: None, tags: vec![] }
        });

    let mood = parsed.mood.filter(|m| !m.is_empty());
    let tags = if parsed.tags.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&parsed.tags).unwrap_or_default())
    };

    let conn = match db_state.conn.lock() {
        Ok(c) => c,
        Err(_) => return (serde_json::json!([]), None, None),
    };

    let mut results = Vec::new();
    for rc in &parsed.contacts {
        if rc.name.trim().is_empty() { continue; }

        let existing = contact_repo::search_contacts(&conn, &rc.name).ok();
        let (contact_id, contact_name) = existing
            .as_ref()
            .and_then(|list| list.first())
            .map(|c| (Some(c.id.clone()), Some(c.name.clone())))
            .unwrap_or((None, None));

        let is_new = contact_id.is_none();
        results.push(ExtractedContact {
            name: rc.name.clone(),
            event_summary: rc.event_summary.clone(),
            existing_contact_id: contact_id,
            existing_contact_name: contact_name,
            is_new,
        });
    }

    let contacts_json = serde_json::to_value(results).unwrap_or_else(|_| serde_json::json!([]));
    (contacts_json, mood, tags)
}

/// 从可能包含 markdown 代码块的文本中提取 JSON 内容
fn extract_json_from_text(text: &str) -> String {
    // 尝试找 ```json ... ``` 代码块
    if let Some(start) = text.find("```json") {
        let after = &text[start + 7..];
        if let Some(end) = after.find("```") {
            return after[..end].trim().to_string();
        }
    }
    if let Some(start) = text.find("```") {
        let after = &text[start + 3..];
        if let Some(end) = after.find("```") {
            return after[..end].trim().to_string();
        }
    }
    // 尝试找 { ... }（对象，新格式）
    if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            return text[start..=end].to_string();
        }
    }
    // 尝试找 [ ... ]（数组，旧格式）
    if let Some(start) = text.find('[') {
        if let Some(end) = text.rfind(']') {
            return text[start..=end].to_string();
        }
    }
    text.trim().to_string()
}

#[tauri::command]
pub fn get_journal_count(db_state: State<'_, DbState>) -> Result<i32, String> {
    let conn = db_state
        .conn
        .lock()
        .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    journal_repo::get_journal_count(&conn)
}

// ========== 日记图片 Commands ==========

/// 上传图片到指定日期的日记目录，返回图片记录
#[tauri::command]
pub async fn upload_journal_image(
    db_state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    date: String,
    file_name: String,
    mime_type: String,
    data: Vec<u8>,
) -> Result<journal_repo::JournalImage, String> {
    // 确保日记存在
    let app_data_dir = &app_data.dir;
    let journal_id = {
        let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
        let journal = journal_repo::get_or_create_journal(&conn, app_data_dir, &date)?;
        journal.id
    };
    let parts: Vec<&str> = date.split('-').collect();
    let (year, month) = if parts.len() >= 2 {
        (parts[0], parts[1])
    } else {
        ("unknown", "unknown")
    };

    // 图片目录: journals/YYYY/MM/YYYY-MM-DD/
    let img_dir = app_data_dir
        .join("journals")
        .join(year)
        .join(month)
        .join(&date);
    std::fs::create_dir_all(&img_dir).map_err(|e| format!("创建图片目录失败: {}", e))?;

    // 生成唯一文件名
    let ext = file_name.rsplit('.').next().unwrap_or("jpg");
    let unique_name = format!("img_{}_{}.{}", chrono::Local::now().timestamp_millis(), nanoid::nanoid!(4), ext);
    let file_path = img_dir.join(&unique_name);

    // 写入文件
    std::fs::write(&file_path, &data).map_err(|e| format!("写入图片文件失败: {}", e))?;

    // 保存到数据库（相对路径）
    let relative_path = format!("{}/{}/{}/{}/{}", "journals", year, month, date, unique_name);
    let file_size = data.len() as i64;

    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
    journal_repo::create_journal_image(
        &conn,
        &journal_id,
        &relative_path,
        &file_name,
        Some(&mime_type),
        Some(file_size),
    )
}

/// 获取日记的所有图片
#[tauri::command]
pub fn get_journal_images(
    db_state: State<'_, DbState>,
    journal_id: String,
) -> Result<Vec<journal_repo::JournalImage>, String> {
    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
    journal_repo::get_journal_images(&conn, &journal_id)
}

/// 删除日记图片
#[tauri::command]
pub async fn delete_journal_image(
    db_state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    image_id: String,
) -> Result<(), String> {
    let file_path = {
        let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
        journal_repo::delete_journal_image(&conn, &image_id)?
    };

    // 删除物理文件
    let full_path = app_data.dir.join(&file_path);
    if full_path.exists() {
        std::fs::remove_file(&full_path).map_err(|e| format!("删除图片文件失败: {}", e))?;
    }

    Ok(())
}

/// 读取图片文件并返回 base64 data URI（用于前端显示）
#[tauri::command]
pub async fn get_journal_image_data(
    app_data: State<'_, AppDataState>,
    file_path: String,
) -> Result<String, String> {
    let full_path = app_data.dir.join(&file_path);
    let data = std::fs::read(&full_path)
        .map_err(|e| format!("读取图片失败: {}", e))?;

    // 根据扩展名确定 MIME 类型
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
