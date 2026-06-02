use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::Serialize;

/// 远端文件/目录信息（WebDAV 和 R2 共用）
#[derive(Debug, Clone, Serialize)]
pub struct RemoteFile {
    pub href: String,
    pub display_name: String,
    pub last_modified: Option<DateTime<Utc>>,
    pub content_length: Option<u64>,
    pub is_collection: bool,
}

/// 远端存储抽象（WebDAV / R2 统一接口）
#[async_trait]
pub trait RemoteStorage: Send + Sync {
    /// 测试连接是否正常
    async fn test_connection(&self) -> Result<String, String>;
    /// 列出目录下的文件和子目录
    async fn list_remote(&self, path: &str) -> Result<Vec<RemoteFile>, String>;
    /// 下载文件
    async fn download(&self, remote_path: &str) -> Result<Vec<u8>, String>;
    /// 上传文件
    async fn upload(&self, remote_path: &str, data: &[u8]) -> Result<(), String>;
    /// 确保目录存在（S3 为空操作）
    async fn ensure_dir(&self, path: &str) -> Result<(), String>;
    /// 从 href 中提取相对路径
    fn relative_path_from_href(&self, href: &str) -> String;
}
