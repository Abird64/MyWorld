use crate::db::repositories::task_repo;
use crate::db::connection::DbState;
use serde::Deserialize;
use tauri::State;

#[derive(Deserialize)]
pub struct CreateTaskInput {
    pub title: String,
    pub parent_id: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub scheduled_at: Option<String>,
    pub deadline: Option<String>,
    pub estimated_minutes: Option<i32>,
    pub tags: Option<String>,
    pub glow_reward: Option<i32>,
}

#[derive(Deserialize)]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub scheduled_at: Option<String>,
    pub deadline: Option<String>,
    pub estimated_minutes: Option<i32>,
    pub notes: Option<String>,
    pub tags: Option<String>,
}

#[derive(Deserialize)]
pub struct ListTasksInput {
    pub status: Option<String>,
    pub parent_id: Option<String>,
}

#[derive(Deserialize)]
pub struct DeleteTaskInput {
    pub id: String,
    pub cascade: Option<bool>,
}

#[derive(Deserialize)]
pub struct SearchTasksInput {
    pub query: String,
}

#[tauri::command]
pub fn create_task(
    state: State<'_, DbState>,
    input: CreateTaskInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let task = task_repo::create_task(
        &conn,
        &input.title,
        input.parent_id.as_deref(),
        input.description.as_deref(),
        input.priority.as_deref(),
        input.scheduled_at.as_deref(),
        input.deadline.as_deref(),
        input.estimated_minutes.unwrap_or(0),
        input.tags.as_deref(),
        input.glow_reward.unwrap_or(0),
    )?;
    serde_json::to_value(task).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_task(
    state: State<'_, DbState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let task = task_repo::get_task(&conn, &id)?;
    serde_json::to_value(task).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_tasks(
    state: State<'_, DbState>,
    input: Option<ListTasksInput>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;

    let (status, parent_filter) = match &input {
        Some(i) => {
            let status = i.status.as_deref();
            let parent = i.parent_id.as_ref().map(|v| {
                if v.is_empty() {
                    None
                } else {
                    Some(v.as_str())
                }
            });
            (status, parent)
        }
        None => (None, None),
    };

    let tasks = task_repo::list_tasks(&conn, status, parent_filter)?;
    serde_json::to_value(tasks).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_task(
    state: State<'_, DbState>,
    id: String,
    input: UpdateTaskInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let task = task_repo::update_task(
        &conn,
        &id,
        input.title.as_deref(),
        input.description.as_deref(),
        input.status.as_deref(),
        input.priority.as_deref(),
        input.scheduled_at.as_deref(),
        input.deadline.as_deref(),
        input.estimated_minutes,
        input.notes.as_deref(),
        input.tags.as_deref(),
    )?;
    serde_json::to_value(task).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_task(
    state: State<'_, DbState>,
    input: DeleteTaskInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let affected = task_repo::delete_task(&conn, &input.id, input.cascade.unwrap_or(false))?;
    serde_json::to_value(serde_json::json!({ "success": true, "deleted": affected }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn complete_task(
    state: State<'_, DbState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let mut conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let result = task_repo::complete_task(&mut conn, &id)?;
    serde_json::to_value(result).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn uncomplete_task(
    state: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    task_repo::uncomplete_task(&mut conn, &id)
}

#[tauri::command]
pub fn search_tasks(
    state: State<'_, DbState>,
    input: SearchTasksInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let tasks = task_repo::search_tasks(&conn, &input.query)?;
    serde_json::to_value(tasks).map_err(|e| e.to_string())
}
