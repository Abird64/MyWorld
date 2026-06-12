use serde::{Deserialize, Serialize};

const BASE_URL: &str = "https://aihot.virxact.com";
const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 aihot-skill/0.2.0";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AihotItem {
    pub id: Option<String>,
    pub title: String,
    #[serde(default)]
    pub title_en: Option<String>,
    pub url: String,
    pub source: String,
    #[serde(default)]
    pub published_at: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub score: Option<i32>,
    #[serde(default)]
    pub selected: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AihotItemsResponse {
    pub count: i32,
    #[serde(default)]
    pub has_next: bool,
    #[serde(default)]
    pub next_cursor: Option<String>,
    pub items: Vec<AihotItem>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AihotDailySection {
    pub label: String,
    pub items: Vec<AihotDailyItem>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AihotDailyItem {
    pub title: String,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub source_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AihotFlash {
    pub title: String,
    #[serde(default)]
    pub source_name: Option<String>,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub published_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AihotDailyResponse {
    pub date: String,
    #[serde(default)]
    pub lead: Option<AihotDailyLead>,
    pub sections: Vec<AihotDailySection>,
    #[serde(default)]
    pub flashes: Option<Vec<AihotFlash>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AihotDailyLead {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub lead_paragraph: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AihotDailyIndex {
    pub date: String,
    #[serde(default)]
    pub lead_title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AihotDailiesResponse {
    pub count: i32,
    pub items: Vec<AihotDailyIndex>,
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default()
}

/// 获取 AI HOT 精选/全部条目
#[tauri::command]
pub async fn fetch_aihot_items(
    mode: Option<String>,
    category: Option<String>,
    since: Option<String>,
    take: Option<i32>,
    q: Option<String>,
) -> Result<AihotItemsResponse, String> {
    let mode = mode.unwrap_or_else(|| "selected".to_string());
    let take = take.unwrap_or(50).min(100);

    let mut url = format!("{}/api/public/items?mode={}&take={}", BASE_URL, mode, take);
    if let Some(cat) = &category {
        url.push_str(&format!("&category={}", cat));
    }
    if let Some(s) = &since {
        url.push_str(&format!("&since={}", s));
    }
    if let Some(query) = &q {
        url.push_str(&format!("&q={}", query));
    }

    let resp = client()
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }

    resp.json::<AihotItemsResponse>()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))
}

/// 获取最新 AI HOT 日报
#[tauri::command]
pub async fn fetch_aihot_daily() -> Result<AihotDailyResponse, String> {
    let url = format!("{}/api/public/daily", BASE_URL);

    let resp = client()
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }

    resp.json::<AihotDailyResponse>()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))
}

/// 获取指定日期的 AI HOT 日报
#[tauri::command]
pub async fn fetch_aihot_daily_by_date(date: String) -> Result<AihotDailyResponse, String> {
    let url = format!("{}/api/public/daily/{}", BASE_URL, date);

    let resp = client()
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }

    resp.json::<AihotDailyResponse>()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))
}

/// 获取日报归档列表
#[tauri::command]
pub async fn fetch_aihot_dailies(take: Option<i32>) -> Result<AihotDailiesResponse, String> {
    let take = take.unwrap_or(30).min(180);
    let url = format!("{}/api/public/dailies?take={}", BASE_URL, take);

    let resp = client()
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }

    resp.json::<AihotDailiesResponse>()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))
}
