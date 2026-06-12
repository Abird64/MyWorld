use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn guide_definitions() -> Vec<ToolDefinition> {
    vec![
        resolve_date_definition(),
        get_guide_definition(),
    ]
}

fn resolve_date_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "resolve_date".to_string(),
            description: "将中文相对日期表达式解析为精确的YYYY-MM-DD日期。当用户提到[明天/后天/下周三/月底/周末/3天后]等相对时间时，先调用此工具获取准确日期，再传给其他工具。也支持[5月3号/12月20号]等具体日期确认。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "expression": {
                        "type": "string",
                        "description": "中文日期表达式，如：明天、后天、下周三、月底、周末、3天后、这周五、5月3号、下个月15号"
                    }
                }),
                required: vec!["expression".to_string()],
            },
        },
    }
}

fn get_guide_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "get_guide".to_string(),
            description: "查阅某个模块的详细使用指南。当你不确定某个模块的用法、规则或最佳实践时调用。可选模块：任务、日程、日记、人脉、习惯、技能、小本本、XP、概览".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "module": {
                        "type": "string",
                        "enum": ["任务", "日程", "日记", "人脉", "习惯", "技能", "小本本", "XP", "萤火", "专注", "概览"],
                        "description": "要查阅的模块名"
                    }
                }),
                required: vec!["module".to_string()],
            },
        },
    }
}
