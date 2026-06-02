use std::fs;
use std::path::Path;

use tauri::State;

use crate::db::connection::{AppDataState, DbState};
use crate::db::repositories::setting_repo;

/// 清除指定分类的全部数据
#[tauri::command]
pub fn clear_data(
    state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    categories: Vec<String>,
) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut cleared = Vec::new();

    for cat in &categories {
        match cat.as_str() {
            "tasks" => {
                conn.execute_batch(
                    "DELETE FROM task_skills; DELETE FROM task_contacts; DELETE FROM tasks;",
                )
                .map_err(|e| e.to_string())?;
                cleared.push("任务");
            }
            "schedules" => {
                conn.execute("DELETE FROM schedules", [])
                    .map_err(|e| e.to_string())?;
                cleared.push("日程");
            }
            "contacts" => {
                conn.execute_batch(
                    "DELETE FROM contact_methods; DELETE FROM diary_contacts; DELETE FROM task_contacts; DELETE FROM contacts;",
                )
                .map_err(|e| e.to_string())?;
                cleared.push("人脉");
            }
            "journals" => {
                // 只删用户日记的 DB 记录
                conn.execute("DELETE FROM journals WHERE entry_type = 'user'", [])
                    .map_err(|e| e.to_string())?;

                // 删除用户日记文件
                let journals_dir = app_data.dir.join("journals");
                if journals_dir.exists() {
                    // 遍历年份目录，删除非 AI 的 .md 文件
                    delete_user_md_files(&journals_dir)?;
                }

                cleared.push("日记");
            }
            "ai_diary" => {
                // 删除 AI 日记的 DB 记录
                conn.execute("DELETE FROM journals WHERE entry_type = 'ai'", [])
                    .map_err(|e| e.to_string())?;

                // 删除日省虚拟任务
                conn.execute_batch(
                    "DELETE FROM task_skills WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '% 日省');
                     DELETE FROM task_contacts WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '% 日省');
                     DELETE FROM tasks WHERE title LIKE '% 日省';",
                )
                .map_err(|e| e.to_string())?;

                // 删除 AI 日记文件
                let journals_dir = app_data.dir.join("journals");
                if journals_dir.exists() {
                    delete_ai_md_files(&journals_dir)?;
                }

                cleared.push("AI日省");
            }
            "skills" => {
                conn.execute_batch(
                    "DELETE FROM task_skills; DELETE FROM skill_events; DELETE FROM skills;",
                )
                .map_err(|e| e.to_string())?;
                cleared.push("技能");
            }
            "ai_conversations" => {
                conn.execute_batch(
                    "DELETE FROM ai_messages; DELETE FROM ai_conversations;",
                )
                .map_err(|e| e.to_string())?;
                cleared.push("AI对话");
            }
            "ai_favorites" => {
                conn.execute("DELETE FROM ai_favorites", [])
                    .map_err(|e| e.to_string())?;
                cleared.push("收藏夹");
            }
            "pomodoro" => {
                conn.execute("DELETE FROM pomodoro_sessions", [])
                    .map_err(|e| e.to_string())?;
                cleared.push("番茄钟");
            }
            "settings" => {
                conn.execute("DELETE FROM settings", [])
                    .map_err(|e| e.to_string())?;
                cleared.push("设置");
            }
            _ => {}
        }
    }

    if cleared.is_empty() {
        Ok("没有清除任何数据".to_string())
    } else {
        Ok(format!("已清除：{}", cleared.join("、")))
    }
}

#[tauri::command]
pub fn get_setting(
    state: State<'_, DbState>,
    key: String,
) -> Result<Option<setting_repo::Setting>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    setting_repo::get_setting(&conn, &key)
}

#[tauri::command]
pub fn set_setting(
    state: State<'_, DbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    setting_repo::set_setting(&conn, &key, &value)
}

#[tauri::command]
pub fn list_settings(
    state: State<'_, DbState>,
) -> Result<Vec<setting_repo::Setting>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    setting_repo::list_settings(&conn)
}

#[tauri::command]
pub fn delete_setting(
    state: State<'_, DbState>,
    key: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    setting_repo::delete_setting(&conn, &key)
}

/// 删除用户日记 .md 文件（非 AI 的，文件名格式 YYYY-MM-DD.md，不包含 -ai 后缀）
fn delete_user_md_files(dir: &Path) -> Result<(), String> {
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            delete_user_md_files(&path)?;
        } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            // 删除 {date}.md，跳过 {date}-ai.md
            if name.ends_with(".md") && !name.contains("-ai") {
                fs::remove_file(&path).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

/// 删除 AI 日记 .md 文件（文件名格式 YYYY-MM-DD-ai.md）
fn delete_ai_md_files(dir: &Path) -> Result<(), String> {
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            delete_ai_md_files(&path)?;
        } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.ends_with("-ai.md") {
                fs::remove_file(&path).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}
