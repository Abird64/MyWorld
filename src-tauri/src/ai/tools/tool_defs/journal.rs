use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn journal_definitions() -> Vec<ToolDefinition> {
    vec![
        get_journal_by_date_definition(),
        save_journal_definition(),
        get_timeline_definition(),
        settle_diary_definition(),
        search_journals_definition(),
    ]
}

fn get_journal_by_date_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "get_journal_by_date".to_string(),
            description: "读取某一天的日记。当用户问[我那天写了什么/看看日记/某天的日记/回顾]时调用。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "date": {
                        "type": "string",
                        "description": "日期，YYYY-MM-DD格式如 2026-05-23。如果用户说昨天/今天/前天，请根据当前时间推算"
                    }
                }),
                required: vec!["date".to_string()],
            },
        },
    }
}

fn save_journal_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "save_journal".to_string(),
            description: "写入/保存日记。当用户说[记一下日记/写日记/记一笔/记录今天]时调用。内容支持Markdown格式。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "date": {
                        "type": "string",
                        "description": "日记日期，YYYY-MM-DD格式。用户没提日期则默认今天"
                    },
                    "content": {
                        "type": "string",
                        "description": "日记正文，Markdown格式。帮用户把口语化的描述整理成有条理的文字"
                    },
                    "mood": {
                        "type": "string",
                        "enum": ["happy", "sad", "neutral", "tired", "excited", "anxious"],
                        "description": "心情，根据用户叙述的语气推断"
                    },
                    "tags": {
                        "type": "string",
                        "description": "标签，JSON数组字符串，如'[\"学习\",\"生活\"]'"
                    }
                }),
                required: vec!["date".to_string(), "content".to_string()],
            },
        },
    }
}

pub fn settle_diary_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "settle_diary".to_string(),
            description: "结算今日日记的XP经验值。先读日记内容，根据内容判断侧重属性并分配经验值（总XP 3-10，单属性上限5，挑2-4个相关属性）。每日限一次。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "date": {
                        "type": "string",
                        "description": "日记日期，YYYY-MM-DD格式"
                    },
                    "xp_allocations": {
                        "type": "array",
                        "description": "XP经验值分配方案。根据日记内容判断侧重，总XP 3-10分配到2-4个相关属性，单属性上限5。例：今天学习了→focus+4,creativity+2；今天运动了→vitality+5,empathy+2；今天社交了→empathy+4,insight+3",
                        "items": {
                            "type": "object",
                            "properties": {
                                "skill_id": {
                                    "type": "string",
                                    "description": "属性ID：focus/vitality/empathy/creativity/insight/expression"
                                },
                                "xp_amount": {
                                    "type": "integer",
                                    "description": "该属性的XP值"
                                }
                            }
                        }
                    }
                }),
                required: vec!["date".to_string(), "xp_allocations".to_string()],
            },
        },
    }
}

fn search_journals_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "search_journals".to_string(),
            description: "搜索日记内容。当用户问[之前写过什么/日记里提到过/找找日记/有没有关于XX的日记]时调用。搜索日记标题、摘要和正文内容，返回匹配的片段。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，匹配日记标题、摘要和正文内容"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回结果数量上限，默认3，最大10"
                    }
                }),
                required: vec!["query".to_string()],
            },
        },
    }
}

fn get_timeline_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "get_timeline".to_string(),
            description: "查看某个月哪些日期有日记。当用户问[这个月写了几天日记/哪些天有日记/日记记录情况]时调用。返回有日记的日期列表。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "year": {
                        "type": "integer",
                        "description": "年份，如 2026"
                    },
                    "month": {
                        "type": "integer",
                        "description": "月份，1-12。用户说本月则根据当前时间推断"
                    }
                }),
                required: vec!["year".to_string(), "month".to_string()],
            },
        },
    }
}
