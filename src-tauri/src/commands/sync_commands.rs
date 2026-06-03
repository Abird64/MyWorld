use std::sync::Arc;
use tauri::State;

use crate::db::connection::{AppDataState, DbState};
use crate::db::repositories::setting_repo;
use crate::sync::lan_discovery::{DiscoveredPeer, LanDiscovery};
use crate::sync::lan_server::{self, LanServerState};
use crate::sync::r2_client::R2Client;
use crate::sync::remote_storage::RemoteStorage;
use crate::sync::sync_engine::{run_full_sync, SyncResult, SyncState};
use crate::sync::webdav_client::WebDavClient;

/// 测试连接（支持 WebDAV 和 R2）
#[tauri::command]
pub async fn sync_test_connection(
    storage_type: String,
    url: String,
    username: String,
    password: String,
    r2_account_id: String,
    r2_access_key: String,
    r2_secret_key: String,
    r2_bucket: String,
) -> Result<String, String> {
    match storage_type.as_str() {
        "r2" => {
            let client = R2Client::new(&r2_account_id, &r2_access_key, &r2_secret_key, &r2_bucket)?;
            client.test_connection().await
        }
        _ => {
            let client = WebDavClient::new(&url, &username, &password)?;
            client.test_connection().await
        }
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
        "r2" => {
            crate::db::repositories::setting_repo::get_setting(&conn, "sync.r2.account_id")
                .ok().flatten().is_some()
                && crate::db::repositories::setting_repo::get_setting(&conn, "sync.r2.access_key")
                    .ok().flatten().is_some()
                && crate::db::repositories::setting_repo::get_setting(&conn, "sync.r2.secret_key")
                    .ok().flatten().is_some()
                && crate::db::repositories::setting_repo::get_setting(&conn, "sync.r2.bucket")
                    .ok().flatten().is_some()
        }
        "lan" => {
            crate::db::repositories::setting_repo::get_setting(&conn, "sync.lan.peer_ip")
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

// ============= LAN 同步命令 =============

/// 启动 LAN 同步服务器 + mDNS 广播
#[tauri::command]
pub async fn lan_start_server(
    db_state: State<'_, DbState>,
    app_data: State<'_, AppDataState>,
    lan_server: State<'_, Arc<LanServerState>>,
    lan_discovery: State<'_, Arc<LanDiscovery>>,
    port: Option<u16>,
) -> Result<serde_json::Value, String> {
    let (sync_dir, device_name, site_id, preferred_port) = {
        let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
        let sync_dir = app_data.dir.clone();

        let device_name = setting_repo::get_setting(&conn, "sync.lan.device_name")
            .ok()
            .flatten()
            .map(|s| s.value)
            .unwrap_or_else(|| {
                std::env::var("COMPUTERNAME")
                    .or_else(|_| std::env::var("HOSTNAME"))
                    .unwrap_or_else(|_| "未知设备".to_string())
            });

        let site_id = setting_repo::get_setting(&conn, "sync.site_id")
            .ok()
            .flatten()
            .map(|s| s.value)
            .unwrap_or_default();

        let preferred_port = port.unwrap_or_else(|| {
            setting_repo::get_setting(&conn, "sync.lan.server_port")
                .ok()
                .flatten()
                .map(|s| s.value.parse().unwrap_or(9821))
                .unwrap_or(9821)
        });

        (sync_dir, device_name, site_id, preferred_port)
    };

    let actual_port =
        lan_server::start_lan_server(lan_server.inner().clone(), sync_dir, device_name.clone(), site_id, preferred_port)
            .await?;

    // 启动 mDNS 广播
    if let Err(e) = lan_discovery.advertise(&device_name, "", actual_port).await {
        log::warn!("mDNS 广播启动失败: {}", e);
    }
    if let Err(e) = lan_discovery.start_browse().await {
        log::warn!("mDNS 浏览启动失败: {}", e);
    }

    let ip = lan_server::get_local_ip();

    Ok(serde_json::json!({
        "port": actual_port,
        "ip": ip,
    }))
}

/// 停止 LAN 同步服务器
#[tauri::command]
pub async fn lan_stop_server(
    lan_server: State<'_, Arc<LanServerState>>,
    lan_discovery: State<'_, Arc<LanDiscovery>>,
) -> Result<(), String> {
    lan_server.stop().await;
    lan_discovery.unregister().await;
    Ok(())
}

/// 获取已发现的 LAN 设备列表
#[tauri::command]
pub async fn lan_discover_peers(
    lan_discovery: State<'_, Arc<LanDiscovery>>,
) -> Result<Vec<DiscoveredPeer>, String> {
    Ok(lan_discovery.get_peers().await)
}

/// 手动连接 LAN 设备
#[tauri::command]
pub async fn lan_connect_manual(
    lan_discovery: State<'_, Arc<LanDiscovery>>,
    host: String,
    port: u16,
) -> Result<DiscoveredPeer, String> {
    lan_discovery.connect_manual(&host, port).await
}

/// 获取本机局域网 IP
#[tauri::command]
pub fn lan_get_local_ip() -> String {
    lan_server::get_local_ip()
}

/// 测试连接指定 LAN 设备
#[tauri::command]
pub async fn lan_test_peer(
    lan_discovery: State<'_, Arc<LanDiscovery>>,
    host: String,
    port: u16,
) -> Result<String, String> {
    lan_discovery.test_peer(&host, port).await
}
