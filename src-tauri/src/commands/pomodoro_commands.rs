use crate::db::connection::DbState;
use crate::db::repositories::pomodoro_repo;
use serde::Deserialize;
use tauri::State;

#[derive(Deserialize)]
pub struct StartPomodoroInput {
    pub task_id: Option<String>,
    pub session_type: Option<String>,
    pub target_minutes: Option<i32>,
}

#[derive(Deserialize)]
pub struct CompletePomodoroInput {
    pub session_id: String,
    pub actual_seconds: i32,
}

#[derive(Deserialize)]
pub struct CancelPomodoroInput {
    pub session_id: String,
}

#[tauri::command]
pub fn start_pomodoro(
    state: State<'_, DbState>,
    input: StartPomodoroInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let session = pomodoro_repo::create_session(
        &conn,
        input.task_id.as_deref(),
        input.session_type.as_deref().unwrap_or("focus"),
        input.target_minutes.unwrap_or(25),
    )?;
    serde_json::to_value(session).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn complete_pomodoro(
    state: State<'_, DbState>,
    input: CompletePomodoroInput,
) -> Result<serde_json::Value, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let session = pomodoro_repo::complete_session(&mut conn, &input.session_id, input.actual_seconds)?;
    serde_json::to_value(session).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_pomodoro(
    state: State<'_, DbState>,
    input: CancelPomodoroInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let session = pomodoro_repo::cancel_session(&conn, &input.session_id)?;
    serde_json::to_value(session).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_active_pomodoro(
    state: State<'_, DbState>,
) -> Result<Option<serde_json::Value>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let session = pomodoro_repo::get_active_session(&conn)?;
    match session {
        Some(s) => Ok(Some(serde_json::to_value(s).map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn get_pomodoro_stats(
    state: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let stats = pomodoro_repo::get_today_stats(&conn)?;
    serde_json::to_value(stats).map_err(|e| e.to_string())
}
