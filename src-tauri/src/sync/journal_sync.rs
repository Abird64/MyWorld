use chrono::{DateTime, Utc};
use std::path::Path;

use super::remote_storage::{RemoteFile, RemoteStorage};

/// 同步日记文件（逐文件比较）
/// sync_images: 是否同步图片文件（由设置控制）
pub(crate) async fn sync_journals(
    client: &dyn RemoteStorage,
    local_dir: &Path,
    remote_dir: &str,
    sync_journal_images: bool,
    sync_chat_images: bool,
) -> Result<(u32, u32, u64, u64, Vec<String>), String> {
    let mut uploaded: u32 = 0;
    let mut downloaded: u32 = 0;
    let mut bytes_up: u64 = 0;
    let mut bytes_down: u64 = 0;
    let mut errors = Vec::new();

    let local_files = collect_local_md_files(local_dir)?;
    let remote_files = list_remote_recursive(client, remote_dir).await?;

    // 根据设置过滤文件
    let should_sync_file = |name: &str| -> bool {
        if name.ends_with(".md") {
            return true;
        }
        let lower = name.to_lowercase();
        let is_image = lower.ends_with(".jpg") || lower.ends_with(".jpeg")
            || lower.ends_with(".png") || lower.ends_with(".gif") || lower.ends_with(".webp");
        if !is_image {
            return false;
        }
        // 根据路径判断是日记图片还是聊天图片
        // 日记图片在 journals/ 下，聊天图片在 chat_images/ 下
        // 这里通过 name 前缀判断不太可靠，改用路径判断
        true // 先全部通过，下面按路径过滤
    };

    let local_files: Vec<_> = local_files.into_iter().filter(|(path, _)| {
        let name = path.rsplit('/').next().unwrap_or(path);
        if !should_sync_file(name) {
            return false;
        }
        let is_chat = path.starts_with("chat_images/");
        let is_journal_image = !is_chat && !path.ends_with(".md");
        if is_chat && !sync_chat_images {
            return false;
        }
        if is_journal_image && !sync_journal_images {
            return false;
        }
        true
    }).collect();

    log::info!(
        "[SYNC] journals: local_dir={:?}, remote_dir={}, local_count={}",
        local_dir, remote_dir, local_files.len()
    );

    let remote_map: std::collections::HashMap<String, &RemoteFile> = remote_files
        .iter()
        .filter(|f| {
            if f.is_collection { return false; }
            if !is_syncable_file(&f.display_name) { return false; }
            let is_chat = f.href.contains("chat_images/");
            let is_image = !f.display_name.ends_with(".md");
            if is_chat && !sync_chat_images { return false; }
            if is_image && !is_chat && !sync_journal_images { return false; }
            true
        })
        .filter_map(|f| {
            let norm_remote = remote_dir.trim_end_matches('/');
            let relative = if let Some(pos) = f.href.find(norm_remote) {
                &f.href[pos + norm_remote.len()..]
            } else {
                f.href.rsplit('/').next().unwrap_or("")
            };
            let relative = relative.trim_start_matches('/');
            if relative.is_empty() {
                None
            } else {
                Some((relative.to_string(), f))
            }
        })
        .collect();

    // 上传本地新增/更新的文件（每 3 个文件暂停 1 秒避免限流）
    let mut op_count: u32 = 0;
    for (rel_path, local_mtime) in &local_files {
        let local_full = local_dir.join(rel_path);
        match remote_map.get(rel_path) {
            None => {
                if let Ok(data) = std::fs::read(&local_full) {
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
                    op_count += 1;
                    if op_count % 3 == 0 {
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    }
                }
            }
            Some(remote_file) => {
                let should_upload = match (local_mtime, remote_file.last_modified) {
                    (Some(lm), Some(rm)) => lm > &rm,
                    (Some(_), None) => true,
                    _ => false,
                };
                if should_upload {
                    if let Ok(data) = std::fs::read(&local_full) {
                        let remote_path = format!("{}/{}", remote_dir, rel_path);
                        match client.upload(&remote_path, &data).await {
                            Ok(()) => {
                                uploaded += 1;
                                bytes_up += data.len() as u64;
                            }
                            Err(e) => errors.push(format!("上传 {} 失败: {}", rel_path, e)),
                        }
                        op_count += 1;
                        if op_count % 3 == 0 {
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                        }
                    }
                }
            }
        }
    }

    // 下载远端新增/更新的文件（每 3 个文件暂停 1 秒避免限流）
    let mut op_count: u32 = 0;
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
                    op_count += 1;
                    if op_count % 3 == 0 {
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
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
    client: &dyn RemoteStorage,
    path: &str,
) -> Result<Vec<RemoteFile>, String> {
    let mut all_files = Vec::new();
    let entries = client.list_remote(path).await?;

    for entry in entries {
        if entry.is_collection {
            let sub_path = if entry.href.starts_with('/') {
                client.relative_path_from_href(&entry.href)
            } else {
                entry.href.trim_end_matches('/').to_string()
            };
            if sub_path.is_empty() {
                continue;
            }
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            match Box::pin(list_remote_recursive(client, &sub_path)).await {
                Ok(mut sub_files) => all_files.append(&mut sub_files),
                Err(e) => {
                    log::warn!("[SYNC] 递归列出子目录 {} 失败: {}", sub_path, e);
                }
            }
        } else {
            all_files.push(entry);
        }
    }

    Ok(all_files)
}

/// 获取文件修改时间（UTC）
fn fs_mtime(path: &Path) -> Result<Option<DateTime<Utc>>, String> {
    let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    let dt: DateTime<Utc> = modified.into();
    Ok(Some(dt))
}

/// 递归收集本地 .md 文件（返回相对路径 → mtime）
fn is_syncable_file(name: &str) -> bool {
    if name.ends_with(".md") {
        return true;
    }
    let lower = name.to_lowercase();
    lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".png")
        || lower.ends_with(".gif")
        || lower.ends_with(".webp")
}

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
            if is_syncable_file(name) {
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
