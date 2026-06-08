use async_trait::async_trait;
use base64::Engine;
use chrono::{DateTime, Utc};
use reqwest::Client;
use std::sync::Mutex;
use std::time::Instant;

use super::remote_storage::{RemoteFile, RemoteStorage};

/// 请求节流：两次请求之间至少间隔 200ms（参考坚果云官方插件）
const MIN_REQUEST_INTERVAL_MS: u64 = 200;
/// 503 限流后等待时间：60 秒（坚果云限流窗口较长）
const RATE_LIMIT_WAIT_SECS: u64 = 60;
/// 最大重试次数
const MAX_RETRIES: u32 = 5;

/// WebDAV 客户端（带请求节流）
pub struct WebDavClient {
    client: Client,
    base_url: String,
    auth_header: String,
    /// 上次请求时间，用于节流
    last_request: Mutex<Instant>,
}

impl WebDavClient {
    pub fn new(url: &str, username: &str, password: &str) -> Result<Self, String> {
        let base_url = url.trim_end_matches('/').to_string();
        let credentials = format!("{}:{}", username, password);
        let encoded = base64::engine::general_purpose::STANDARD.encode(credentials.as_bytes());
        let auth_header = format!("Basic {}", encoded);

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

        Ok(Self {
            client,
            base_url,
            auth_header,
            last_request: Mutex::new(Instant::now() - std::time::Duration::from_secs(1)),
        })
    }

    /// 构建完整 URL
    fn full_url(&self, path: &str) -> String {
        let path = path.trim_start_matches('/');
        format!("{}/{}", self.base_url, path)
    }

    /// 请求节流：确保两次请求之间至少间隔 200ms
    async fn throttle(&self) {
        let elapsed = {
            let last = self.last_request.lock().unwrap_or_else(|e| e.into_inner());
            last.elapsed()
        };
        let min_interval = std::time::Duration::from_millis(MIN_REQUEST_INTERVAL_MS);
        if elapsed < min_interval {
            tokio::time::sleep(min_interval - elapsed).await;
        }
        // 更新上次请求时间
        if let Ok(mut last) = self.last_request.lock() {
            *last = Instant::now();
        }
    }

    /// 503 限流后等待（参考坚果云官方插件：固定等待 60 秒）
    async fn rate_limit_wait(attempt: u32) {
        log::warn!("[WEBDAV] 被限流 (503)，等待 {} 秒后重试 (第 {} 次)", RATE_LIMIT_WAIT_SECS, attempt + 1);
        tokio::time::sleep(std::time::Duration::from_secs(RATE_LIMIT_WAIT_SECS)).await;
    }

    /// 判断是否为可重试的状态码（限流/临时不可用）
    fn is_retryable(status: u16) -> bool {
        status == 503 || status == 429
    }
}

#[async_trait]
impl RemoteStorage for WebDavClient {
    /// 测试连接 — 尝试 PROPFIND，若 400 则降级为 PUT 测试
    async fn test_connection(&self) -> Result<String, String> {
        self.throttle().await;
        let url = self.full_url("");
        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:resourcetype/></D:prop>
</D:propfind>"#;

        let resp = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").expect("invalid HTTP method constant"), &url)
            .header("Authorization", &self.auth_header)
            .header("Depth", "0")
            .header("Content-Type", "application/xml")
            .body(body)
            .send()
            .await
            .map_err(|e| format!("连接失败: {}", e))?;

        let status = resp.status();
        let resp_text = resp.text().await.unwrap_or_default();
        log::info!("[WEBDAV] test_connection url={} status={} body={}", url, status, resp_text.chars().take(300).collect::<String>());

        if status.is_success() || status.as_u16() == 207 {
            return Ok("连接成功".to_string());
        }

        // 401/403 → 认证问题
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err("认证失败，请检查用户名和应用密码".to_string());
        }

        // 400 → 某些 WebDAV 服务器（如坚果云）对根路径 PROPFIND 返回 400
        // 降级：用 PUT 一个临时文件来验证连接和认证
        if status.as_u16() == 400 {
            log::info!("[WEBDAV] PROPFIND returned 400, falling back to PUT test");
            self.throttle().await;
            let test_path = format!("{}/.connection_test", self.base_url);
            let test_data = b"lantern-connection-test";
            let put_resp = self
                .client
                .put(&test_path)
                .header("Authorization", &self.auth_header)
                .body(test_data.to_vec())
                .send()
                .await
                .map_err(|e| format!("连接失败: {}", e))?;

            let put_status = put_resp.status();
            log::info!("[WEBDAV] PUT test status={}", put_status);

            if put_status.is_success() || put_status.as_u16() == 201 || put_status.as_u16() == 204 {
                // 清理测试文件
                let _ = self.delete(".connection_test").await;
                return Ok("连接成功".to_string());
            }

            if put_status.as_u16() == 401 || put_status.as_u16() == 403 {
                return Err("认证失败，请检查用户名和应用密码".to_string());
            }

            return Err(format!("服务器返回错误: {} {}", status, resp_text.chars().take(200).collect::<String>()));
        }

        Err(format!("服务器返回错误: {} {}", status, resp_text.chars().take(200).collect::<String>()))
    }

    /// 列出目录下的文件（PROPFIND Depth:1，带节流和 503 重试）
    async fn list_remote(&self, path: &str) -> Result<Vec<RemoteFile>, String> {
        let url = self.full_url(path);
        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:resourcetype/>
    <D:getlastmodified/>
    <D:getcontentlength/>
    <D:displayname/>
  </D:prop>
</D:propfind>"#;

        for attempt in 0..MAX_RETRIES {
            self.throttle().await;
            let resp = self
                .client
                .request(reqwest::Method::from_bytes(b"PROPFIND").expect("invalid HTTP method constant"), &url)
                .header("Authorization", &self.auth_header)
                .header("Depth", "1")
                .header("Content-Type", "application/xml")
                .body(body)
                .send()
                .await
                .map_err(|e| format!("PROPFIND 失败: {}", e))?;

            let status = resp.status().as_u16();
            if Self::is_retryable(status) {
                Self::rate_limit_wait(attempt).await;
                continue;
            }
            if !resp.status().is_success() && status != 207 {
                return Err(format!("PROPFIND 返回 {}", status));
            }

            let text = resp.text().await.map_err(|e| e.to_string())?;
            return parse_propfind_response(&text, path, &self.base_url);
        }
        Err("PROPFIND 失败: 多次重试后仍被限流".to_string())
    }

    /// 从 href 中提取相对路径（公开版本，返回 owned String）
    fn relative_path_from_href(&self, href: &str) -> String {
        self.relative_path(href).trim_end_matches('/').to_string()
    }

    /// 下载文件（带节流和 503 重试）
    async fn download(&self, remote_path: &str) -> Result<Vec<u8>, String> {
        let url = self.full_url(self.relative_path(remote_path));
        for attempt in 0..MAX_RETRIES {
            self.throttle().await;
            let resp = self
                .client
                .get(&url)
                .header("Authorization", &self.auth_header)
                .send()
                .await
                .map_err(|e| format!("下载失败: {}", e))?;

            let status = resp.status().as_u16();
            if Self::is_retryable(status) {
                Self::rate_limit_wait(attempt).await;
                continue;
            }
            if !resp.status().is_success() {
                return Err(format!("下载返回 {}", status));
            }
            return resp.bytes()
                .await
                .map(|b| b.to_vec())
                .map_err(|e| format!("读取响应失败: {}", e));
        }
        Err("下载失败: 多次重试后仍被限流".to_string())
    }

    /// 上传文件（带节流和 503 重试）
    async fn upload(&self, remote_path: &str, data: &[u8]) -> Result<(), String> {
        let url = self.full_url(remote_path);
        for attempt in 0..MAX_RETRIES {
            self.throttle().await;
            let resp = self
                .client
                .put(&url)
                .header("Authorization", &self.auth_header)
                .body(data.to_vec())
                .send()
                .await
                .map_err(|e| format!("上传失败: {}", e))?;

            let status = resp.status().as_u16();
            if Self::is_retryable(status) {
                Self::rate_limit_wait(attempt).await;
                continue;
            }
            if !resp.status().is_success() {
                return Err(format!("上传返回 {}", status));
            }
            return Ok(());
        }
        Err("上传失败: 多次重试后仍被限流".to_string())
    }

    /// 递归创建目录（确保父目录存在）
    async fn ensure_dir(&self, path: &str) -> Result<(), String> {
        match self.mkdir(path).await {
            Ok(()) => return Ok(()),
            Err(_) => {}
        }
        let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        let mut current = String::new();
        for part in parts {
            current.push('/');
            current.push_str(part);
            let _ = self.mkdir(&current).await;
        }
        Ok(())
    }
}

/// 非 trait 方法（供内部和 sync_commands 使用）
impl WebDavClient {
    /// 从 href 中提取相对路径（去掉 base_url 的路径前缀）
    fn relative_path<'a>(&self, href: &'a str) -> &'a str {
        if let Some(scheme_end) = self.base_url.find("://") {
            let after_scheme = &self.base_url[scheme_end + 3..];
            if let Some(path_start) = after_scheme.find('/') {
                let base_path = &after_scheme[path_start..];
                if let Some(stripped) = href.strip_prefix(base_path) {
                    return stripped.trim_start_matches('/');
                }
            }
        }
        href.trim_start_matches('/')
    }

    /// 创建目录（MKCOL）
    pub async fn mkdir(&self, remote_path: &str) -> Result<(), String> {
        self.throttle().await;
        let url = self.full_url(remote_path);
        let resp = self
            .client
            .request(reqwest::Method::from_bytes(b"MKCOL").expect("invalid HTTP method constant"), &url)
            .header("Authorization", &self.auth_header)
            .send()
            .await
            .map_err(|e| format!("MKCOL 失败: {}", e))?;
        let status = resp.status();
        if status.is_success() || status.as_u16() == 405 {
            Ok(())
        } else {
            Err(format!("MKCOL 返回 {}", status))
        }
    }

    /// 检查文件是否存在（HEAD）
    pub async fn exists(&self, remote_path: &str) -> Result<bool, String> {
        self.throttle().await;
        let url = self.full_url(remote_path);
        let resp = self
            .client
            .head(&url)
            .header("Authorization", &self.auth_header)
            .send()
            .await
            .map_err(|e| format!("HEAD 请求失败: {}", e))?;
        Ok(resp.status().is_success())
    }

    /// 删除文件
    pub async fn delete(&self, remote_path: &str) -> Result<(), String> {
        self.throttle().await;
        let url = self.full_url(remote_path);
        let resp = self
            .client
            .delete(&url)
            .header("Authorization", &self.auth_header)
            .send()
            .await
            .map_err(|e| format!("删除失败: {}", e))?;
        if resp.status().is_success() || resp.status().as_u16() == 404 {
            Ok(())
        } else {
            Err(format!("删除返回 {}", resp.status()))
        }
    }
}

/// 去掉命名空间前缀（d:resourcetype → resourcetype）
fn local_tag_name(tag: &str) -> &str {
    tag.rsplit(':').next().unwrap_or(tag)
}

/// 解析 PROPFIND XML 响应
fn parse_propfind_response(xml: &str, request_path: &str, base_url: &str) -> Result<Vec<RemoteFile>, String> {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml);

    let mut files = Vec::new();
    let mut in_response = false;
    let mut href = String::new();
    let mut display_name = String::new();
    let mut last_modified_str = String::new();
    let mut content_length_str = String::new();
    let mut is_collection = false;
    let mut current_tag = String::new();
    let mut in_href = false;
    let mut in_displayname = false;
    let mut in_getlastmodified = false;
    let mut in_getcontentlength = false;
    let mut in_resourcetype = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                let local = local_tag_name(&tag);
                match local {
                    "response" => {
                        in_response = true;
                        href.clear();
                        display_name.clear();
                        last_modified_str.clear();
                        content_length_str.clear();
                        is_collection = false;
                    }
                    "href" => in_href = true,
                    "displayname" => in_displayname = true,
                    "getlastmodified" => in_getlastmodified = true,
                    "getcontentlength" => in_getcontentlength = true,
                    "resourcetype" => in_resourcetype = true,
                    "collection" => {
                        if in_resourcetype {
                            is_collection = true;
                        }
                    }
                    _ => {}
                }
                current_tag = tag;
            }
            Ok(Event::Text(e)) => {
                let text = e.unescape().unwrap_or_default().to_string();
                if in_href {
                    href = text;
                    in_href = false;
                } else if in_displayname {
                    display_name = text;
                    in_displayname = false;
                } else if in_getlastmodified {
                    last_modified_str = text;
                    in_getlastmodified = false;
                } else if in_getcontentlength {
                    content_length_str = text;
                    in_getcontentlength = false;
                }
            }
            Ok(Event::End(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                let local = local_tag_name(&tag);
                if local == "resourcetype" {
                    in_resourcetype = false;
                }
                if local == "response" {
                    if in_response && !href.is_empty() {
                        // 解析 last_modified (RFC 2822 格式)
                        let last_modified = if !last_modified_str.is_empty() {
                            DateTime::parse_from_rfc2822(&last_modified_str)
                                .ok()
                                .map(|dt| dt.with_timezone(&Utc))
                        } else {
                            None
                        };

                        // 解析 content_length
                        let content_length = content_length_str.parse::<u64>().ok();

                        // 从 href 提取显示名（如果 displayname 为空）
                        if display_name.is_empty() {
                            display_name = href
                                .trim_end_matches('/')
                                .rsplit('/')
                                .next()
                                .unwrap_or(&href)
                                .to_string();
                        }

                        // 跳过目录本身（请求路径的根条目）
                        // href 可能带 base_url 前缀（如 "/dav/lantern/journals"），需先去掉
                        let stripped_href = if let Some(scheme_end) = base_url.find("://") {
                            let after_scheme = &base_url[scheme_end + 3..];
                            if let Some(path_start) = after_scheme.find('/') {
                                let base_path = &after_scheme[path_start..];
                                href.strip_prefix(base_path).unwrap_or(&href)
                            } else {
                                href.as_str()
                            }
                        } else {
                            href.as_str()
                        };
                        let normalized_href = stripped_href.trim_end_matches('/');
                        // request_path 也要去掉 base_url 的路径前缀，保持与 stripped_href 一致
                        let stripped_request = if let Some(scheme_end) = base_url.find("://") {
                            let after_scheme = &base_url[scheme_end + 3..];
                            if let Some(path_start) = after_scheme.find('/') {
                                let base_path = &after_scheme[path_start..];
                                request_path.strip_prefix(base_path).unwrap_or(request_path)
                            } else {
                                request_path
                            }
                        } else {
                            request_path
                        };
                        let normalized_request = stripped_request.trim_end_matches('/');
                        if normalized_href == normalized_request
                            || normalized_href.is_empty()
                            || display_name.is_empty()
                        {
                            in_response = false;
                            continue;
                        }

                        files.push(RemoteFile {
                            href: href.clone(),
                            display_name: display_name.clone(),
                            last_modified,
                            content_length,
                            is_collection,
                        });
                    }
                    in_response = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("XML 解析错误: {}", e)),
            _ => {}
        }
    }

    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_propfind_response() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/lantern/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>Fri, 30 May 2026 10:00:00 GMT</D:getlastmodified>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/lantern/lantern.db</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype/>
        <D:getlastmodified>Fri, 30 May 2026 09:00:00 GMT</D:getlastmodified>
        <D:getcontentlength>102400</D:getcontentlength>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>"#;

        let files = parse_propfind_response(xml, "/dav/lantern/", "https://dav.jianguoyun.com/dav").unwrap();
        assert_eq!(files.len(), 1); // root dir is filtered out
        assert_eq!(files[0].display_name, "lantern.db");
        assert!(!files[0].is_collection);
        assert_eq!(files[0].content_length, Some(102400));
    }
}
