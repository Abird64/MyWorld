use tauri::State;
use crate::db::connection::DbState;
use crate::db::repositories::glow_ledger_repo;

#[tauri::command]
pub fn list_glow_ledger(
    state: State<'_, DbState>,
    asset_type: Option<String>,
    reason: Option<String>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let (entries, total) = glow_ledger_repo::list_entries(
        &conn,
        asset_type.as_deref(),
        reason.as_deref(),
        limit.unwrap_or(50),
        offset.unwrap_or(0),
    )
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "entries": entries,
        "total": total,
    }))
}
