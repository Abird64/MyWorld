use std::path::{Path, PathBuf};
use std::sync::Arc;

use http_body_util::BodyExt;
use hyper::body::Incoming;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use serde::Serialize;
use tokio::net::TcpListener;
use tokio::sync::{oneshot, Mutex};

use super::remote_storage::RemoteFile;

/// LAN 服务器状态，管理启动/停止
pub struct LanServerState {
    running: Mutex<bool>,
    port: Mutex<u16>,
    shutdown_tx: Mutex<Option<oneshot::Sender<()>>>,
}

impl LanServerState {
    pub fn new() -> Self {
        Self {
            running: Mutex::new(false),
            port: Mutex::new(9821),
            shutdown_tx: Mutex::new(None),
        }
    }

    pub async fn is_running(&self) -> bool {
        *self.running.lock().await
    }

    pub async fn get_port(&self) -> u16 {
        *self.port.lock().await
    }

    pub async fn stop(&self) {
        let tx = self.shutdown_tx.lock().await.take();
        if let Some(tx) = tx {
            let _ = tx.send(());
        }
        *self.running.lock().await = false;
    }
}

/// 启动 LAN 同步服务器
pub async fn start_lan_server(
    state: Arc<LanServerState>,
    sync_dir: PathBuf,
    device_name: String,
    site_id: String,
    preferred_port: u16,
) -> Result<u16, String> {
    // 已经在运行就先停掉
    state.stop().await;

    // 尝试绑定端口（9821-9830）
    let mut listener = None;
    let mut actual_port = preferred_port;
    for port in preferred_port..preferred_port + 10 {
        match TcpListener::bind(format!("0.0.0.0:{}", port)).await {
            Ok(l) => {
                listener = Some(l);
                actual_port = port;
                break;
            }
            Err(_) => continue,
        }
    }
    let listener = listener.ok_or_else(|| "无法绑定端口 (9821-9830 均被占用)".to_string())?;

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    *state.running.lock().await = true;
    *state.port.lock().await = actual_port;
    *state.shutdown_tx.lock().await = Some(shutdown_tx);

    let sync_dir = Arc::new(sync_dir);
    let device_name = Arc::new(device_name);
    let site_id = Arc::new(site_id);

    // 在后台运行服务器
    tokio::spawn(async move {
        let sync_dir = sync_dir;
        let device_name = device_name;
        let site_id = site_id;
        let mut shutdown_rx = shutdown_rx;

        loop {
            tokio::select! {
                result = listener.accept() => {
                    match result {
                        Ok((stream, _addr)) => {
                            let io = TokioIo::new(stream);
                            let sync_dir = sync_dir.clone();
                            let device_name = device_name.clone();
                            let site_id = site_id.clone();

                            tokio::spawn(async move {
                                let service = hyper::service::service_fn(move |req| {
                                    let sync_dir = sync_dir.clone();
                                    let device_name = device_name.clone();
                                    let site_id = site_id.clone();
                                    async move {
                                        handle_request(req, &sync_dir, &device_name, &site_id).await
                                    }
                                });

                                if let Err(_err) = hyper_util::server::conn::auto::Builder::new(
                                    hyper_util::rt::TokioExecutor::new(),
                                )
                                .serve_connection(io, service)
                                .await
                                {
                                    // 连接错误，静默忽略
                                }
                            });
                        }
                        Err(_e) => {
                            // accept 错误，短暂等待后继续
                            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                        }
                    }
                }
                _ = &mut shutdown_rx => {
                    break;
                }
            }
        }
    });

    Ok(actual_port)
}

async fn handle_request(
    req: Request<Incoming>,
    sync_dir: &Path,
    device_name: &str,
    site_id: &str,
) -> Result<Response<String>, hyper::Error> {
    // 校验安全头
    if req
        .headers()
        .get("X-Lantern-LAN")
        .and_then(|v| v.to_str().ok())
        != Some("1")
    {
        return Ok(make_response(StatusCode::FORBIDDEN, "Forbidden"));
    }

    let path = req.uri().path().to_string();
    let query = req.uri().query().unwrap_or("").to_string();
    let method = req.method().clone();

    let query_params = parse_query(&query);
    let file_path = query_params.get("path").cloned().unwrap_or_default();

    // 安全检查：防止路径穿越
    if file_path.contains("..") {
        return Ok(make_response(StatusCode::BAD_REQUEST, "Invalid path"));
    }

    match (method.as_str(), path.as_str()) {
        ("GET", "/api/health") => {
            let resp = HealthResponse {
                device_name: device_name.to_string(),
                site_id: site_id.to_string(),
            };
            Ok(make_json_response(StatusCode::OK, &resp))
        }

        ("GET", "/api/list") => {
            let dir = sync_dir.join(&file_path);
            if !dir.is_dir() {
                return Ok(make_response(StatusCode::NOT_FOUND, "Directory not found"));
            }

            match list_directory(&dir, &file_path) {
                Ok(entries) => Ok(make_json_response(StatusCode::OK, &entries)),
                Err(e) => Ok(make_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("List error: {}", e),
                )),
            }
        }

        ("GET", "/api/file") => {
            let fp = sync_dir.join(&file_path);
            if !fp.is_file() {
                return Ok(make_response(StatusCode::NOT_FOUND, "File not found"));
            }
            match tokio::fs::read(&fp).await {
                Ok(data) => Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "application/octet-stream")
                    .body(String::from_utf8_lossy(&data).to_string())
                    .unwrap()),
                Err(e) => Ok(make_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("Read error: {}", e),
                )),
            }
        }

        ("HEAD", "/api/file") => {
            let fp = sync_dir.join(&file_path);
            if fp.exists() {
                Ok(Response::builder()
                    .status(StatusCode::OK)
                    .body(String::new())
                    .unwrap())
            } else {
                Ok(make_response(StatusCode::NOT_FOUND, ""))
            }
        }

        ("PUT", "/api/file") => {
            let fp = sync_dir.join(&file_path);
            // 确保父目录存在
            if let Some(parent) = fp.parent() {
                let _ = tokio::fs::create_dir_all(parent).await;
            }

            // 读取请求体
            let body_bytes = req
                .into_body()
                .collect()
                .await
                .map(|c| c.to_bytes().to_vec())
                .unwrap_or_default();


            // 原子写入：先写临时文件再重命名
            let tmp_path = fp.with_extension("tmp");
            match tokio::fs::write(&tmp_path, &body_bytes).await {
                Ok(_) => match tokio::fs::rename(&tmp_path, &fp).await {
                    Ok(_) => Ok(make_response(StatusCode::OK, "OK")),
                    Err(e) => Ok(make_response(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        &format!("Rename error: {}", e),
                    )),
                },
                Err(e) => Ok(make_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("Write error: {}", e),
                )),
            }
        }

        ("PUT", "/api/mkdir") => {
            let dir = sync_dir.join(&file_path);
            match tokio::fs::create_dir_all(&dir).await {
                Ok(_) => Ok(make_response(StatusCode::OK, "OK")),
                Err(e) => Ok(make_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    &format!("Mkdir error: {}", e),
                )),
            }
        }

        _ => Ok(make_response(StatusCode::NOT_FOUND, "Not found")),
    }
}

fn list_directory(dir: &Path, prefix: &str) -> Result<Vec<RemoteFile>, String> {
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let is_dir = metadata.is_dir();

        let href = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", prefix.trim_end_matches('/'), name)
        };

        let href = if is_dir { format!("{}/", href) } else { href };

        result.push(RemoteFile {
            href,
            display_name: name,
            last_modified: metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .and_then(|d| {
                    chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                }),
            content_length: if is_dir { None } else { Some(metadata.len()) },
            is_collection: is_dir,
        });
    }

    Ok(result)
}

fn parse_query(query: &str) -> std::collections::HashMap<String, String> {
    query
        .split('&')
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let key = parts.next()?.to_string();
            let value = parts.next().unwrap_or("").to_string();
            // 简单 URL 解码
            let value = value.replace("%2F", "/").replace("%20", " ");
            Some((key, value))
        })
        .collect()
}

fn make_response(status: StatusCode, body: &str) -> Response<String> {
    Response::builder()
        .status(status)
        .body(body.to_string())
        .unwrap()
}

fn make_json_response<T: Serialize>(status: StatusCode, data: &T) -> Response<String> {
    let body = serde_json::to_string(data).unwrap_or_default();
    Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .body(body)
        .unwrap()
}

#[derive(Serialize)]
struct HealthResponse {
    device_name: String,
    site_id: String,
}

/// 获取本机局域网 IP 地址
pub fn get_local_ip() -> String {
    // 尝试通过 UDP socket 获取本机 IP（不会实际发送数据）
    std::net::UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| {
            socket.connect("8.8.8.8:80")?;
            socket.local_addr()
        })
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string())
}
