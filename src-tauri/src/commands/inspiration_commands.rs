use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliVideoInfo {
    pub bvid: String,
    pub cid: i64,
    pub title: String,
    pub author: String,
    pub desc: String,
    pub duration: i64,
    pub view: i64,
    pub subtitles: Vec<SubtitleEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleEntry {
    pub lang: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleContent {
    pub full_text: String,
    pub segments: Vec<SubtitleSegment>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleSegment {
    pub text: String,
    pub from: f64,
    pub to: f64,
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default()
}

/// 从 URL 提取 BV 号
fn extract_bvid(url: &str) -> Option<String> {
    let re = regex::Regex::new(r"BV[a-zA-Z0-9]+").ok()?;
    re.find(url).map(|m| m.as_str().to_string())
}

/// 获取 B 站视频信息和字幕列表
///
/// `sessdata` 是 B 站登录 cookie，传入后可获取 AI 生成的字幕
#[tauri::command]
pub async fn fetch_bilibili_video_info(url: String, sessdata: Option<String>) -> Result<BilibiliVideoInfo, String> {
    let bvid = extract_bvid(&url)
        .ok_or("无法从 URL 中提取 BV 号")?;

    // 构建 cookie header
    let cookie = sessdata.as_deref().map(|s| format!("SESSDATA={}", s));

    // 获取视频基本信息
    let info_url = format!("https://api.bilibili.com/x/web-interface/view?bvid={}", bvid);
    let mut info_req = client()
        .get(&info_url)
        .header("User-Agent", USER_AGENT)
        .header("Referer", "https://www.bilibili.com");
    if let Some(ref c) = cookie {
        info_req = info_req.header("Cookie", c);
    }
    let info_resp = info_req.send().await
        .map_err(|e| format!("请求视频信息失败: {}", e))?;

    let info_data: serde_json::Value = info_resp.json().await
        .map_err(|e| format!("解析视频信息失败: {}", e))?;

    if info_data["code"].as_i64().unwrap_or(-1) != 0 {
        let msg = info_data["message"].as_str().unwrap_or("未知错误");
        return Err(format!("B站 API 错误: {}", msg));
    }

    let data = &info_data["data"];
    let cid = data["cid"].as_i64().unwrap_or(0);
    let title = data["title"].as_str().unwrap_or("").to_string();
    let author = data["owner"]["name"].as_str().unwrap_or("").to_string();
    let desc = data["desc"].as_str().unwrap_or("").to_string();
    let duration = data["duration"].as_i64().unwrap_or(0);
    let view = data["stat"]["view"].as_i64().unwrap_or(0);

    // 获取字幕信息（带 cookie 可获取 AI 字幕）
    let player_url = format!(
        "https://api.bilibili.com/x/player/v2?bvid={}&cid={}",
        bvid, cid
    );
    let mut player_req = client()
        .get(&player_url)
        .header("User-Agent", USER_AGENT)
        .header("Referer", "https://www.bilibili.com");
    if let Some(ref c) = cookie {
        player_req = player_req.header("Cookie", c);
    }
    let player_resp = player_req.send().await
        .map_err(|e| format!("请求字幕信息失败: {}", e))?;

    let player_data: serde_json::Value = player_resp.json().await
        .map_err(|e| format!("解析字幕信息失败: {}", e))?;

    let mut subtitles = Vec::new();
    if player_data["code"].as_i64().unwrap_or(-1) == 0 {
        if let Some(sub_list) = player_data["data"]["subtitle"]["subtitles"].as_array() {
            for sub in sub_list {
                let lang = sub["lan_doc"].as_str().unwrap_or("").to_string();
                let mut sub_url = sub["subtitle_url"].as_str().unwrap_or("").to_string();
                if sub_url.starts_with("//") {
                    sub_url = format!("https:{}", sub_url);
                }
                if !sub_url.is_empty() {
                    subtitles.push(SubtitleEntry { lang, url: sub_url });
                }
            }
        }
    }

    Ok(BilibiliVideoInfo {
        bvid,
        cid,
        title,
        author,
        desc,
        duration,
        view,
        subtitles,
    })
}

/// 打开 B 站登录窗口（WebView 方式，支持短信/密码/扫码）
#[tauri::command]
pub async fn bilibili_open_login_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;

    let window = WebviewWindowBuilder::new(
        &app_handle,
        "bilibili-login",
        tauri::WebviewUrl::External("https://www.bilibili.com".parse().unwrap()),
    )
    .title("B 站登录")
    .inner_size(480.0, 720.0)
    .center()
    .build()
    .map_err(|e| format!("创建登录窗口失败: {}", e))?;

    // 注入 JS 轮询 cookie，登录成功后通知主窗口
    let js_code = r#"
        (function pollCookie() {
            const interval = setInterval(() => {
                try {
                    const cookies = document.cookie;
                    const match = cookies.match(/SESSDATA=([^;]+)/);
                    if (match && match[1] && match[1] !== 'deleted') {
                        clearInterval(interval);
                        window.__TAURI__?.core?.invoke('bilibili_login_callback', { sessdata: match[1] });
                        setTimeout(() => window.close(), 500);
                    }
                } catch(e) {}
            }, 1000);
            // 5 分钟超时
            setTimeout(() => clearInterval(interval), 300000);
        })();
    "#;

    // 延迟注入脚本，等待页面加载
    let window_clone = window.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        let _ = window_clone.eval(js_code);
    });

    Ok(())
}

/// 登录回调：接收从 WebView 注入的 JS 发来的 SESSDATA
#[tauri::command]
pub async fn bilibili_login_callback(app_handle: tauri::AppHandle, sessdata: String) -> Result<(), String> {
    // 通知前端登录成功
    let _ = app_handle.emit("bilibili-login-success", &sessdata);
    // 关闭登录窗口
    if let Some(window) = app_handle.get_webview_window("bilibili-login") {
        let _ = window.close();
    }
    Ok(())
}

/// B 站扫码登录 — 获取二维码 URL
#[tauri::command]
pub async fn bilibili_qrcode_url() -> Result<serde_json::Value, String> {
    let resp = client()
        .get("https://passport.bilibili.com/x/passport-login/web/qrcode/generate")
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("请求二维码失败: {}", e))?;

    let data: serde_json::Value = resp.json().await
        .map_err(|e| format!("解析二维码响应失败: {}", e))?;

    if data["code"].as_i64().unwrap_or(-1) != 0 {
        let msg = data["message"].as_str().unwrap_or("未知错误");
        return Err(format!("B站 API 错误: {}", msg));
    }

    Ok(data["data"].clone())
}

/// B 站扫码登录 — 轮询登录状态
/// 返回 { status, url, refresh_token }
/// 登录成功时会从 Set-Cookie 中提取 SESSDATA
#[tauri::command]
pub async fn bilibili_poll_qrcode(qrcode_key: String) -> Result<serde_json::Value, String> {
    let resp = client()
        .get(format!("https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key={}", qrcode_key))
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("轮询登录状态失败: {}", e))?;

    // 从 Set-Cookie 中提取 SESSDATA
    let mut sessdata = String::new();
    log::info!("[bilibili_poll] 响应状态: {}", resp.status());

    // 打印所有响应头用于调试
    for (name, value) in resp.headers().iter() {
        if let Ok(v) = value.to_str() {
            log::info!("[bilibili_poll] Header: {} = {}", name, v);
        }
    }

    for header_value in resp.headers().get_all("set-cookie") {
        if let Ok(cookie_str) = header_value.to_str() {
            log::info!("[bilibili_poll] Set-Cookie: {}", cookie_str);
            let upper = cookie_str.to_uppercase();
            if upper.starts_with("SESSDATA=") || upper.contains(" SESSDATA=") {
                // 提取 SESSDATA 值
                for part in cookie_str.split(';') {
                    let part_trimmed = part.trim();
                    if part_trimmed.to_uppercase().starts_with("SESSDATA=") {
                        sessdata = part_trimmed
                            .splitn(2, '=')
                            .nth(1)
                            .unwrap_or("")
                            .to_string();
                        break;
                    }
                }
                if !sessdata.is_empty() {
                    log::info!("[bilibili_poll] 提取到 SESSDATA: {}...", &sessdata[..sessdata.len().min(20)]);
                    break;
                }
            }
        }
    }

    let resp_text = resp.text().await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    log::info!("[bilibili_poll] 响应体: {}", &resp_text[..resp_text.len().min(200)]);

    let mut data: serde_json::Value = serde_json::from_str(&resp_text)
        .map_err(|e| format!("解析轮询响应失败: {}", e))?;

    log::info!("[bilibili_poll] 响应 code: {}", data["code"]);

    // 把 SESSDATA 注入到返回数据中
    if !sessdata.is_empty() {
        data["sessdata"] = serde_json::Value::String(sessdata);
    }

    Ok(data)
}

/// 下载字幕内容
#[tauri::command]
pub async fn fetch_bilibili_subtitle(subtitle_url: String) -> Result<SubtitleContent, String> {
    let resp = client()
        .get(&subtitle_url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("下载字幕失败: {}", e))?;

    let data: serde_json::Value = resp.json().await
        .map_err(|e| format!("解析字幕失败: {}", e))?;

    let mut segments = Vec::new();
    if let Some(body) = data["body"].as_array() {
        for item in body {
            let text = item["content"].as_str().unwrap_or("").to_string();
            let from = item["from"].as_f64().unwrap_or(0.0);
            let to = item["to"].as_f64().unwrap_or(0.0);
            segments.push(SubtitleSegment { text, from, to });
        }
    }

    let full_text = segments.iter().map(|s| s.text.as_str()).collect::<Vec<_>>().join("");

    Ok(SubtitleContent { full_text, segments })
}

