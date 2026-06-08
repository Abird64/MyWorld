use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
#[cfg(feature = "gui")]
use tauri::Manager;

use super::repositories::skill_repo;

pub struct DbState {
    pub conn: Mutex<Connection>,
    pub db_path: PathBuf,
}

pub struct AppDataState {
    pub dir: PathBuf,
}

#[cfg(feature = "gui")]
pub fn init_db(app_handle: &tauri::AppHandle) -> Result<(DbState, AppDataState), String> {
    let mut db_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    std::fs::create_dir_all(&db_path).map_err(|e| format!("Failed to create data dir: {}", e))?;

    db_path.push("lantern.db");

    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // 启用 WAL 模式提升并发性能
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("Failed to set WAL mode: {}", e))?;

    // 启用外键约束
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

    // 执行建表迁移
    super::migrations::run_migrations(&conn)?;

    // 初始化6个默认技能
    skill_repo::initialize_default_skills(&conn)?;

    log::info!("Database initialized at: {:?}", db_path);

    Ok((
        DbState {
            conn: Mutex::new(conn),
            db_path: db_path.clone(),
        },
        AppDataState {
            dir: db_path.parent().unwrap_or(&db_path).to_path_buf(),
        },
    ))
}
