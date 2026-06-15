use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn inspiration_definitions() -> Vec<ToolDefinition> {
    vec![
        parse_video_definition(),
    ]
}

fn parse_video_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "parse_video".to_string(),
            description: "解析视频链接，提取字幕内容并分析。当用户发送 B 站视频链接（包含 b23.tv 或 bilibili.com）时，自动调用此工具获取视频字幕，然后分析内容提取行动项。支持的链接格式：https://www.bilibili.com/video/BVxxxxxx 或 https://b23.tv/xxxx".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "url": {
                        "type": "string",
                        "description": "视频链接，如 https://www.bilibili.com/video/BV1GJ411x7h7"
                    }
                }),
                required: vec!["url".to_string()],
            },
        },
    }
}
