use base64::Engine;
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::Serialize;

/// 远端文件信息
#[derive(Debug, Clone, Serialize)]
pub struct RemoteFile {
    pub href: String,
    pub display_name: String,
    pub last_modified: Option<DateTime<Utc>>,
    pub content_length: Option<u64>,
    pub is_collection: bool,
}

/// WebDAV 客户端
pub struct WebDavClient {
    client: Client,
    base_url: String,
    auth_header: String,
}

impl WebDavClient {
    pub fn new(url: &str, username: &str, password: &str) -> Self {
        let base_url = url.trim_end_matches('/').to_string();
        let credentials = format!("{}:{}", username, password);
        let encoded = base64::engine::general_purpose::STANDARD.encode(credentials.as_bytes());
        let auth_header = format!("Basic {}", encoded);

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url,
            auth_header,
        }
    }

    /// 构建完整 URL
    fn full_url(&self, path: &str) -> String {
        let path = path.trim_start_matches('/');
        format!("{}/{}", self.base_url, path)
    }

    /// 测试连接 — 尝试 PROPFIND 根目录
    pub async fn test_connection(&self) -> Result<String, String> {
        let url = self.full_url("");
        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:resourcetype/></D:prop>
</D:propfind>"#;

        let resp = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
            .header("Authorization", &self.auth_header)
            .header("Depth", "0")
            .header("Content-Type", "application/xml")
            .body(body)
            .send()
            .await
            .map_err(|e| format!("连接失败: {}", e))?;

        let status = resp.status();
        if status.is_success() || status.as_u16() == 207 {
            Ok("连接成功".to_string())
        } else if status.as_u16() == 401 || status.as_u16() == 403 {
            Err("认证失败，请检查用户名和应用密码".to_string())
        } else {
            Err(format!("服务器返回错误: {}", status))
        }
    }

    /// 列出目录下的文件（PROPFIND Depth:1）
    pub async fn list_remote(&self, path: &str) -> Result<Vec<RemoteFile>, String> {
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

        let resp = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
            .header("Authorization", &self.auth_header)
            .header("Depth", "1")
            .header("Content-Type", "application/xml")
            .body(body)
            .send()
            .await
            .map_err(|e| format!("PROPFIND 失败: {}", e))?;

        if !resp.status().is_success() && resp.status().as_u16() != 207 {
            return Err(format!("PROPFIND 返回 {}", resp.status()));
        }

        let text = resp.text().await.map_err(|e| e.to_string())?;
        parse_propfind_response(&text, path)
    }

    /// 下载文件
    pub async fn download(&self, remote_path: &str) -> Result<Vec<u8>, String> {
        let url = self.full_url(remote_path);
        let resp = self
            .client
            .get(&url)
            .header("Authorization", &self.auth_header)
            .send()
            .await
            .map_err(|e| format!("下载失败: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("下载返回 {}", resp.status()));
        }

        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| format!("读取响应失败: {}", e))
    }

    /// 上传文件
    pub async fn upload(&self, remote_path: &str, data: &[u8]) -> Result<(), String> {
        let url = self.full_url(remote_path);
        let resp = self
            .client
            .put(&url)
            .header("Authorization", &self.auth_header)
            .body(data.to_vec())
            .send()
            .await
            .map_err(|e| format!("上传失败: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("上传返回 {}", resp.status()));
        }
        Ok(())
    }

    /// 创建目录（MKCOL）
    pub async fn mkdir(&self, remote_path: &str) -> Result<(), String> {
        let url = self.full_url(remote_path);
        let resp = self
            .client
            .request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), &url)
            .header("Authorization", &self.auth_header)
            .send()
            .await
            .map_err(|e| format!("MKCOL 失败: {}", e))?;

        // 201 = created, 405 = already exists (both are OK)
        let status = resp.status();
        if status.is_success() || status.as_u16() == 405 {
            Ok(())
        } else {
            Err(format!("MKCOL 返回 {}", status))
        }
    }

    /// 递归创建目录（确保父目录存在）
    pub async fn ensure_dir(&self, path: &str) -> Result<(), String> {
        let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        let mut current = String::new();
        for part in parts {
            current.push('/');
            current.push_str(part);
            let _ = self.mkdir(&current).await; // 忽略已存在的情况
        }
        Ok(())
    }

    /// 检查文件是否存在（HEAD）
    pub async fn exists(&self, remote_path: &str) -> Result<bool, String> {
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

/// 解析 PROPFIND XML 响应
fn parse_propfind_response(xml: &str, request_path: &str) -> Result<Vec<RemoteFile>, String> {
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
            Ok(Event::Start(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "response" | "D:response" => {
                        in_response = true;
                        href.clear();
                        display_name.clear();
                        last_modified_str.clear();
                        content_length_str.clear();
                        is_collection = false;
                    }
                    "href" | "D:href" => in_href = true,
                    "displayname" | "D:displayname" => in_displayname = true,
                    "getlastmodified" | "D:getlastmodified" => in_getlastmodified = true,
                    "getcontentlength" | "D:getcontentlength" => in_getcontentlength = true,
                    "resourcetype" | "D:resourcetype" => in_resourcetype = true,
                    "collection" | "D:collection" => {
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
                if tag == "resourcetype" || tag == "D:resourcetype" {
                    in_resourcetype = false;
                }
                if tag == "response" || tag == "D:response" {
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
                        let normalized_href = href.trim_end_matches('/');
                        let normalized_request = request_path.trim_end_matches('/');
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

        let files = parse_propfind_response(xml, "/dav/lantern/").unwrap();
        assert_eq!(files.len(), 1); // root dir is filtered out
        assert_eq!(files[0].display_name, "lantern.db");
        assert!(!files[0].is_collection);
        assert_eq!(files[0].content_length, Some(102400));
    }
}
