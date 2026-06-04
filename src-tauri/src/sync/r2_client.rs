use async_trait::async_trait;
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use reqwest::Client;
use sha2::{Digest, Sha256};

use super::remote_storage::{RemoteFile, RemoteStorage};

type HmacSha256 = Hmac<Sha256>;

/// Cloudflare R2 客户端（S3 兼容 API + AWS Sig V4 签名）
pub struct R2Client {
    client: Client,
    endpoint: String,   // https://{account_id}.r2.cloudflarestorage.com
    bucket: String,
    access_key: String,
    secret_key: String,
}

impl R2Client {
    pub fn new(
        account_id: &str,
        access_key: &str,
        secret_key: &str,
        bucket: &str,
    ) -> Result<Self, String> {
        let endpoint = format!("https://{}.r2.cloudflarestorage.com", account_id);
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

        Ok(Self {
            client,
            endpoint,
            bucket: bucket.to_string(),
            access_key: access_key.to_string(),
            secret_key: secret_key.to_string(),
        })
    }

    /// 构建完整 URL: /{bucket}/{key}
    fn url_for(&self, key: &str) -> String {
        let key = key.trim_start_matches('/');
        format!("{}/{}/{}", self.endpoint, self.bucket, key)
    }

    /// 构建 bucket URL: /{bucket}
    fn bucket_url(&self) -> String {
        format!("{}/{}", self.endpoint, self.bucket)
    }

    /// AWS Signature V4 签名
    fn sign_request(
        &self,
        method: &str,
        url: &str,
        query: &str,
        headers: &[(&str, &str)],
        body: &[u8],
        timestamp: &chrono::DateTime<Utc>,
    ) -> Vec<(String, String)> {
        let datestamp = timestamp.format("%Y%m%d").to_string();
        let amz_date = timestamp.format("%Y%m%dT%H%M%SZ").to_string();
        let payload_hash = hex_encode(&sha256(body));

        // 1. Canonical request
        let parsed = reqwest::Url::parse(url).unwrap();
        let canonical_uri = if parsed.path().is_empty() {
            "/"
        } else {
            parsed.path()
        };
        let canonical_querystring = if query.is_empty() {
            urlencoding(parsed.query().unwrap_or(""))
        } else {
            urlencoding(query)
        };

        let mut canonical_headers = Vec::new();
        let mut signed_header_names = Vec::new();

        // Add host header
        let host = parsed.host_str().unwrap_or("");
        canonical_headers.push(format!("host:{}", host));
        signed_header_names.push("host");

        // Add x-amz-date
        canonical_headers.push(format!("x-amz-date:{}", amz_date));
        signed_header_names.push("x-amz-date");

        // Add x-amz-content-sha256
        canonical_headers.push(format!("x-amz-content-sha256:{}", payload_hash));
        signed_header_names.push("x-amz-content-sha256");

        // Add custom headers
        for (k, v) in headers {
            canonical_headers.push(format!("{}:{}", k.to_lowercase(), v));
            signed_header_names.push(k);
        }

        canonical_headers.sort();
        signed_header_names.sort();

        let signed_headers = signed_header_names.join(";");
        let canonical_request = format!(
            "{}\n{}\n{}\n{}\n{}\n{}",
            method,
            canonical_uri,
            canonical_querystring,
            canonical_headers.join("\n"),
            signed_headers,
            payload_hash
        );

        // 2. String to sign
        let credential_scope = format!("{}/auto/s3/aws4_request", datestamp);
        let string_to_sign = format!(
            "AWS4-HMAC-SHA256\n{}\n{}\n{}",
            amz_date,
            credential_scope,
            hex_encode(&sha256(canonical_request.as_bytes()))
        );

        // 3. Signing key
        let signing_key = self.get_signing_key(&datestamp);

        // 4. Signature
        let signature = hex_encode(&hmac_sha256(&signing_key, string_to_sign.as_bytes()));

        // 5. Authorization header
        let authorization = format!(
            "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
            self.access_key, credential_scope, signed_headers, signature
        );

        vec![
            ("Authorization".to_string(), authorization),
            ("x-amz-date".to_string(), amz_date),
            ("x-amz-content-sha256".to_string(), payload_hash),
        ]
    }

    fn get_signing_key(&self, datestamp: &str) -> Vec<u8> {
        let k_date = hmac_sha256(
            format!("AWS4{}", self.secret_key).as_bytes(),
            datestamp.as_bytes(),
        );
        let k_region = hmac_sha256(&k_date, b"auto");
        let k_service = hmac_sha256(&k_region, b"s3");
        hmac_sha256(&k_service, b"aws4_request")
    }

    /// 发送签名请求
    async fn send_signed(
        &self,
        method: reqwest::Method,
        url: &str,
        query: &str,
        extra_headers: &[(&str, &str)],
        body: &[u8],
    ) -> Result<reqwest::Response, String> {
        let timestamp = Utc::now();
        let sig_headers = self.sign_request(method.as_str(), url, query, extra_headers, body, &timestamp);

        let full_url = if query.is_empty() {
            url.to_string()
        } else {
            format!("{}?{}", url, query)
        };
        let mut req = self.client.request(method, &full_url);
        for (k, v) in &sig_headers {
            req = req.header(k.as_str(), v.as_str());
        }
        for (k, v) in extra_headers {
            req = req.header(*k, *v);
        }
        if !body.is_empty() {
            req = req.body(body.to_vec());
        }

        req.send().await.map_err(|e| format!("请求失败: {}", e))
    }
}

// === RemoteStorage trait 实现 ===

#[async_trait]
impl RemoteStorage for R2Client {
    async fn test_connection(&self) -> Result<String, String> {
        let url = self.bucket_url();
        let query = "list-type=2&max-keys=1";
        let resp = self.send_signed(reqwest::Method::GET, &url, query, &[], b"").await?;

        let status = resp.status().as_u16();
        if status == 401 || status == 403 {
            return Err("认证失败，请检查 Access Key 和 Secret Key".to_string());
        }
        if status == 404 {
            return Err(format!("Bucket '{}' 不存在", self.bucket));
        }
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("连接失败 ({}): {}", status, body.chars().take(200).collect::<String>()));
        }

        Ok(format!("连接成功 (bucket: {})", self.bucket))
    }

    async fn list_remote(&self, path: &str) -> Result<Vec<RemoteFile>, String> {
        let prefix = normalize_prefix(path);
        let query = format!("list-type=2&prefix={}&delimiter=/", prefix);
        let url = self.bucket_url();

        let resp = self.send_signed(reqwest::Method::GET, &url, &query, &[], b"").await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("LIST 返回 {}: {}", status, body.chars().take(200).collect::<String>()));
        }

        let xml = resp.text().await.map_err(|e| e.to_string())?;
        parse_list_objects_response(&xml, &prefix)
    }

    async fn download(&self, remote_path: &str) -> Result<Vec<u8>, String> {
        let key = normalize_key(remote_path);
        let url = self.url_for(&key);

        let resp = self.send_signed(reqwest::Method::GET, &url, "", &[], b"").await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            return Err(format!("GET 返回 {}", status));
        }

        resp.bytes().await.map(|b| b.to_vec()).map_err(|e| format!("读取响应失败: {}", e))
    }

    async fn upload(&self, remote_path: &str, data: &[u8]) -> Result<(), String> {
        let key = normalize_key(remote_path);
        let url = self.url_for(&key);

        let resp = self.send_signed(reqwest::Method::PUT, &url, "", &[], data).await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("PUT 返回 {}: {}", status, body.chars().take(200).collect::<String>()));
        }

        Ok(())
    }

    async fn ensure_dir(&self, _path: &str) -> Result<(), String> {
        // S3 不需要目录操作
        Ok(())
    }

    fn relative_path_from_href(&self, href: &str) -> String {
        // S3 中 href 就是 key，去掉 prefix 即可
        href.trim_start_matches('/').to_string()
    }
}

// === 辅助函数 ===

/// 规范化路径为 S3 key 前缀（确保以 / 结尾、不以 / 开头）
pub(crate) fn normalize_prefix(path: &str) -> String {
    let p = path.trim_matches('/');
    if p.is_empty() {
        return String::new();
    }
    format!("{}/", p)
}

/// 规范化路径为 S3 key（不以 / 开头）
pub(crate) fn normalize_key(path: &str) -> String {
    path.trim_start_matches('/').to_string()
}

/// SHA-256 哈希
pub(crate) fn sha256(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

/// HMAC-SHA256
pub(crate) fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key length should be valid");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

/// 十六进制编码
pub(crate) fn hex_encode(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

/// URL 编码（S3 查询字符串用，保留 = 和 &）
pub(crate) fn urlencoding(s: &str) -> String {
    let mut result = String::new();
    for c in s.chars() {
        match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '_' | '-' | '~' | '.' | '/' | '=' | '&' => {
                result.push(c);
            }
            _ => {
                let mut buf = [0u8; 4];
                let encoded = c.encode_utf8(&mut buf);
                for byte in encoded.bytes() {
                    result.push_str(&format!("%{:02X}", byte));
                }
            }
        }
    }
    result
}

/// 解析 ListObjectsV2 XML 响应
pub(crate) fn parse_list_objects_response(xml: &str, prefix: &str) -> Result<Vec<RemoteFile>, String> {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml);
    let mut files = Vec::new();

    // 解析 Contents（文件）
    let mut in_contents = false;
    let mut in_common_prefixes = false;
    let mut current_key = String::new();
    let mut current_last_modified = String::new();
    let mut current_size = String::new();
    let mut current_tag = String::new();
    let mut current_text = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                let local = tag.rsplit(':').next().unwrap_or(&tag).to_string();
                match local.as_str() {
                    "Contents" => {
                        in_contents = true;
                        current_key.clear();
                        current_last_modified.clear();
                        current_size.clear();
                    }
                    "CommonPrefixes" => {
                        in_common_prefixes = true;
                        current_key.clear();
                    }
                    "Key" | "LastModified" | "Size" | "Prefix" => {
                        current_tag = local;
                        current_text.clear();
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(e)) => {
                current_text = e.unescape().unwrap_or_default().to_string();
            }
            Ok(Event::End(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                let local = tag.rsplit(':').next().unwrap_or(&tag);
                match local {
                    "Key" => {
                        if current_tag == "Key" {
                            current_key = current_text.clone();
                        }
                    }
                    "LastModified" => {
                        if current_tag == "LastModified" {
                            current_last_modified = current_text.clone();
                        }
                    }
                    "Size" => {
                        if current_tag == "Size" {
                            current_size = current_text.clone();
                        }
                    }
                    "Prefix" => {
                        if current_tag == "Prefix" {
                            current_key = current_text.clone();
                        }
                    }
                    "Contents" => {
                        if in_contents && !current_key.is_empty() {
                            // 跳过目录占位符（以 / 结尾的 key）
                            if !current_key.ends_with('/') {
                                let display_name = current_key
                                    .rsplit('/')
                                    .next()
                                    .unwrap_or(&current_key)
                                    .to_string();

                                let last_modified = if !current_last_modified.is_empty() {
                                    DateTime::parse_from_rfc3339(&current_last_modified)
                                        .ok()
                                        .map(|dt| dt.with_timezone(&Utc))
                                } else {
                                    None
                                };

                                let content_length = current_size.parse::<u64>().ok();

                                // href 就是 key（用于 download）
                                files.push(RemoteFile {
                                    href: current_key.clone(),
                                    display_name,
                                    last_modified,
                                    content_length,
                                    is_collection: false,
                                });
                            }
                        }
                        in_contents = false;
                    }
                    "CommonPrefixes" => {
                        if in_common_prefixes && !current_key.is_empty() {
                            // 目录：去掉 prefix 和尾部 / 得到 display_name
                            let dir_key = current_key.trim_end_matches('/');
                            let display_name = dir_key
                                .trim_start_matches(prefix.trim_end_matches('/'))
                                .trim_start_matches('/')
                                .to_string();

                            if !display_name.is_empty() {
                                files.push(RemoteFile {
                                    href: current_key.clone(),
                                    display_name,
                                    last_modified: None,
                                    content_length: None,
                                    is_collection: true,
                                });
                            }
                        }
                        in_common_prefixes = false;
                    }
                    _ => {}
                }
                current_tag.clear();
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
    fn test_parse_list_objects() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <Name>my-bucket</Name>
    <Prefix>lantern/snapshots/</Prefix>
    <Delimiter>/</Delimiter>
    <IsTruncated>false</IsTruncated>
    <Contents>
        <Key>lantern/snapshots/snapshot_abc123.json</Key>
        <LastModified>2026-06-01T10:00:00Z</LastModified>
        <Size>1234</Size>
    </Contents>
    <Contents>
        <Key>lantern/snapshots/snapshot_def456.json</Key>
        <LastModified>2026-06-01T11:00:00Z</LastModified>
        <Size>5678</Size>
    </Contents>
    <CommonPrefixes>
        <Prefix>lantern/snapshots/subdir/</Prefix>
    </CommonPrefixes>
</ListBucketResult>"#;

        let files = parse_list_objects_response(xml, "lantern/snapshots/").unwrap();
        assert_eq!(files.len(), 3);

        assert_eq!(files[0].display_name, "snapshot_abc123.json");
        assert!(!files[0].is_collection);
        assert_eq!(files[0].content_length, Some(1234));

        assert_eq!(files[1].display_name, "snapshot_def456.json");
        assert!(!files[1].is_collection);

        assert_eq!(files[2].display_name, "subdir");
        assert!(files[2].is_collection);
    }
}
