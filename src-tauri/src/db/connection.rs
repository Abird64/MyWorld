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
    let db_path_orig = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    log::info!("[init_db] app_data_dir: {:?}", db_path_orig);

    // 确保数据目录可写（Android 上 app_data_dir 可能指向只读分区）
    let app_dir = ensure_writable_dir(&db_path_orig)?;

    let mut db_path = app_dir.clone();
    db_path.push("lantern.db");

    log::info!("[init_db] using db_path: {:?}", db_path);

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
            dir: app_dir,
        },
    ))
}

/// 确保目录可写。如果原始目录不可写（Android 常见），
/// 依次尝试 cache_dir、temp_dir，返回第一个可写的路径。
fn ensure_writable_dir(preferred: &std::path::Path) -> Result<PathBuf, String> {
    // 非 Windows 平台：拒绝含反斜杠的路径（Tauri 在 Android 上可能返回 Windows 风格路径）
    #[cfg(not(target_os = "windows"))]
    {
        let path_str = preferred.to_string_lossy();
        if path_str.contains('\\') {
            log::warn!(
                "[init_db] preferred path contains backslashes on non-Windows platform, skipping: {:?}",
                preferred
            );
        } else if try_ensure_writable(preferred).is_ok() {
            return Ok(preferred.to_path_buf());
        }
    }

    #[cfg(target_os = "windows")]
    {
        if try_ensure_writable(preferred).is_ok() {
            return Ok(preferred.to_path_buf());
        }
    }

    log::warn!("[init_db] preferred dir not usable: {:?}", preferred);

    // 降级候选路径（Android 特有）
    let candidates = [
        PathBuf::from("/data/data/com.lantern.app/cache"),
        PathBuf::from("/data/data/com.lantern.app/files"),
        std::env::temp_dir(),
    ];

    for candidate in &candidates {
        let lantern_dir = candidate.join("lantern");
        if try_ensure_writable(&lantern_dir).is_ok() {
            log::warn!("[init_db] fallback to: {:?}", lantern_dir);
            return Ok(lantern_dir);
        }
    }

    Err(format!("所有数据目录均不可写，首选路径: {:?}", preferred))
}

/// 尝试创建目录并通过写入临时文件验证可写性
fn try_ensure_writable(dir: &std::path::Path) -> Result<(), String> {
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("mkdir {:?}: {}", dir, e))?;

    let test_file = dir.join(".write_test");
    std::fs::write(&test_file, b"ok")
        .map_err(|e| format!("write test {:?}: {}", test_file, e))?;
    let _ = std::fs::remove_file(&test_file);
    Ok(())
}
