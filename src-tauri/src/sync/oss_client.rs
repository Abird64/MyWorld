use async_trait::async_trait;
use chrono::{DateTime, Utc};

use super::remote_storage::{RemoteFile, RemoteStorage};

// ===== 辅助函数 =====

fn sha256(data: &[u8]) -> Vec<u8> {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    use hmac::{Hmac, Mac};
    type HmacSha256 = Hmac<sha2::Sha256>;
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key length should be valid");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn hex_encode(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

/// 阿里云 OSS 客户端（OSS 原生 V4 签名）
/// 签名算法：OSS4-HMAC-SHA256
/// Endpoint: https://{bucket}.oss-{region}.aliyuncs.com
pub struct OssClient {
    client: reqwest::Client,
    endpoint: String, // https://{bucket}.oss-{region}.aliyuncs.com
    bucket: String,
    region: String, // 如 cn-shanghai（不带 oss- 前缀）
    access_key_id: String,
    access_key_secret: String,
}

impl OssClient {
    pub fn new(
        bucket: &str,
        region: &str,
        access_key_id: &str,
        access_key_secret: &str,
    ) -> Result<Self, String> {
        // 兼容 oss-cn-shanghai 和 cn-shanghai 两种写法
        let region_id = region.strip_prefix("oss-").unwrap_or(region);
        let endpoint = format!("https://{}.oss-{}.aliyuncs.com", bucket, region_id);
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

        Ok(Self {
            client,
            endpoint,
            bucket: bucket.to_string(),
            region: region_id.to_string(),
            access_key_id: access_key_id.to_string(),
            access_key_secret: access_key_secret.to_string(),
        })
    }

    fn url_for(&self, key: &str) -> String {
        let key = key.trim_start_matches('/');
        format!("{}/{}", self.endpoint, key)
    }

    fn bucket_url(&self) -> String {
        self.endpoint.clone()
    }

    /// 对字符串做 URI 编码（保留 / 和未保留字符）
    fn uri_encode(s: &str) -> String {
        let mut result = String::new();
        for c in s.chars() {
            match c {
                'A'..='Z' | 'a'..='z' | '0'..='9' | '_' | '-' | '~' | '.' | '/' => {
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

    /// 对 URL 查询参数的 name/value 做 URI 编码
    fn uri_encode_param(s: &str) -> String {
        let mut result = String::new();
        for c in s.chars() {
            match c {
                'A'..='Z' | 'a'..='z' | '0'..='9' | '_' | '-' | '~' | '.' => {
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

    /// OSS V4 签名（OSS4-HMAC-SHA256）
    fn sign_request(
        &self,
        method: &str,
        url: &str,
        query: &str,
        extra_headers: &[(&str, &str)],
        timestamp: &DateTime<Utc>,
    ) -> Vec<(String, String)> {
        let datestamp = timestamp.format("%Y%m%d").to_string();
        let amz_date = timestamp.format("%Y%m%dT%H%M%SZ").to_string();

        // Step 1: Canonical Request
        let parsed = reqwest::Url::parse(url)
            .expect("sign_request received an invalid URL — this is a programming bug");

        // 1a: Canonical URI (OSS V4 要求包含 bucket 名，虚拟托管式 URL 的 path 不含 bucket，需手动拼接)
        let path = parsed.path();
        let canonical_uri = if path == "/" || path.is_empty() {
            Self::uri_encode(&format!("/{}/", self.bucket))
        } else {
            Self::uri_encode(&format!("/{}{}", self.bucket, path))
        };

        // 1b: Canonical Query String
        let canonical_querystring = if query.is_empty() {
            String::new()
        } else {
            let mut params: Vec<(&str, &str)> = Vec::new();
            for pair in query.split('&') {
                let mut parts = pair.splitn(2, '=');
                let name = parts.next().unwrap_or("");
                let value = parts.next().unwrap_or("");
                params.push((name, value));
            }
            params.sort_by(|a, b| {
                Self::uri_encode_param(a.0).cmp(&Self::uri_encode_param(b.0))
            });
            let encoded: Vec<String> = params
                .iter()
                .map(|(n, v)| {
                    format!(
                        "{}={}",
                        Self::uri_encode_param(n),
                        Self::uri_encode_param(v)
                    )
                })
                .collect();
            encoded.join("&")
        };

        // 1c: Canonical Headers
        // 三类参与签名的头：
        //   - 必须: x-oss-content-sha256
        //   - 存在则签: Content-Type, Content-MD5, x-oss-*（含 x-oss-date）
        //   - 可选（AdditionalHeaders 指定）
        // AdditionalHeaders 只包含第三类，不含前两类
        let mut canonical_headers = Vec::new();
        let mut additional_header_names: Vec<String> = Vec::new();

        // 必须头
        canonical_headers.push("x-oss-content-sha256:UNSIGNED-PAYLOAD".to_string());

        // 存在则签（x-oss-* 系列）
        canonical_headers.push(format!("x-oss-date:{}", amz_date));

        // 额外头：区分自动签名 vs 可选签名
        for (k, v) in extra_headers {
            let lower = k.to_lowercase();
            canonical_headers.push(format!("{}:{}", lower, v.trim()));
            // content-type / content-md5 / x-oss-* 是自动签名的，不放入 AdditionalHeaders
            if lower != "content-type" && lower != "content-md5" && !lower.starts_with("x-oss-") {
                additional_header_names.push(lower);
            }
        }

        canonical_headers.sort();
        additional_header_names.sort();

        let additional_headers_str = additional_header_names.join(";");

        // 1d/e: Canonical Request = HTTPVerb + "\n" + URI + "\n" + Query + "\n" + Headers + "\n" + AdditionalHeaders + "\n" + Hash
        // OSS V4 要求每个 header 行末尾有 \n（包括最后一行）
        let canonical_headers_str = if canonical_headers.is_empty() {
            String::new()
        } else {
            canonical_headers.join("\n") + "\n"
        };
        let canonical_request = format!(
            "{}\n{}\n{}\n{}\n{}\n{}",
            method,
            canonical_uri,
            canonical_querystring,
            canonical_headers_str,
            additional_headers_str,
            "UNSIGNED-PAYLOAD"
        );
        let canonical_hash = hex_encode(&sha256(canonical_request.as_bytes()));

        // Step 2: String to Sign
        let scope = format!(
            "{}/{}/oss/aliyun_v4_request",
            datestamp, self.region
        );
        let string_to_sign = format!(
            "OSS4-HMAC-SHA256\n{}\n{}\n{}",
            amz_date,
            scope,
            canonical_hash
        );

        // Step 3: Signing Key + Signature
        let signing_key = self.get_signing_key(&datestamp);
        let signature = hex_encode(&hmac_sha256(&signing_key, string_to_sign.as_bytes()));

        log::debug!(
            "[OSS] sign: region={} bucket={} date={} scope={}",
            self.region, self.bucket, datestamp, scope
        );
        log::debug!(
            "[OSS] canonical_request_bytes: {:02X?}",
            canonical_request.as_bytes()
        );
        log::debug!(
            "[OSS] string_to_sign:\n{}",
            string_to_sign
        );
        log::debug!(
            "[OSS] signing_key={} signature={}",
            hex_encode(&signing_key), signature
        );

        // Authorization header
        let authorization = if additional_headers_str.is_empty() {
            format!(
                "OSS4-HMAC-SHA256 Credential={}/{}, Signature={}",
                self.access_key_id, scope, signature
            )
        } else {
            format!(
                "OSS4-HMAC-SHA256 Credential={}/{}, AdditionalHeaders={}, Signature={}",
                self.access_key_id, scope, additional_headers_str, signature
            )
        };

        vec![
            ("Authorization".to_string(), authorization),
            ("x-oss-date".to_string(), amz_date),
            (
                "x-oss-content-sha256".to_string(),
                "UNSIGNED-PAYLOAD".to_string(),
            ),
        ]
    }

    /// OSS V4 Signing Key 派生
    fn get_signing_key(&self, datestamp: &str) -> Vec<u8> {
        // DateKey = HMAC-SHA256("aliyun_v4" + SecretKey, Date)
        let date_key = hmac_sha256(
            format!("aliyun_v4{}", self.access_key_secret).as_bytes(),
            datestamp.as_bytes(),
        );
        // DateRegionKey = HMAC-SHA256(DateKey, Region)
        let date_region_key = hmac_sha256(&date_key, self.region.as_bytes());
        // DateRegionServiceKey = HMAC-SHA256(DateRegionKey, "oss")
        let date_region_service_key = hmac_sha256(&date_region_key, b"oss");
        // SigningKey = HMAC-SHA256(DateRegionServiceKey, "aliyun_v4_request")
        hmac_sha256(&date_region_service_key, b"aliyun_v4_request")
    }

    async fn send_signed(
        &self,
        method: reqwest::Method,
        url: &str,
        query: &str,
        extra_headers: &[(&str, &str)],
        body: Option<Vec<u8>>,
    ) -> Result<reqwest::Response, String> {
        let timestamp = Utc::now();
        let sig_headers =
            self.sign_request(method.as_str(), url, query, extra_headers, &timestamp);

        // 查询参数需拼到 URL，否则签名包含 query 但请求不包含，签名校验失败
        let full_url = if query.is_empty() {
            url.to_string()
        } else {
            format!("{}?{}", url, query)
        };
        let mut req = self.client.request(method.clone(), &full_url);
        for (k, v) in &sig_headers {
            req = req.header(k.as_str(), v.as_str());
        }
        for (k, v) in extra_headers {
            req = req.header(*k, *v);
        }
        if let Some(data) = body {
            req = req.body(data);
        }

        log::debug!(
            "[OSS] {} {} | region={} bucket={} access_key_id_prefix={}",
            method, full_url, self.region, self.bucket,
            &self.access_key_id.chars().take(6).collect::<String>()
        );

        req.send().await.map_err(|e| format!("请求失败: {}", e))
    }

    /// 规范化路径前缀（用于 list-type=2）
    fn normalize_prefix(path: &str) -> String {
        let p = path.trim_matches('/');
        if p.is_empty() {
            return String::new();
        }
        format!("{}/", p)
    }
}

/// 解析 ListObjectsV2 XML 响应（S3/OSS 通用）
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

// ===== RemoteStorage trait =====

#[async_trait]
impl RemoteStorage for OssClient {
    async fn test_connection(&self) -> Result<String, String> {
        let url = self.bucket_url();
        let query = "list-type=2&max-keys=1";
        let resp = self
            .send_signed(reqwest::Method::GET, &url, query, &[], None)
            .await?;

        let status = resp.status().as_u16();
        if status == 401 || status == 403 {
            return Err("认证失败，请检查 AccessKey ID 和 AccessKey Secret".to_string());
        }
        if status == 404 {
            return Err(format!("Bucket '{}' 不存在", self.bucket));
        }
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!(
                "连接失败 ({}): {}",
                status,
                body.chars().take(200).collect::<String>()
            ));
        }

        Ok(format!(
            "连接成功 (bucket: {}, region: {})",
            self.bucket, self.region
        ))
    }

    async fn list_remote(&self, path: &str) -> Result<Vec<RemoteFile>, String> {
        let prefix = Self::normalize_prefix(path);
        let query = format!("list-type=2&prefix={}&delimiter=/", prefix);
        let url = self.bucket_url();

        let resp = self
            .send_signed(reqwest::Method::GET, &url, &query, &[], None)
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!(
                "LIST 返回 {}: {}",
                status,
                body.chars().take(200).collect::<String>()
            ));
        }

        let xml = resp.text().await.map_err(|e| e.to_string())?;
        parse_list_objects_response(&xml, &prefix)
    }

    async fn download(&self, remote_path: &str) -> Result<Vec<u8>, String> {
        let url = self.url_for(remote_path);

        let resp = self
            .send_signed(reqwest::Method::GET, &url, "", &[], None)
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            return Err(format!("GET 返回 {}", status));
        }

        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| format!("读取响应失败: {}", e))
    }

    async fn upload(&self, remote_path: &str, data: &[u8]) -> Result<(), String> {
        let url = self.url_for(remote_path);
        let extra_headers: Vec<(&str, &str)> = vec![("content-type", "application/octet-stream")];

        let resp = self
            .send_signed(reqwest::Method::PUT, &url, "", &extra_headers, Some(data.to_vec()))
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            log::error!("[OSS] PUT {} 失败 ({}): {}", remote_path, status, body);
            return Err(format!(
                "PUT 返回 {}: {}",
                status,
                body.chars().take(600).collect::<String>()
            ));
        }

        Ok(())
    }

    async fn ensure_dir(&self, _path: &str) -> Result<(), String> {
        Ok(())
    }

    fn relative_path_from_href(&self, href: &str) -> String {
        href.trim_start_matches('/').to_string()
    }
}
