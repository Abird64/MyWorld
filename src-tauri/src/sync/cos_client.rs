use async_trait::async_trait;
use chrono::Utc;

use super::remote_storage::{RemoteFile, RemoteStorage};
use super::r2_client::{
    hex_encode, hmac_sha256, normalize_key, normalize_prefix, parse_list_objects_response,
    sha256, urlencoding,
};

/// 腾讯云 COS 客户端（S3 兼容 API + AWS Sig V4 签名）
pub struct CosClient {
    client: reqwest::Client,
    endpoint: String, // https://{bucket}.cos.{region}.myqcloud.com
    bucket: String,
    region: String,
    secret_id: String,
    secret_key: String,
}

impl CosClient {
    pub fn new(
        bucket: &str,
        region: &str,
        secret_id: &str,
        secret_key: &str,
    ) -> Result<Self, String> {
        let endpoint = format!("https://{}.cos.{}.myqcloud.com", bucket, region);
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

        Ok(Self {
            client,
            endpoint,
            bucket: bucket.to_string(),
            region: region.to_string(),
            secret_id: secret_id.to_string(),
            secret_key: secret_key.to_string(),
        })
    }

    /// 构建完整 URL: https://{bucket}.cos.{region}.myqcloud.com/{key}
    fn url_for(&self, key: &str) -> String {
        let key = key.trim_start_matches('/');
        format!("{}/{}", self.endpoint, key)
    }

    /// 构建 bucket URL
    fn bucket_url(&self) -> String {
        self.endpoint.clone()
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

        let host = parsed.host_str().unwrap_or("");
        canonical_headers.push(format!("host:{}", host));
        signed_header_names.push("host");

        canonical_headers.push(format!("x-amz-date:{}", amz_date));
        signed_header_names.push("x-amz-date");

        canonical_headers.push(format!("x-amz-content-sha256:{}", payload_hash));
        signed_header_names.push("x-amz-content-sha256");

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

        let credential_scope = format!(
            "{}/{}/s3/aws4_request",
            datestamp, self.region
        );
        let string_to_sign = format!(
            "AWS4-HMAC-SHA256\n{}\n{}\n{}",
            amz_date,
            credential_scope,
            hex_encode(&sha256(canonical_request.as_bytes()))
        );

        let signing_key = self.get_signing_key(&datestamp);

        let signature = hex_encode(&hmac_sha256(&signing_key, string_to_sign.as_bytes()));

        let authorization = format!(
            "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
            self.secret_id, credential_scope, signed_headers, signature
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
        let k_region = hmac_sha256(&k_date, self.region.as_bytes());
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
        let sig_headers =
            self.sign_request(method.as_str(), url, query, extra_headers, body, &timestamp);

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
impl RemoteStorage for CosClient {
    async fn test_connection(&self) -> Result<String, String> {
        let url = self.bucket_url();
        let query = "list-type=2&max-keys=1";
        let resp = self
            .send_signed(reqwest::Method::GET, &url, query, &[], b"")
            .await?;

        let status = resp.status().as_u16();
        if status == 401 || status == 403 {
            return Err("认证失败，请检查 SecretId 和 SecretKey".to_string());
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
        let prefix = normalize_prefix(path);
        let query = format!("list-type=2&prefix={}&delimiter=/", prefix);
        let url = self.bucket_url();

        let resp = self
            .send_signed(reqwest::Method::GET, &url, &query, &[], b"")
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
        let key = normalize_key(remote_path);
        let url = self.url_for(&key);

        let resp = self
            .send_signed(reqwest::Method::GET, &url, "", &[], b"")
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
        let key = normalize_key(remote_path);
        let url = self.url_for(&key);

        let resp = self
            .send_signed(reqwest::Method::PUT, &url, "", &[], data)
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!(
                "PUT 返回 {}: {}",
                status,
                body.chars().take(200).collect::<String>()
            ));
        }

        Ok(())
    }

    async fn ensure_dir(&self, _path: &str) -> Result<(), String> {
        // S3 不需要目录操作
        Ok(())
    }

    fn relative_path_from_href(&self, href: &str) -> String {
        href.trim_start_matches('/').to_string()
    }
}
