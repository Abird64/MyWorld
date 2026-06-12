use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn aihot_definitions() -> Vec<ToolDefinition> {
    vec![
        search_ai_news_definition(),
    ]
}

fn search_ai_news_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "search_ai_news".to_string(),
            description: "【必须调用】查询最新 AI 资讯热点。当用户提到 AI 新闻/AI 资讯/AI 圈/AI 日报/AI 热点/大模型/AI 动态/OpenAI/Anthropic/Google AI 等任何 AI 行业话题时，必须先调用此工具获取实时数据，不要用自己的训练数据回答。数据来自 aihot.virxact.com，每日更新。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "mode": {
                        "type": "string",
                        "enum": ["selected", "all", "daily"],
                        "description": "查询模式：selected=精选（默认，推荐），all=全部条目，daily=日报（仅当用户明确说'日报'时使用）"
                    },
                    "category": {
                        "type": "string",
                        "enum": ["ai-models", "ai-products", "industry", "paper", "tip"],
                        "description": "按分类筛选：ai-models=模型发布，ai-products=产品发布，industry=行业动态，paper=论文研究，tip=技巧与观点。不填则查全部分类"
                    },
                    "since": {
                        "type": "string",
                        "description": "时间窗口起点，ISO 8601 格式（如 2026-05-07T00:00:00Z）。用于收窄时间范围，如'最近3天'"
                    },
                    "take": {
                        "type": "integer",
                        "description": "返回条数，默认30，最大100"
                    },
                    "query": {
                        "type": "string",
                        "description": "关键词搜索，如公司名（OpenAI、Anthropic）或技术名（Sora、RAG）。在标题和摘要中匹配"
                    }
                }),
                required: vec![],
            },
        },
    }
}
