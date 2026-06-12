use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::tools::ToolDefinition;

// ========== 请求/响应结构 ==========

#[derive(Debug, Serialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    /// 纯文本时为 String，带图片时为 ContentPart 数组（OpenAI multimodal 格式）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// DeepSeek thinking 模式返回的推理链，后续请求必须原样带回
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_content: Option<String>,
}

/// 构造纯文本 ChatMessage
pub fn text_message(role: &str, text: &str) -> ChatMessage {
    ChatMessage {
        role: role.to_string(),
        content: Some(Value::String(text.to_string())),
        tool_calls: None,
        tool_call_id: None,
        name: None,
        reasoning_content: None,
    }
}

/// 构造带图片的 ChatMessage（OpenAI multimodal 格式）
pub fn multimodal_message(role: &str, text: &str, image_base64_list: &[String]) -> ChatMessage {
    let mut parts = vec![serde_json::json!({"type": "text", "text": text})];
    for img in image_base64_list {
        // img 可能已经是完整的 data:image/...;base64,xxx 格式，也可能是纯 base64
        let url = if img.starts_with("data:") {
            img.clone()
        } else {
            format!("data:image/jpeg;base64,{}", img)
        };
        parts.push(serde_json::json!({
            "type": "image_url",
            "image_url": {"url": url}
        }));
    }
    ChatMessage {
        role: role.to_string(),
        content: Some(Value::Array(parts)),
        tool_calls: None,
        tool_call_id: None,
        name: None,
        reasoning_content: None,
    }
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<ToolDefinition>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_choice: Option<String>,
    #[serde(skip_serializing_if = "is_false")]
    stream: bool,
}

fn is_false(b: &bool) -> bool {
    !*b
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<ToolCall>>,
    /// DeepSeek thinking 模式的推理链
    #[serde(default)]
    reasoning_content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolCall {
    id: String,
    #[serde(rename = "type")]
    call_type: String,
    function: FunctionCall,
}

#[derive(Debug, Deserialize)]
struct FunctionCall {
    name: String,
    arguments: String,
}

// ========== 流式 SSE 结构 ==========

#[derive(Debug, Deserialize)]
struct StreamResponse {
    choices: Vec<StreamChoice>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<StreamToolCall>>,
}

#[derive(Debug, Deserialize)]
struct StreamToolCall {
    index: usize,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    function: Option<StreamFunctionCall>,
}

#[derive(Debug, Deserialize)]
struct StreamFunctionCall {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    arguments: Option<String>,
}

/// AI 配置（从 settings 表读取后传入）
#[derive(Debug, Clone)]
pub struct AiConfig {
    pub api_url: String,
    pub api_key: String,
    pub model: String,
}

/// 用 AI 根据首条用户消息生成对话标题（10 字以内）
pub async fn generate_title(config: &AiConfig, user_message: &str) -> Result<String, String> {
    let messages = vec![
        text_message("system", "你是标题生成器。把用户输入总结成10字以内标题，只返回标题文本，不加引号、标点、解释。"),
        text_message("user", &format!("为以下对话起标题：{}", user_message)),
    ];

    let reply = chat_completion(config, messages, None, None).await?;
    let title = reply.content
        .map(|v| match v { Value::String(s) => s, other => other.to_string() })
        .unwrap_or_default()
        .trim().to_string();
    // 限制长度，去掉可能残留的引号
    let title = title.trim_matches(|c| c == '"' || c == '"' || c == '"' || c == '\'');
    if title.is_empty() {
        Ok("新对话".to_string())
    } else {
        Ok(title.chars().take(20).collect())
    }
}

/// 调用 OpenAI 兼容 API（支持函数调用）
///
/// 如果传了 tools，会自动设置 tool_choice="auto"
/// 返回值中 tool_calls 可能不为 None
///
/// 当 `on_token` 为 Some 时使用流式模式，每个 token 通过回调传给调用方。
/// 当 `on_token` 为 None 时使用原有非流式模式。
pub async fn chat_completion(
    config: &AiConfig,
    messages: Vec<ChatMessage>,
    tools: Option<Vec<ToolDefinition>>,
    on_token: Option<&(dyn Fn(String) + Send + Sync)>,
) -> Result<ChatMessage, String> {
    if config.api_key.is_empty() {
        return Err("未配置 AI API Key，请在设置页面填写".to_string());
    }

    let url = format!("{}/chat/completions", config.api_url.trim_end_matches('/'));

    let tool_choice = if tools.is_some() {
        Some("auto".to_string())
    } else {
        None
    };

    let use_stream = on_token.is_some();

    let body = ChatRequest {
        model: config.model.clone(),
        messages,
        tools,
        tool_choice,
        stream: use_stream,
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            let err_msg = e.to_string();
            if err_msg.contains("timeout") || err_msg.contains("Timeout") {
                "AI 请求超时，请检查网络或稍后重试".to_string()
            } else if err_msg.contains("refused") || err_msg.contains("resolve") || err_msg.contains("dns") {
                "无法连接 AI 服务，请检查网络或 API 地址".to_string()
            } else {
                format!("AI 请求失败: {}", err_msg)
            }
        })?;

    let status = resp.status();
    if !status.is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        let msg = match status.as_u16() {
            401 | 403 => "API Key 无效，请在设置中检查".to_string(),
            429 => "请求太频繁，请稍后再试".to_string(),
            500..=599 => format!("AI 服务暂时不可用（{}），请稍后重试", status.as_u16()),
            _ => format!("AI API 返回错误 {}: {}", status.as_u16(), err_text),
        };
        return Err(msg);
    }

    if let Some(callback) = on_token {
        // 流式模式：逐 chunk 解析 SSE
        handle_stream_response(resp, callback).await
    } else {
        // 非流式模式：解析完整 JSON
        handle_normal_response(resp).await
    }
}

/// 非流式响应处理
async fn handle_normal_response(resp: reqwest::Response) -> Result<ChatMessage, String> {
    let chat_resp: ChatResponse = resp
        .json()
        .await
        .map_err(|e| format!("AI 返回了无法识别的数据格式: {}", e))?;

    let msg = chat_resp
        .choices
        .into_iter()
        .next()
        .ok_or("AI 未返回有效内容，请重试".to_string())?;

    let tool_calls_value = convert_tool_calls(msg.message.tool_calls);

    // 兜底：API 要求 assistant 消息必须有 content 或 tool_calls
    let content = if msg.message.content.is_none() && tool_calls_value.is_none() {
        Some(Value::String("...".to_string()))
    } else {
        msg.message.content.map(|s| Value::String(s))
    };

    Ok(ChatMessage {
        role: "assistant".to_string(),
        content,
        tool_calls: tool_calls_value,
        tool_call_id: None,
        name: None,
        reasoning_content: msg.message.reasoning_content,
    })
}

/// 流式 SSE 响应处理
async fn handle_stream_response(
    resp: reqwest::Response,
    on_token: &(dyn Fn(String) + Send + Sync),
) -> Result<ChatMessage, String> {
    use futures_util::StreamExt;

    let mut full_content = String::new();
    let mut tool_calls_builder: Vec<(usize, String, String)> = Vec::new(); // (index, id+name, arguments)
    let mut stream = resp.bytes_stream();

    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("流式读取失败: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // 按行处理 SSE 数据
        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue; // 跳过空行和注释
            }

            if let Some(data) = line.strip_prefix("data: ") {
                let data = data.trim();
                if data == "[DONE]" {
                    continue;
                }

                if let Ok(resp) = serde_json::from_str::<StreamResponse>(data) {
                    if let Some(choice) = resp.choices.first() {
                        // 累积文本内容
                        if let Some(ref content) = choice.delta.content {
                            full_content.push_str(content);
                            on_token(content.clone());
                        }

                        // 累积 tool_calls
                        if let Some(ref tc_list) = choice.delta.tool_calls {
                            for tc in tc_list {
                                if let Some(ref func) = tc.function {
                                    // 确保有足够的槽位
                                    while tool_calls_builder.len() <= tc.index {
                                        tool_calls_builder.push((tool_calls_builder.len(), String::new(), String::new()));
                                    }
                                    if let Some(ref name) = func.name {
                                        let id_str = tc.id.clone().unwrap_or_default();
                                        tool_calls_builder[tc.index].1 = format!("{}|{}", id_str, name);
                                    }
                                    if let Some(ref args) = func.arguments {
                                        tool_calls_builder[tc.index].2.push_str(args);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 构建最终 ChatMessage
    let tool_calls_value = if tool_calls_builder.is_empty() {
        None
    } else {
        Some(tool_calls_builder.iter()
            .filter(|(_, meta, _)| !meta.is_empty())
            .map(|(_, meta, arguments)| {
                let parts: Vec<&str> = meta.splitn(2, '|').collect();
                let id = parts.first().unwrap_or(&"");
                let name = parts.get(1).unwrap_or(&"");
                serde_json::json!({
                    "id": id,
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": arguments,
                    }
                })
            })
            .collect())
    };

    let content = if full_content.is_empty() { None } else { Some(Value::String(full_content)) };

    // 兜底：API 要求 assistant 消息必须有 content 或 tool_calls
    let content = if content.is_none() && tool_calls_value.is_none() {
        Some(Value::String("...".to_string()))
    } else {
        content
    };

    Ok(ChatMessage {
        role: "assistant".to_string(),
        content,
        tool_calls: tool_calls_value,
        tool_call_id: None,
        name: None,
        reasoning_content: None,
    })
}

/// 转换 tool_calls 为 Value 数组
fn convert_tool_calls(tool_calls: Option<Vec<ToolCall>>) -> Option<Vec<Value>> {
    tool_calls.map(|tc| {
        tc.into_iter()
            .map(|t| {
                serde_json::json!({
                    "id": t.id,
                    "type": t.call_type,
                    "function": {
                        "name": t.function.name,
                        "arguments": t.function.arguments,
                    }
                })
            })
            .collect()
    })
}
