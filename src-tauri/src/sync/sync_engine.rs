use chrono::{DateTime, Utc};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use tauri::Manager;

use super::webdav_client::{RemoteFile, WebDavClient};
use crate::db::connection::{AppDataState, DbState};
use crate::db::repositories::setting_repo;

/// 同步结果
#[derive(Debug, Clone, Serialize)]
pub struct SyncResult {
    pub success: bool,
    pub db_action: String,
    pub journals_uploaded: u32,
    pub journals_downloaded: u32,
    pub errors: Vec<String>,
    pub message: String,
    pub bytes_uploaded: u64,
    pub bytes_downloaded: u64,
}

/// 同步状态（Tauri 管理的状态）
pub struct SyncState {
    pub in_progress: Mutex<bool>,
}

impl SyncState {
    pub fn new() -> Self {
        Self {
            in_progress: Mutex::new(false),
        }
    }
}

/// 同步配置
struct SyncConfig {
    url: String,
    username: String,
    password: String,
    remote_path: String,
}

impl SyncResult {
    fn new() -> Self {
        Self {
            success: false,
            db_action: "none".to_string(),
            journals_uploaded: 0,
            journals_downloaded: 0,
            errors: Vec::new(),
            message: String::new(),
            bytes_uploaded: 0,
            bytes_downloaded: 0,
        }
    }

    fn error(msg: String) -> Self {
        Self {
            success: false,
            db_action: "error".to_string(),
            journals_uploaded: 0,
            journals_downloaded: 0,
            errors: vec![msg.clone()],
            message: msg,
            bytes_uploaded: 0,
            bytes_downloaded: 0,
        }
    }
}

/// 从设置中读取同步配置
fn read_config(conn: &rusqlite::Connection) -> Result<SyncConfig, String> {
    let url = setting_repo::get_setting(conn, "sync.url")?
        .map(|s| s.value)
        .ok_or("未配置 WebDAV 服务器地址")?;
    let username = setting_repo::get_setting(conn, "sync.username")?
        .map(|s| s.value)
        .ok_or("未配置 WebDAV 用户名")?;
    let password = setting_repo::get_setting(conn, "sync.password")?
        .map(|s| s.value)
        .ok_or("未配置 WebDAV 密码")?;
    let remote_path = setting_repo::get_setting(conn, "sync.remote_path")?
        .map(|s| s.value)
        .unwrap_or_else(|| "/lantern/".to_string());

    Ok(SyncConfig {
        url,
        username,
        password,
        remote_path,
    })
}

/// 读取上次同步时间
fn last_sync_time(conn: &rusqlite::Connection) -> Option<DateTime<Utc>> {
    setting_repo::get_setting(conn, "sync.last_sync_time")
        .ok()
        .flatten()
        .and_then(|s| DateTime::parse_from_rfc3339(&s.value).ok())
        .map(|dt| dt.with_timezone(&Utc))
}

/// 运行完整同步
pub async fn run_full_sync(db_state: &DbState, app_data: &AppDataState) -> SyncResult {
    let config = {
        let conn = match db_state.conn.lock() {
            Ok(c) => c,
            Err(e) => return SyncResult::error(format!("获取数据库锁失败: {}", e)),
        };
        match read_config(&conn) {
            Ok(c) => c,
            Err(e) => return SyncResult::error(e),
        }
    };

    let client = WebDavClient::new(&config.url, &config.username, &config.password);
    let db_path = app_data.dir.join("lantern.db");

    // 确保远端目录存在
    let remote_path = config.remote_path.trim_end_matches('/');
    if let Err(e) = client.ensure_dir(remote_path).await {
        return SyncResult::error(format!("创建远端目录失败: {}", e));
    }
    let _ = client
        .ensure_dir(&format!("{}/backups", remote_path))
        .await;
    let _ = client
        .ensure_dir(&format!("{}/journals", remote_path))
        .await;

    let mut result = SyncResult::new();
    let mut bytes_uploaded: u64 = 0;
    let mut bytes_downloaded: u64 = 0;

    // === 1. 同步数据库 ===
    match sync_database(
        &client,
        &db_path,
        &format!("{}/lantern.db", remote_path),
        &format!("{}/backups", remote_path),
        db_state,
    )
    .await
    {
        Ok((action, up, down)) => {
            result.db_action = action;
            bytes_uploaded += up;
            bytes_downloaded += down;
        }
        Err(e) => {
            result.errors.push(format!("数据库同步失败: {}", e));
        }
    }

    // === 2. 同步日记文件 ===
    let journals_local = app_data.dir.join("journals");
    let journals_remote = format!("{}/journals", remote_path);
    match sync_journals(&client, &journals_local, &journals_remote).await {
        Ok((uploaded, downloaded, up_bytes, down_bytes, errs)) => {
            result.journals_uploaded = uploaded;
            result.journals_downloaded = downloaded;
            bytes_uploaded += up_bytes;
            bytes_downloaded += down_bytes;
            result.errors.extend(errs);
        }
        Err(e) => {
            result.errors.push(format!("日记同步失败: {}", e));
        }
    }

    // === 3. 记录同步时间 ===
    if result.errors.is_empty() {
        let now = Utc::now().to_rfc3339();
        if let Ok(conn) = db_state.conn.lock() {
            let _ = setting_repo::set_setting(&conn, "sync.last_sync_time", &now);
        }
    }

    result.bytes_uploaded = bytes_uploaded;
    result.bytes_downloaded = bytes_downloaded;
    result.success = result.errors.is_empty();
    result.message = if result.errors.is_empty() {
        format!(
            "同步完成 — 数据库: {}, 日记上传: {}, 下载: {}",
            result.db_action, result.journals_uploaded, result.journals_downloaded
        )
    } else {
        format!("同步完成但有错误: {}", result.errors.join("; "))
    };

    result
}

/// 同步数据库文件
async fn sync_database(
    client: &WebDavClient,
    local_db: &Path,
    remote_db: &str,
    remote_backups: &str,
    db_state: &DbState,
) -> Result<(String, u64, u64), String> {
    let local_exists = local_db.exists();
    let local_mtime = if local_exists {
        fs_mtime(local_db)?
    } else {
        None
    };

    // 检查远端是否有 DB — 对父目录做 PROPFIND（直接对文件 PROPFIND 在坚果云上会 404）
    let remote_dir = remote_db.rfind('/').map(|i| &remote_db[..i]).unwrap_or("/");
    let remote_files = client.list_remote(remote_dir).await?;
    let remote_db_file = remote_files
        .iter()
        .find(|f| f.display_name == "lantern.db" || f.href.ends_with("/lantern.db"));

    let last_sync = {
        let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
        last_sync_time(&conn)
    };

    match (local_exists, remote_db_file) {
        // 本地有，远端没有 → 上传
        (true, None) => {
            let data = std::fs::read(local_db).map_err(|e| e.to_string())?;
            let size = data.len() as u64;
            client.upload(remote_db, &data).await?;
            Ok(("uploaded".to_string(), size, 0))
        }
        // 本地没有，远端有 → 下载
        (false, Some(_)) => {
            let data = client.download(remote_db).await?;
            let size = data.len() as u64;
            std::fs::write(local_db, &data).map_err(|e| e.to_string())?;
            Ok(("downloaded".to_string(), 0, size))
        }
        // 都有 → 比较修改时间
        (true, Some(remote_file)) => {
            let remote_mtime = remote_file.last_modified;
            let local_changed = match (local_mtime, last_sync) {
                (Some(lm), Some(ls)) => lm > ls,
                (Some(_), None) => true,
                _ => false,
            };
            let remote_changed = match (remote_mtime, last_sync) {
                (Some(rm), Some(ls)) => rm > ls,
                (Some(_), None) => true,
                _ => false,
            };

            match (local_changed, remote_changed) {
                // 只有本地改了 → 上传
                (true, false) => {
                    let data = std::fs::read(local_db).map_err(|e| e.to_string())?;
                    let size = data.len() as u64;
                    client.upload(remote_db, &data).await?;
                    Ok(("uploaded".to_string(), size, 0))
                }
                // 只有远端改了 → 下载
                (false, true) => {
                    let data = client.download(remote_db).await?;
                    let size = data.len() as u64;
                    {
                        let mut conn = db_state.conn.lock().map_err(|e| e.to_string())?;
                        conn.execute_batch("SELECT 1").map_err(|e| e.to_string())?;
                    }
                    std::fs::write(local_db, &data).map_err(|e| e.to_string())?;
                    {
                        let mut conn = db_state.conn.lock().map_err(|e| e.to_string())?;
                        let new_conn =
                            rusqlite::Connection::open(local_db).map_err(|e| e.to_string())?;
                        new_conn
                            .pragma_update(None, "journal_mode", "WAL")
                            .map_err(|e| e.to_string())?;
                        new_conn
                            .pragma_update(None, "foreign_keys", "ON")
                            .map_err(|e| e.to_string())?;
                        *conn = new_conn;
                    }
                    Ok(("downloaded".to_string(), 0, size))
                }
                // 两端都改了 → 备份本地 + 下载远端
                (true, true) => {
                    let local_data = std::fs::read(local_db).map_err(|e| e.to_string())?;
                    let backup_name = format!("lantern-{}.db", Utc::now().format("%Y%m%dT%H%M%S"));
                    let backup_path = format!("{}/{}", remote_backups, backup_name);
                    let _ = client.upload(&backup_path, &local_data).await;

                    let remote_data = client.download(remote_db).await?;
                    let size = remote_data.len() as u64;
                    {
                        let mut conn = db_state.conn.lock().map_err(|e| e.to_string())?;
                        conn.execute_batch("SELECT 1").map_err(|e| e.to_string())?;
                    }
                    std::fs::write(local_db, &remote_data).map_err(|e| e.to_string())?;
                    {
                        let mut conn = db_state.conn.lock().map_err(|e| e.to_string())?;
                        let new_conn =
                            rusqlite::Connection::open(local_db).map_err(|e| e.to_string())?;
                        new_conn
                            .pragma_update(None, "journal_mode", "WAL")
                            .map_err(|e| e.to_string())?;
                        new_conn
                            .pragma_update(None, "foreign_keys", "ON")
                            .map_err(|e| e.to_string())?;
                        *conn = new_conn;
                    }

                    cleanup_backups(client, remote_backups).await;

                    Ok(("conflict_backup".to_string(), local_data.len() as u64, size))
                }
                // 都没改 → 跳过
                (false, false) => Ok(("unchanged".to_string(), 0, 0)),
            }
        }
        // 都没有 → 无需操作
        (false, None) => Ok(("none".to_string(), 0, 0)),
    }
}

/// 同步日记文件（逐文件比较）
async fn sync_journals(
    client: &WebDavClient,
    local_dir: &Path,
    remote_dir: &str,
) -> Result<(u32, u32, u64, u64, Vec<String>), String> {
    let mut uploaded: u32 = 0;
    let mut downloaded: u32 = 0;
    let mut bytes_up: u64 = 0;
    let mut bytes_down: u64 = 0;
    let mut errors = Vec::new();

    let local_files = collect_local_md_files(local_dir)?;
    let remote_files = list_remote_recursive(client, remote_dir).await?;

    let remote_map: std::collections::HashMap<String, &RemoteFile> = remote_files
        .iter()
        .filter(|f| !f.is_collection && f.display_name.ends_with(".md"))
        .filter_map(|f| {
            let relative = f
                .href
                .strip_prefix(remote_dir)
                .or_else(|| {
                    f.href
                        .strip_prefix(&format!("{}/", remote_dir.trim_end_matches('/')))
                })
                .unwrap_or(&f.href);
            let relative = relative.trim_start_matches('/');
            if relative.is_empty() {
                None
            } else {
                Some((relative.to_string(), f))
            }
        })
        .collect();

    // 上传本地新增/更新的文件
    for (rel_path, local_mtime) in &local_files {
        let local_full = local_dir.join(rel_path);
        match remote_map.get(rel_path) {
            None => {
                match std::fs::read(&local_full) {
                    Ok(data) => {
                        let remote_path = format!("{}/{}", remote_dir, rel_path);
                        if let Some(parent) = Path::new(rel_path).parent() {
                            if !parent.as_os_str().is_empty() {
                                let dir_path = format!("{}/{}", remote_dir, parent.display());
                                let _ = client.ensure_dir(&dir_path).await;
                            }
                        }
                        match client.upload(&remote_path, &data).await {
                            Ok(()) => {
                                uploaded += 1;
                                bytes_up += data.len() as u64;
                            }
                            Err(e) => errors.push(format!("上传 {} 失败: {}", rel_path, e)),
                        }
                    }
                    Err(e) => errors.push(format!("读取 {} 失败: {}", rel_path, e)),
                }
            }
            Some(remote_file) => {
                let should_upload = match (local_mtime, remote_file.last_modified) {
                    (Some(lm), Some(rm)) => lm > &rm,
                    (Some(_), None) => true,
                    _ => false,
                };
                if should_upload {
                    match std::fs::read(&local_full) {
                        Ok(data) => {
                            let remote_path = format!("{}/{}", remote_dir, rel_path);
                            match client.upload(&remote_path, &data).await {
                                Ok(()) => {
                                    uploaded += 1;
                                    bytes_up += data.len() as u64;
                                }
                                Err(e) => {
                                    errors.push(format!("上传 {} 失败: {}", rel_path, e))
                                }
                            }
                        }
                        Err(e) => errors.push(format!("读取 {} 失败: {}", rel_path, e)),
                    }
                }
            }
        }
    }

    // 下载远端新增/更新的文件
    for (remote_rel, remote_file) in &remote_map {
        let local_full = local_dir.join(remote_rel);
        let local_mtime = if local_full.exists() {
            fs_mtime(&local_full)?
        } else {
            None
        };

        let should_download = match local_mtime {
            None => true,
            Some(lm) => match remote_file.last_modified {
                Some(rm) => rm > lm,
                None => false,
            },
        };

        if should_download {
            match client.download(&remote_file.href).await {
                Ok(data) => {
                    if let Some(parent) = local_full.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    match std::fs::write(&local_full, &data) {
                        Ok(()) => {
                            downloaded += 1;
                            bytes_down += data.len() as u64;
                        }
                        Err(e) => errors.push(format!("写入 {} 失败: {}", remote_rel, e)),
                    }
                }
                Err(e) => errors.push(format!("下载 {} 失败: {}", remote_rel, e)),
            }
        }
    }

    Ok((uploaded, downloaded, bytes_up, bytes_down, errors))
}

/// 递归列出远端目录下所有文件
async fn list_remote_recursive(
    client: &WebDavClient,
    path: &str,
) -> Result<Vec<RemoteFile>, String> {
    let mut all_files = Vec::new();
    let entries = client.list_remote(path).await?;

    for entry in entries {
        if entry.is_collection {
            let sub_path = format!("{}/{}", path.trim_end_matches('/'), entry.display_name);
            match Box::pin(list_remote_recursive(client, &sub_path)).await {
                Ok(mut sub_files) => all_files.append(&mut sub_files),
                Err(_) => {}
            }
        } else {
            all_files.push(entry);
        }
    }

    Ok(all_files)
}

/// 清理旧备份，保留最近 5 个
async fn cleanup_backups(client: &WebDavClient, remote_backups: &str) {
    let entries = match client.list_remote(remote_backups).await {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut db_backups: Vec<RemoteFile> = entries
        .into_iter()
        .filter(|f| !f.is_collection && f.display_name.ends_with(".db"))
        .collect();

    if db_backups.len() <= 5 {
        return;
    }

    db_backups.sort_by(|a, b| {
        a.last_modified
            .unwrap_or_default()
            .cmp(&b.last_modified.unwrap_or_default())
    });

    let to_delete = db_backups.len() - 5;
    for backup in db_backups.iter().take(to_delete) {
        let path = format!(
            "{}/{}",
            remote_backups.trim_end_matches('/'),
            backup.display_name
        );
        let _ = client.delete(&path).await;
    }
}

/// 获取文件修改时间（UTC）
fn fs_mtime(path: &Path) -> Result<Option<DateTime<Utc>>, String> {
    let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    let dt: DateTime<Utc> = modified.into();
    Ok(Some(dt))
}

/// 递归收集本地 .md 文件（返回相对路径 → mtime）
fn collect_local_md_files(dir: &Path) -> Result<Vec<(String, Option<DateTime<Utc>>)>, String> {
    let mut files = Vec::new();
    if !dir.exists() {
        return Ok(files);
    }
    collect_md_recursive(dir, dir, &mut files)?;
    Ok(files)
}

fn collect_md_recursive(
    base: &Path,
    current: &Path,
    files: &mut Vec<(String, Option<DateTime<Utc>>)>,
) -> Result<(), String> {
    for entry in std::fs::read_dir(current).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            collect_md_recursive(base, &path, files)?;
        } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.ends_with(".md") {
                let relative = path
                    .strip_prefix(base)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                let mtime = fs_mtime(&path).ok().flatten();
                files.push((relative, mtime));
            }
        }
    }
    Ok(())
}

/// 后台同步任务
pub fn spawn_background_sync(handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;

        loop {
            let should_sync = {
                let db_state = handle.state::<DbState>();
                let guard = db_state.conn.lock();
                match guard {
                    Ok(conn) => {
                        let enabled = setting_repo::get_setting(&conn, "sync.enabled")
                            .ok()
                            .flatten()
                            .map(|s| s.value == "true")
                            .unwrap_or(false);
                        if !enabled {
                            false
                        } else {
                            let last = setting_repo::get_setting(&conn, "sync.last_sync_time")
                                .ok()
                                .flatten()
                                .map(|s| s.value);
                            let interval: u64 =
                                setting_repo::get_setting(&conn, "sync.interval_minutes")
                                    .ok()
                                    .flatten()
                                    .map(|s| s.value.parse().unwrap_or(30))
                                    .unwrap_or(30);
                            match last {
                                Some(t) => {
                                    let elapsed = DateTime::parse_from_rfc3339(&t)
                                        .ok()
                                        .map(|t| {
                                            Utc::now().signed_duration_since(t).num_seconds()
                                                as u64
                                        })
                                        .unwrap_or(u64::MAX);
                                    elapsed >= interval * 60
                                }
                                None => true,
                            }
                        }
                    }
                    Err(_) => false,
                }
            };

            if should_sync {
                let sync_state = handle.state::<SyncState>();
                let in_progress = sync_state
                    .in_progress
                    .lock()
                    .map(|g| *g)
                    .unwrap_or(true);

                if !in_progress {
                    {
                        let mut guard = sync_state.in_progress.lock().unwrap();
                        *guard = true;
                    }

                    let db_state = handle.state::<DbState>();
                    let app_data = handle.state::<AppDataState>();
                    let result = run_full_sync(&db_state, &app_data).await;

                    log::info!(
                        "Background sync completed: {} - {}",
                        if result.success { "OK" } else { "WARN" },
                        result.message
                    );

                    {
                        let mut guard = sync_state.in_progress.lock().unwrap();
                        *guard = false;
                    }
                }
            }

            let sleep_secs = {
                let db_state = handle.state::<DbState>();
                let guard = db_state.conn.lock();
                guard
                    .ok()
                    .and_then(|conn| {
                        setting_repo::get_setting(&conn, "sync.interval_minutes")
                            .ok()
                            .flatten()
                            .map(|s| s.value.parse::<u64>().unwrap_or(30) * 60)
                    })
                    .unwrap_or(1800)
            };
            tokio::time::sleep(std::time::Duration::from_secs(sleep_secs)).await;
        }
    });
}
