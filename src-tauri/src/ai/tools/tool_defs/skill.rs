use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn skill_definitions() -> Vec<ToolDefinition> {
    vec![
        list_skills_definition(),
        get_task_skills_definition(),
    ]
}

fn list_skills_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "list_skills".to_string(),
            description: "查看六维属性面板。当用户问[我的属性/成长怎么样了/技能等级/看看成长]时调用。返回六维属性（专注力/生命力/共情力/创造力/洞察力/表现力）的等级和经验值。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({}),
                required: vec![],
            },
        },
    }
}

fn get_task_skills_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "get_task_skills".to_string(),
            description: "查看某个任务分配了哪些属性经验值。当用户问[这个任务加什么属性/这个任务有多少经验]时调用。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "query": {
                        "type": "string",
                        "description": "任务标题关键词，用于搜索要查看的任务"
                    }
                }),
                required: vec!["query".to_string()],
            },
        },
    }
}
