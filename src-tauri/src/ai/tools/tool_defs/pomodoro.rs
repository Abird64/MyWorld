use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn pomodoro_definitions() -> Vec<ToolDefinition> {
    vec![
        start_pomodoro_definition(),
        get_pomodoro_stats_definition(),
    ]
}

fn start_pomodoro_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "start_pomodoro".to_string(),
            description: "为用户启动一个番茄钟专注会话。当用户说[开始专注/帮我计时/开始番茄钟/开始工作]或表现出需要专注时调用。也可以主动建议用户进入专注状态。默认25分钟，可指定时长。\n\n重要：启动前先问用户[要关联一个任务，还是直接开始专注？]。不要自作主张替用户决定。如果用户说关联任务但没说是哪个，就问一句。如果用户说直接开始，传 task_title 为空或不传即可。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "session_type": {
                        "type": "string",
                        "enum": ["focus", "break"],
                        "description": "会话类型：focus=专注（默认），break=休息"
                    },
                    "target_minutes": {
                        "type": "integer",
                        "description": "目标时长（分钟）。专注默认25分钟，休息默认5分钟"
                    },
                    "task_title": {
                        "type": "string",
                        "description": "关联的任务标题，用于搜索匹配任务（可选）"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn get_pomodoro_stats_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "get_pomodoro_stats".to_string(),
            description: "查看今日番茄钟统计。当用户问[今天专注了多久/今天有几个番茄/看看专注数据]时调用。返回专注次数、总时长、完成率等。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({}),
                required: vec![],
            },
        },
    }
}
