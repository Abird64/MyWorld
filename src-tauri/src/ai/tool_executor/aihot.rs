use serde::Deserialize;

const BASE_URL: &str = "https://aihot.virxact.com";
const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 aihot-skill/0.2.0";

#[derive(Deserialize)]
pub(crate) struct ToolArgs {
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub since: Option<String>,
    #[serde(default)]
    pub take: Option<i32>,
    #[serde(default)]
    pub query: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Item {
    title: String,
    url: String,
    source: String,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    category: Option<String>,
    #[serde(default)]
    score: Option<i32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ItemsResponse {
    items: Vec<Item>,
}

/// 格式化 AI 资讯条目为 markdown 简报
pub fn format_items(items: Vec<Item>) -> String {
    if items.is_empty() {
        return "暂无 AI 资讯。".to_string();
    }

    let mut result = String::new();
    let total = items.len();

    let mut groups: std::collections::BTreeMap<String, Vec<&Item>> = std::collections::BTreeMap::new();
    for item in &items {
        let cat = item.category.as_deref().unwrap_or("other");
        groups.entry(cat.to_string()).or_default().push(item);
    }

    let cat_labels = [
        ("ai-models", "模型发布/更新"),
        ("ai-products", "产品发布/更新"),
        ("industry", "行业动态"),
        ("paper", "论文研究"),
        ("tip", "技巧与观点"),
        ("other", "其他"),
    ];

    let mut idx = 1;
    for (cat_key, cat_label) in &cat_labels {
        if let Some(cat_items) = groups.get(*cat_key) {
            result.push_str(&format!("## {}\n\n", cat_label));
            for item in cat_items {
                result.push_str(&format!("{}. **{}** — {}\n", idx, item.title, item.source));
                if let Some(summary) = &item.summary {
                    let chars: Vec<char> = summary.chars().take(100).collect();
                    let s: String = chars.into_iter().collect();
                    if s.len() < summary.len() {
                        result.push_str(&format!("   {}...\n", s));
                    } else {
                        result.push_str(&format!("   {}\n", s));
                    }
                }
                result.push_str(&format!("   {}\n\n", item.url));
                idx += 1;
            }
        }
    }

    result.push_str(&format!("共 {} 条，数据来自 aihot.virxact.com", total));
    result
}

/// 同步版本：在 spawn_blocking 中调用
pub fn execute_search_ai_news_sync(arguments: &str) -> Result<String, String> {
    let args: ToolArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("参数解析失败: {}", e))?;

    let mode = args.mode.unwrap_or_else(|| "selected".to_string());
    let take = args.take.unwrap_or(30).min(100);

    let mut url = format!("{}/api/public/items?mode={}&take={}", BASE_URL, mode, take);
    if let Some(cat) = &args.category {
        url.push_str(&format!("&category={}", cat));
    }
    if let Some(s) = &args.since {
        url.push_str(&format!("&since={}", s));
    }
    if let Some(q) = &args.query {
        url.push_str(&format!("&q={}", q));
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let resp = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }

    let data: ItemsResponse = resp
        .json()
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(format_items(data.items))
}
