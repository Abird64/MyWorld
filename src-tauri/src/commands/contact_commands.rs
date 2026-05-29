use crate::db::repositories::contact_repo;
use crate::db::repositories::contact_repo::ContactMethodInput;
use crate::db::connection::DbState;
use serde::Deserialize;
use tauri::State;

#[derive(Deserialize)]
pub struct MethodInput {
    pub method_type: String,
    pub value: String,
}

#[derive(Deserialize)]
pub struct CreateContactInput {
    pub name: String,
    pub nickname: Option<String>,
    pub group_name: Option<String>,
    pub avatar_path: Option<String>,
    pub birthday_calendar: Option<String>,
    pub birthday_year: Option<i32>,
    pub birthday_month: Option<i32>,
    pub birthday_day: Option<i32>,
    pub contact_methods: Option<Vec<MethodInput>>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateContactInput {
    pub name: Option<String>,
    pub nickname: Option<String>,
    pub group_name: Option<String>,
    pub avatar_path: Option<String>,
    pub birthday_calendar: Option<String>,
    pub birthday_year: Option<i32>,
    pub birthday_month: Option<i32>,
    pub birthday_day: Option<i32>,
    pub contact_methods: Option<Vec<MethodInput>>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct ListContactsInput {
    pub group_name: Option<String>,
}

#[derive(Deserialize)]
pub struct DeleteContactInput {
    pub id: String,
}

#[derive(Deserialize)]
pub struct SearchContactsInput {
    pub query: String,
}

#[tauri::command]
pub fn create_contact(
    state: State<'_, DbState>,
    input: CreateContactInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let methods: Vec<ContactMethodInput> = input.contact_methods
        .unwrap_or_default()
        .into_iter()
        .map(|m| ContactMethodInput { method_type: m.method_type, value: m.value })
        .collect();
    let contact = contact_repo::create_contact(
        &conn,
        &input.name,
        input.nickname.as_deref(),
        input.group_name.as_deref(),
        input.avatar_path.as_deref(),
        input.birthday_calendar.as_deref(),
        input.birthday_year,
        input.birthday_month,
        input.birthday_day,
        &methods,
        input.notes.as_deref(),
    )?;
    serde_json::to_value(contact).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_contact(
    state: State<'_, DbState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let contact = contact_repo::get_contact(&conn, &id)?;
    serde_json::to_value(contact).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_contacts(
    state: State<'_, DbState>,
    input: Option<ListContactsInput>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let group_name = input.as_ref().and_then(|i| i.group_name.as_deref());
    let contacts = contact_repo::list_contacts(&conn, group_name)?;
    serde_json::to_value(contacts).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_contact(
    state: State<'_, DbState>,
    id: String,
    input: UpdateContactInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let methods: Option<Vec<ContactMethodInput>> = input.contact_methods.map(|ms|
        ms.into_iter().map(|m| ContactMethodInput { method_type: m.method_type, value: m.value }).collect()
    );
    let contact = contact_repo::update_contact(
        &conn,
        &id,
        input.name.as_deref(),
        input.nickname.as_deref(),
        input.group_name.as_deref(),
        input.avatar_path.as_deref(),
        input.birthday_calendar.as_deref(),
        input.birthday_year,
        input.birthday_month,
        input.birthday_day,
        methods.as_deref(),
        input.notes.as_deref(),
    )?;
    serde_json::to_value(contact).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_contact(
    state: State<'_, DbState>,
    input: DeleteContactInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let affected = contact_repo::delete_contact(&conn, &input.id)?;
    serde_json::to_value(serde_json::json!({ "success": true, "deleted": affected }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_contacts(
    state: State<'_, DbState>,
    input: SearchContactsInput,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let contacts = contact_repo::search_contacts(&conn, &input.query)?;
    serde_json::to_value(contacts).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_upcoming_birthdays(
    state: State<'_, DbState>,
    days_ahead: Option<i32>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let birthdays = contact_repo::list_upcoming_birthdays(&conn, days_ahead.unwrap_or(30))?;
    serde_json::to_value(birthdays).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_all_birthdays(
    state: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let birthdays = contact_repo::list_all_birthdays(&conn)?;
    serde_json::to_value(birthdays).map_err(|e| e.to_string())
}
