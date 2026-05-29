use crate::db::repositories::habit_repo;
use crate::db::connection::DbState;
use serde::Deserialize;
use tauri::State;

#[derive(Deserialize)]
pub struct CreateHabitInput {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub frequency_type: Option<String>,
    pub frequency_value: Option<String>,
    pub target_minutes: Option<i32>,
    pub skill_id: Option<String>,
    pub xp_per_check: Option<i32>,
}

#[derive(Deserialize)]
pub struct UpdateHabitInput {
    pub name: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub frequency_type: Option<String>,
    pub frequency_value: Option<String>,
    pub target_minutes: Option<i32>,
    pub skill_id: Option<String>,
    pub xp_per_check: Option<i32>,
}

#[derive(Deserialize)]
pub struct DeleteHabitInput {
    pub id: String,
}

#[derive(Deserialize)]
pub struct CheckHabitInput {
    pub habit_id: String,
    pub date: Option<String>,
    pub note: Option<String>,
}

#[derive(Deserialize)]
pub struct UncheckHabitInput {
    pub habit_id: String,
    pub date: Option<String>,
}

#[derive(Deserialize)]
pub struct GetRecordsInput {
    pub habit_id: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[tauri::command]
pub fn create_habit(
    state: State<'_, DbState>,
    input: CreateHabitInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let habit = habit_repo::create_habit(
        &conn,
        &input.name,
        input.icon.as_deref(),
        input.color.as_deref(),
        input.frequency_type.as_deref().unwrap_or("daily"),
        input.frequency_value.as_deref(),
        input.target_minutes,
        input.skill_id.as_deref(),
        input.xp_per_check.unwrap_or(5),
    )?;
    serde_json::to_value(habit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_habit(
    state: State<'_, DbState>,
    id: String,
    input: UpdateHabitInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let habit = habit_repo::update_habit(
        &conn,
        &id,
        input.name.as_deref(),
        input.icon.as_deref(),
        input.color.as_deref(),
        input.frequency_type.as_deref(),
        input.frequency_value.as_deref(),
        input.target_minutes,
        input.skill_id.as_deref(),
        input.xp_per_check,
    )?;
    serde_json::to_value(habit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_habit(
    state: State<'_, DbState>,
    input: DeleteHabitInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let affected = habit_repo::delete_habit(&conn, &input.id)?;
    serde_json::to_value(serde_json::json!({ "success": true, "deleted": affected }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_habits(
    state: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let habits = habit_repo::list_habits(&conn)?;
    serde_json::to_value(habits).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_habit(
    state: State<'_, DbState>,
    input: CheckHabitInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let record = habit_repo::check_habit(&conn, &input.habit_id, input.date.as_deref(), input.note.as_deref())?;
    serde_json::to_value(record).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn uncheck_habit(
    state: State<'_, DbState>,
    input: UncheckHabitInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let affected = habit_repo::uncheck_habit(&conn, &input.habit_id, input.date.as_deref())?;
    serde_json::to_value(serde_json::json!({ "success": true, "deleted": affected }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_records(
    state: State<'_, DbState>,
    input: GetRecordsInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let records = habit_repo::get_records(&conn, &input.habit_id, input.start_date.as_deref(), input.end_date.as_deref())?;
    serde_json::to_value(records).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_streak(
    state: State<'_, DbState>,
    habit_id: String,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let streak = habit_repo::get_streak(&conn, &habit_id)?;
    serde_json::to_value(streak).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_streaks(
    state: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let streaks = habit_repo::get_all_streaks(&conn)?;
    serde_json::to_value(streaks).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_week_matrix(
    state: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let matrix = habit_repo::get_week_matrix(&conn)?;
    serde_json::to_value(matrix).map_err(|e| e.to_string())
}
