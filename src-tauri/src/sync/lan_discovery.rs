use mdns_sd::{ServiceDaemon, ServiceEvent};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

const SERVICE_TYPE: &str = "_lantern._tcp.local.";

#[derive(Debug, Clone, Serialize)]
pub struct DiscoveredPeer {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub site_id: String,
    pub online: bool,
}

/// mDNS 服务发现管理
pub struct LanDiscovery {
    mdns: ServiceDaemon,
    #[allow(dead_code)]
    instance_name: Arc<Mutex<String>>,
    peers: Arc<Mutex<HashMap<String, DiscoveredPeer>>>,
}

impl LanDiscovery {
    pub fn new() -> Result<Self, String> {
        let mdns = ServiceDaemon::new().map_err(|e| format!("mDNS 初始化失败: {}", e))?;
        Ok(Self {
            mdns,
            instance_name: Arc::new(Mutex::new(String::new())),
            peers: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// 广播本设备
    pub async fn advertise(
        &self,
        device_name: &str,
        site_id: &str,
        port: u16,
    ) -> Result<(), String> {
        let instance = format!("{}-{}", device_name, site_id);
        *self.instance_name.lock().await = instance.clone();

        let full_name = format!("{}.{}", instance, SERVICE_TYPE);
        let hostname = format!("{}.local.", device_name.replace(' ', "-"));

        let properties = vec![
            ("site_id", site_id).into(),
            ("device", device_name).into(),
        ];

        let service = mdns_sd::ServiceInfo::new(
            SERVICE_TYPE,
            &instance,
            &hostname,
            "",
            port,
            properties,
        )
        .map_err(|e| format!("创建服务信息失败: {}", e))?;

        self.mdns
            .register(service)
            .map_err(|e| format!("注册 mDNS 服务失败: {}", e))?;

        log::info!("mDNS 广播已启动: {}", full_name);
        Ok(())
    }

    /// 停止广播
    pub async fn unregister(&self) {
        let instance = self.instance_name.lock().await;
        if !instance.is_empty() {
            let full_name = format!("{}.{}", instance, SERVICE_TYPE);
            if let Err(e) = self.mdns.unregister(&full_name) {
                log::warn!("取消 mDNS 注册失败: {}", e);
            }
        }
    }

    /// 开始浏览发现其他设备
    pub async fn start_browse(&self) -> Result<(), String> {
        let receiver = self
            .mdns
            .browse(SERVICE_TYPE)
            .map_err(|e| format!("启动 mDNS 浏览失败: {}", e))?;

        let peers = self.peers.clone();
        let instance_name = self.instance_name.clone();

        tokio::spawn(async move {
            while let Ok(event) = receiver.recv_async().await {
                match event {
                    ServiceEvent::ServiceResolved(info) => {
                        let host = info
                            .get_addresses()
                            .iter()
                            .next()
                            .map(|a| a.to_string())
                            .unwrap_or_default();
                        let port = info.get_port();
                        let props = info.get_properties();
                        let site_id = props
                            .get("site_id")
                            .map(|p| p.val_str().to_string())
                            .unwrap_or_default();
                        let device = props
                            .get("device")
                            .map(|p| p.val_str().to_string())
                            .unwrap_or_default();
                        let name = info.get_fullname().to_string();

                        let my_name = instance_name.lock().await.clone();
                        if name.starts_with(&my_name) {
                            continue; // 跳过自己
                        }

                        let peer = DiscoveredPeer {
                            name: device,
                            host,
                            port,
                            site_id,
                            online: true,
                        };

                        log::info!("发现 LAN 设备: {} ({}:{})", peer.name, peer.host, peer.port);
                        peers.lock().await.insert(name, peer);
                    }
                    ServiceEvent::ServiceRemoved(name, _ty) => {
                        if let Some(peer) = peers.lock().await.get_mut(&name) {
                            peer.online = false;
                            log::info!("LAN 设备离线: {}", name);
                        }
                    }
                    _ => {}
                }
            }
        });

        Ok(())
    }

    /// 获取已发现的设备列表
    pub async fn get_peers(&self) -> Vec<DiscoveredPeer> {
        self.peers.lock().await.values().cloned().collect()
    }

    /// 手动连接设备（通过 IP:port 直接请求 /api/health）
    pub async fn connect_manual(
        &self,
        host: &str,
        port: u16,
    ) -> Result<DiscoveredPeer, String> {
        let url = format!("http://{}:{}/api/health", host, port);
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

        let resp = client
            .get(&url)
            .header("X-Lantern-LAN", "1")
            .send()
            .await
            .map_err(|e| format!("无法连接 {}:{} — {}", host, port, e))?;

        if !resp.status().is_success() {
            return Err(format!("对端返回错误: {}", resp.status()));
        }

        #[derive(serde::Deserialize)]
        struct HealthResp {
            device_name: String,
            site_id: String,
        }

        let body: HealthResp = resp
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        let peer = DiscoveredPeer {
            name: body.device_name,
            host: host.to_string(),
            port,
            site_id: body.site_id,
            online: true,
        };

        // 加入 peers 列表
        let key = format!("manual-{}:{}", host, port);
        self.peers.lock().await.insert(key, peer.clone());

        Ok(peer)
    }

    /// 测试连接指定设备
    pub async fn test_peer(&self, host: &str, port: u16) -> Result<String, String> {
        let url = format!("http://{}:{}/api/health", host, port);
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

        let resp = client
            .get(&url)
            .header("X-Lantern-LAN", "1")
            .send()
            .await
            .map_err(|e| format!("连接失败: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("对端返回错误: {}", resp.status()));
        }

        #[derive(serde::Deserialize)]
        struct HealthResp {
            device_name: String,
        }

        let body: HealthResp = resp
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        Ok(format!("已连接: {}", body.device_name))
    }
}
