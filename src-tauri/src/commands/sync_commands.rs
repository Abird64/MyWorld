use tauri::State;

use crate::db::connection::{AppDataState, DbState};
use crate::sync::sync_engine::{run_full_sync, SyncResult, SyncState};
use crate::sync::webdav_client::WebDavClient;

/// 测试 WebDAV 连接
#[tauri::command]
pub async fn sync_test_connection(
    url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    let client = WebDavClient::new(&url, &username, &password);
    client.test_connection().await
}

/// 立即同步
#[tauri::command]
pub async fn sync_now(
    db_state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    sync_state: State<'_, SyncState>,
) -> Result<SyncResult, String> {
    // 检查是否已有同步在进行
    {
        let in_progress = sync_state
            .in_progress
            .lock()
            .map_err(|e| e.to_string())?;
        if *in_progress {
            return Err("同步正在进行中，请稍后再试".to_string());
        }
    }

    // 标记同步开始
    {
        let mut guard = sync_state.in_progress.lock().map_err(|e| e.to_string())?;
        *guard = true;
    }

    let result = run_full_sync(&db_state, &app_data).await;

    // 标记同步结束
    {
        let mut guard = sync_state.in_progress.lock().map_err(|e| e.to_string())?;
        *guard = false;
    }

    Ok(result)
}

/// 获取同步状态
#[tauri::command]
pub async fn sync_get_status(
    db_state: State<'_, DbState>,
    sync_state: State<'_, SyncState>,
) -> Result<SyncStatus, String> {
    let in_progress = sync_state
        .in_progress
        .lock()
        .map_err(|e| e.to_string())?;

    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;

    let enabled = crate::db::repositories::setting_repo::get_setting(&conn, "sync.enabled")
        .ok()
        .flatten()
        .map(|s| s.value == "true")
        .unwrap_or(false);

    let last_sync_time =
        crate::db::repositories::setting_repo::get_setting(&conn, "sync.last_sync_time")
            .ok()
            .flatten()
            .map(|s| s.value);

    let configured =
        crate::db::repositories::setting_repo::get_setting(&conn, "sync.url")
            .ok()
            .flatten()
            .is_some()
            && crate::db::repositories::setting_repo::get_setting(&conn, "sync.username")
                .ok()
                .flatten()
                .is_some()
            && crate::db::repositories::setting_repo::get_setting(&conn, "sync.password")
                .ok()
                .flatten()
                .is_some();

    Ok(SyncStatus {
        enabled,
        configured,
        in_progress: *in_progress,
        last_sync_time,
    })
}

#[derive(serde::Serialize)]
pub struct SyncStatus {
    pub enabled: bool,
    pub configured: bool,
    pub in_progress: bool,
    pub last_sync_time: Option<String>,
}
