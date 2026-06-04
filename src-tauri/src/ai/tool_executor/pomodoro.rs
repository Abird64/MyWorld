use rusqlite::Connection;
use serde::Deserialize;

use crate::db::repositories::{pomodoro_repo, task_repo};

#[derive(Debug, Deserialize)]
struct ToolStartPomodoroArgs {
    #[serde(default)]
    session_type: Option<String>,
    #[serde(default)]
    target_minutes: Option<i32>,
    #[serde(default)]
    task_title: Option<String>,
}

pub fn execute_start_pomodoro(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolStartPomodoroArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("start_pomodoro 参数解析失败: {}", e))?;

    if let Ok(Some(active)) = pomodoro_repo::get_active_session(conn) {
        let type_label = if active.session_type == "focus" { "专注" } else { "休息" };
        return Err(format!(
            "已有一个进行中的{}会话（目标{}分钟），请先完成或取消当前会话再开始新的",
            type_label, active.target_minutes
        ));
    }

    let session_type = args.session_type.as_deref().unwrap_or("focus");
    let target_minutes = args.target_minutes.unwrap_or_else(|| {
        if session_type == "break" { 5 } else { 25 }
    });

    let task_id = match args.task_title.as_deref() {
        Some(title) if !title.is_empty() => {
            match task_repo::search_tasks_scored(conn, title, None, None) {
                Ok(scored) if !scored.is_empty() => Some(scored[0].0.id.clone()),
                _ => None,
            }
        }
        _ => None,
    };

    let _session = pomodoro_repo::create_session(
        conn,
        task_id.as_deref(),
        session_type,
        target_minutes,
    ).map_err(|e| format!("创建专注会话失败: {}", e))?;

    let type_label = if session_type == "focus" { "专注" } else { "休息" };
    let task_line = match (&task_id, args.task_title.as_deref()) {
        (Some(_), Some(title)) => format!("，关联任务：{}", title),
        _ => String::new(),
    };

    Ok(format!(
        "{} 番茄钟已启动：{}分钟{}会话{}\n专注结束后我会提醒你，加油！",
        if session_type == "focus" { "🍅" } else { "☕" },
        target_minutes,
        type_label,
        task_line
    ))
}

pub fn execute_get_pomodoro_stats(conn: &Connection) -> Result<String, String> {
    let stats = pomodoro_repo::get_today_stats(conn)
        .map_err(|e| format!("查询专注统计失败: {}", e))?;

    let active_session = pomodoro_repo::get_active_session(conn).ok().flatten();

    let focus_min = stats.focus_seconds / 60;
    let total_sessions = stats.focus_count + stats.break_count;

    let mut result = String::from("今日番茄钟统计：\n\n");

    if focus_min == 0 && total_sessions == 0 && active_session.is_none() {
        result.push_str("今天还没有专注记录。要不要来一个25分钟的番茄钟？");
        return Ok(result);
    }

    if let Some(ref session) = active_session {
        let type_label = if session.session_type == "focus" { "专注" } else { "休息" };
        result.push_str(&format!(
            "🟢 进行中：{}会话（目标{}分钟）\n\n",
            type_label, session.target_minutes
        ));
    }

    result.push_str(&format!("🍅 专注：{}次，共{}分钟\n", stats.focus_count, focus_min));
    if stats.break_count > 0 {
        result.push_str(&format!("☕ 休息：{}次\n", stats.break_count));
    }

    if active_session.is_some() {
        result.push_str("\n专注结束后记得休息一下");
    }

    Ok(result)
}
