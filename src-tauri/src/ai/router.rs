use serde::{Deserialize, Serialize};

use serde_json::Value;

use super::client::{self, AiConfig, text_message};

/// 第一阶段意图分析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentAnalysis {
    /// 搜索关键词（用于小本本、任务、联系人）
    pub keywords: Vec<String>,
    /// 日记搜索词（可能与 keywords 不同，更偏向自然语言）
    pub journal_queries: Vec<String>,
    /// 意图分类
    pub intent: IntentType,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntentType {
    Task,
    Schedule,
    Journal,
    Chat,
    Memory,
    Mixed,
}

const ANALYSIS_PROMPT: &str = r#"分析用户消息，提取搜索关键词和意图。

## 任务
1. 提取 1-3 个关键词，用于搜索小本本记忆、任务、联系人。关键词要简洁精准。
2. 提取 0-2 个日记搜索词，用于搜索日记内容。可以是更自然的短语。
3. 判断用户意图。

## 意图类型
- task：创建/查询/管理任务
- schedule：创建/查询/管理日程
- journal：写日记/回忆/反思
- chat：闲聊、问候、情感倾诉
- memory：查询或管理小本本记忆
- mixed：多种意图混合，或不确定

## 输出格式
只返回 JSON，不要任何解释：
{"keywords":["词1","词2"],"journal_queries":["搜索词"],"intent":"chat"}

## 示例
- "帮我建个任务明天买雪糕" → {"keywords":["买雪糕","任务"],"journal_queries":[],"intent":"task"}
- "我之前吃雪糕拉肚子了，帮我记一下" → {"keywords":["雪糕","拉肚子"],"journal_queries":["雪糕 拉肚子"],"intent":"memory"}
- "今天过得怎么样" → {"keywords":[],"journal_queries":[],"intent":"chat"}
- "上周写的日记里提到小明了" → {"keywords":["小明"],"journal_queries":["小明"],"intent":"journal"}"#;

/// 第一阶段：分析用户意图
///
/// 调用同一个 API，用轻量 prompt 提取关键词和意图。
/// 超时或失败时返回 None，调用方应降级为现有逻辑。
pub async fn analyze_user_intent(config: &AiConfig, user_message: &str) -> Option<IntentAnalysis> {
    let messages = vec![
        text_message("system", ANALYSIS_PROMPT),
        text_message("user", user_message),
    ];

    // 用 tokio::time::timeout 限制 5 秒
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        client::chat_completion(config, messages, None, None),
    )
    .await;

    match result {
        Ok(Ok(reply)) => {
            let text = reply.content
                .map(|v| match v { Value::String(s) => s, other => other.to_string() })
                .unwrap_or_default();
            parse_intent_response(&text)
        }
        _ => None, // 超时或错误 → 降级
    }
}

/// 解析 AI 返回的 JSON 意图分析
fn parse_intent_response(text: &str) -> Option<IntentAnalysis> {
    // 尝试直接解析
    let trimmed = text.trim();
    if let Ok(analysis) = serde_json::from_str::<IntentAnalysis>(trimmed) {
        return Some(analysis);
    }

    // 尝试提取 ```json ... ``` 代码块
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            let json_str = &trimmed[start..=end];
            if let Ok(analysis) = serde_json::from_str::<IntentAnalysis>(json_str) {
                return Some(analysis);
            }
        }
    }

    None
}
