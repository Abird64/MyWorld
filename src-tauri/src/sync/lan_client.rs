use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::Deserialize;

use super::remote_storage::{RemoteFile, RemoteStorage};

/// 局域网同步客户端 — 通过 HTTP 连接对端设备的 LAN 服务器
pub struct LanClient {
    client: Client,
    base_url: String,
}

impl LanClient {
    pub fn new(base_url: &str) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("failed to build reqwest client");
        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }
}

#[derive(Deserialize)]
struct HealthResponse {
    device_name: String,
}

#[derive(Deserialize)]
struct ListEntry {
    href: String,
    display_name: String,
    last_modified: Option<String>,
    content_length: Option<u64>,
    is_collection: bool,
}

#[async_trait]
impl RemoteStorage for LanClient {
    async fn test_connection(&self) -> Result<String, String> {
        let resp = self
            .client
            .get(format!("{}/api/health", self.base_url))
            .header("X-Lantern-LAN", "1")
            .send()
            .await
            .map_err(|e| format!("无法连接对端设备: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("对端返回错误: {}", resp.status()));
        }

        let body: HealthResponse = resp
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        Ok(format!("已连接: {}", body.device_name))
    }

    async fn list_remote(&self, path: &str) -> Result<Vec<RemoteFile>, String> {
        let resp = self
            .client
            .get(format!("{}/api/list", self.base_url))
            .query(&[("path", path)])
            .header("X-Lantern-LAN", "1")
            .send()
            .await
            .map_err(|e| format!("列出目录失败: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("列出目录失败: {}", resp.status()));
        }

        let entries: Vec<ListEntry> = resp
            .json()
            .await
            .map_err(|e| format!("解析目录列表失败: {}", e))?;

        Ok(entries
            .into_iter()
            .map(|e| RemoteFile {
                href: e.href,
                display_name: e.display_name,
                last_modified: e.last_modified.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                }),
                content_length: e.content_length,
                is_collection: e.is_collection,
            })
            .collect())
    }

    async fn download(&self, remote_path: &str) -> Result<Vec<u8>, String> {
        let resp = self
            .client
            .get(format!("{}/api/file", self.base_url))
            .query(&[("path", remote_path)])
            .header("X-Lantern-LAN", "1")
            .send()
            .await
            .map_err(|e| format!("下载文件失败: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("下载文件失败: {}", resp.status()));
        }

        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| format!("读取文件内容失败: {}", e))
    }

    async fn upload(&self, remote_path: &str, data: &[u8]) -> Result<(), String> {
        let resp = self
            .client
            .put(format!("{}/api/file", self.base_url))
            .query(&[("path", remote_path)])
            .header("X-Lantern-LAN", "1")
            .body(data.to_vec())
            .send()
            .await
            .map_err(|e| format!("上传文件失败: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("上传文件失败: {}", resp.status()));
        }

        Ok(())
    }

    async fn ensure_dir(&self, path: &str) -> Result<(), String> {
        let resp = self
            .client
            .put(format!("{}/api/mkdir", self.base_url))
            .query(&[("path", path)])
            .header("X-Lantern-LAN", "1")
            .send()
            .await
            .map_err(|e| format!("创建目录失败: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("创建目录失败: {}", resp.status()));
        }

        Ok(())
    }

    fn relative_path_from_href(&self, href: &str) -> String {
        href.trim_end_matches('/').to_string()
    }
}
