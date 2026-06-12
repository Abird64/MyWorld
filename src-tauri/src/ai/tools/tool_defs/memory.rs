use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn memory_definitions() -> Vec<ToolDefinition> {
    vec![
        record_memory_definition(),
        search_memories_definition(),
        delete_memory_definition(),
    ]
}

fn record_memory_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "record_memory".to_string(),
            description: "在[小本本]中记录一条关于用户的记忆。当你了解到用户的身份、爱好、口味、习惯、性格、人际关系、近期状态或目标等信息时，主动调用此工具记录。写操作需要用户确认。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "content": {
                        "type": "string",
                        "description": "记忆内容，用简洁的第三人称陈述句，如'用户每天下午3点喝咖啡''用户喜欢简洁的设计风格'"
                    },
                    "memory_type": {
                        "type": "string",
                        "enum": ["identity", "interest", "taste", "habit", "personality", "relationship", "status", "goal", "event", "other"],
                        "description": "记忆类型：identity=身份信息，interest=兴趣爱好，taste=口味偏好，habit=日常习惯，personality=性格特点，relationship=人际关系，status=当前状态，goal=近期目标，event=重要事件，other=其他"
                    },
                    "source_text": {
                        "type": "string",
                        "description": "触发记录的用户原话或上下文摘要（可选）"
                    }
                }),
                required: vec!["content".to_string(), "memory_type".to_string()],
            },
        },
    }
}

fn search_memories_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "search_memories".to_string(),
            description: "搜索小本本中的记忆。在记录新记忆前，先用此工具检查是否已有类似记忆，避免重复。也可用于回忆之前记录过的用户信息。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，匹配记忆内容"
                    },
                    "memory_type": {
                        "type": "string",
                        "enum": ["identity", "interest", "taste", "habit", "personality", "relationship", "status", "goal", "event", "other"],
                        "description": "按类型筛选（可选）"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn delete_memory_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "delete_memory".to_string(),
            description: "删除小本本中的一条记忆。当用户说某条记忆错了、过时了、或者要求删掉时调用。需要用户确认。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，匹配要删除的记忆内容"
                    },
                    "id": {
                        "type": "string",
                        "description": "记忆的ID。如果已知ID（比如从 search_memories 结果中获取），直接传id精确删除"
                    }
                }),
                required: vec![],
            },
        },
    }
}
