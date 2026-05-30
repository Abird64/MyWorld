use serde::Deserialize;
use tauri::State;

use crate::db::connection::DbState;
use crate::db::repositories::skill_repo;

#[tauri::command]
pub fn list_skills(state: State<'_, DbState>) -> Result<Vec<skill_repo::Skill>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    skill_repo::list_skills(&conn)
}

#[tauri::command]
pub fn get_task_skills(
    state: State<'_, DbState>,
    task_id: String,
) -> Result<Vec<skill_repo::TaskSkill>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    skill_repo::get_task_skills(&conn, &task_id)
}

#[derive(Deserialize)]
pub struct SkillXpInput {
    pub skill_id: String,
    pub xp_amount: i32,
}

#[tauri::command]
pub fn set_task_skills(
    state: State<'_, DbState>,
    task_id: String,
    skills: Vec<SkillXpInput>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let pairs: Vec<(String, i32)> = skills
        .into_iter()
        .map(|s| (s.skill_id, s.xp_amount))
        .collect();
    skill_repo::set_task_skills(&conn, &task_id, &pairs)
}

#[tauri::command]
pub fn get_skill_activity(
    state: State<'_, DbState>,
    days: Option<i32>,
) -> Result<Vec<skill_repo::DayActivity>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    skill_repo::get_skill_activity(&conn, days.unwrap_or(84))
}

#[tauri::command]
pub fn get_xp_sources(
    state: State<'_, DbState>,
) -> Result<Vec<skill_repo::XpSource>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    skill_repo::get_xp_sources(&conn)
}
