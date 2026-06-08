use tauri::State;

use crate::db::connection::{AppDataState, DbState};
use crate::db::repositories::setting_repo;
use crate::sync::oss_client::OssClient;
use crate::sync::remote_storage::RemoteStorage;
use crate::sync::sync_engine::{run_full_sync, SyncResult, SyncState};
use crate::sync::webdav_client::WebDavClient;

/// 测试连接（支持 OSS 和 WebDAV）
#[tauri::command]
pub async fn sync_test_connection(
    storage_type: String,
    url: String,
    username: String,
    password: String,
    oss_access_key_id: String,
    oss_access_key_secret: String,
    oss_bucket: String,
    oss_region: String,
) -> Result<String, String> {
    if storage_type == "oss" {
        let client = OssClient::new(&oss_bucket, &oss_region, &oss_access_key_id, &oss_access_key_secret)?;
        client.test_connection().await
    } else {
        let client = WebDavClient::new(&url, &username, &password)?;
        client.test_connection().await
    }
}

/// 启用/禁用同步
/// 启用时确保设备有唯一 site_id（若已有则重新生成，避免与其他设备冲突）
#[tauri::command]
pub fn sync_set_enabled(
    db_state: State<'_, DbState>,
    enabled: bool,
) -> Result<(), String> {
    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;

    if enabled {
        // 生成新的唯一 site_id（不论是否已有，都重新生成，确保与其他设备不同）
        let id = nanoid::nanoid!(12);
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('sync.site_id', ?1, ?2)",
            rusqlite::params![id, now],
        ).map_err(|e| format!("设置 site_id 失败: {}", e))?;
        log::info!("[SYNC] 启用同步，生成 site_id: {}", id);

        // 重置 last_sync_time，确保首次同步全量导出
        setting_repo::set_setting(&conn, "sync.last_sync_time", "1970-01-01T00:00:00+00:00")?;
    }

    setting_repo::set_setting(&conn, "sync.enabled", if enabled { "true" } else { "false" })?;
    Ok(())
}

/// 立即同步
#[tauri::command]
pub async fn sync_now(
    db_state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    sync_state: State<'_, SyncState>,
) -> Result<SyncResult, String> {
    // 检测并重置卡死的同步状态
    sync_state.check_and_reset_if_stale();

    // 检查是否在限流冷却期内
    if sync_state.is_rate_limited() {
        return Err("上次同步被坚果云限流，请等待几分钟后再试".to_string());
    }

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
    sync_state.mark_started();

    // 5 分钟超时保护，防止 WebDAV 操作卡死
    let result = match tokio::time::timeout(
        std::time::Duration::from_secs(300),
        run_full_sync(&db_state, &app_data),
    ).await {
        Ok(r) => r,
        Err(_) => SyncResult::error("同步超时，请检查网络连接".to_string()),
    };

    // 如果被限流，设置冷却期
    if result.has_rate_limit_error() {
        sync_state.set_rate_limited();
    }

    // 标记同步结束
    sync_state.mark_finished();

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

    let storage_type = crate::db::repositories::setting_repo::get_setting(&conn, "sync.storage_type")
        .ok()
        .flatten()
        .map(|s| s.value)
        .unwrap_or_else(|| "webdav".to_string());

    let configured = match storage_type.as_str() {
        "oss" => {
            crate::db::repositories::setting_repo::get_setting(&conn, "sync.oss.access_key_id")
                .ok().flatten().is_some()
                && crate::db::repositories::setting_repo::get_setting(&conn, "sync.oss.access_key_secret")
                    .ok().flatten().is_some()
                && crate::db::repositories::setting_repo::get_setting(&conn, "sync.oss.bucket")
                    .ok().flatten().is_some()
                && crate::db::repositories::setting_repo::get_setting(&conn, "sync.oss.region")
                    .ok().flatten().is_some()
        }
        _ => {
            crate::db::repositories::setting_repo::get_setting(&conn, "sync.url")
                .ok().flatten().is_some()
                && crate::db::repositories::setting_repo::get_setting(&conn, "sync.username")
                    .ok().flatten().is_some()
                && crate::db::repositories::setting_repo::get_setting(&conn, "sync.password")
                    .ok().flatten().is_some()
        }
    };

    Ok(SyncStatus {
        enabled,
        configured,
        in_progress: *in_progress,
        last_sync_time,
        storage_type,
    })
}

#[derive(serde::Serialize)]
pub struct SyncStatus {
    pub enabled: bool,
    pub configured: bool,
    pub in_progress: bool,
    pub last_sync_time: Option<String>,
    pub storage_type: String,
}
