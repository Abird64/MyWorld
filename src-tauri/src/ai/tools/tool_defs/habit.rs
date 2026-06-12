use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn habit_definitions() -> Vec<ToolDefinition> {
    vec![
        list_habits_definition(),
        create_habit_definition(),
        update_habit_definition(),
        delete_habit_definition(),
        check_habit_definition(),
        uncheck_habit_definition(),
    ]
}

fn list_habits_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "list_habits".to_string(),
            description: "查看所有习惯及打卡状态。当用户问[有哪些习惯/习惯打卡情况/看看习惯]时调用。返回每个习惯的名称、频率、连续打卡天数、今日是否已打卡。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({}),
                required: vec![],
            },
        },
    }
}

fn create_habit_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "create_habit".to_string(),
            description: "创建一个新习惯。当用户说[加个习惯/养成一个习惯/开始打卡XX]时调用。新习惯默认每次打卡获得5点XP经验值（分配到对应六维属性）。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "name": {
                        "type": "string",
                        "description": "习惯名称，如'阅读''运动''早起'"
                    },
                    "frequency_type": {
                        "type": "string",
                        "enum": ["daily", "weekly", "custom"],
                        "description": "频率类型：daily=每天（默认），weekly=每周，custom=自定义"
                    },
                    "icon": {
                        "type": "string",
                        "description": "图标 emoji，如'📖''🏃''🌅'"
                    },
                    "color": {
                        "type": "string",
                        "description": "颜色标识，如'red''blue''green'"
                    }
                }),
                required: vec!["name".to_string()],
            },
        },
    }
}

fn check_habit_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "check_habit".to_string(),
            description: "给习惯打卡（签到）。当用户说[打卡/签到/完成了XX习惯]时调用。优先用habit_id精确指定，或通过query按名称搜索。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "habit_id": {
                        "type": "string",
                        "description": "习惯的唯一ID。如果已知ID（比如从list_habits结果中获取），直接用habit_id"
                    },
                    "query": {
                        "type": "string",
                        "description": "习惯名称关键词，用于搜索要打卡的习惯。如果已知habit_id则不需要填"
                    },
                    "date": {
                        "type": "string",
                        "description": "打卡日期，YYYY-MM-DD格式。不填则默认今天"
                    },
                    "note": {
                        "type": "string",
                        "description": "打卡备注，如'跑了3公里''读了50页'"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn uncheck_habit_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "uncheck_habit".to_string(),
            description: "取消习惯打卡。当用户说[取消打卡/撤销签到/今天不算]时调用。优先用habit_id精确指定，或通过query按名称搜索。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "habit_id": {
                        "type": "string",
                        "description": "习惯的唯一ID。如果已知ID，直接用habit_id"
                    },
                    "query": {
                        "type": "string",
                        "description": "习惯名称关键词，用于搜索要取消打卡的习惯"
                    },
                    "date": {
                        "type": "string",
                        "description": "要取消打卡的日期，YYYY-MM-DD格式。不填则默认今天"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn update_habit_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "update_habit".to_string(),
            description: "修改一个已有习惯。当用户说[修改习惯/改一下习惯/换个名字/改颜色/改经验值]时调用。用query搜索或habit_id直传指定习惯。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "habit_id": {
                        "type": "string",
                        "description": "习惯的唯一ID。如果已知ID（比如从list_habits结果中获取），直接用habit_id"
                    },
                    "query": {
                        "type": "string",
                        "description": "习惯名称关键词，用于搜索要修改的习惯"
                    },
                    "name": {
                        "type": "string",
                        "description": "新的习惯名称"
                    },
                    "icon": {
                        "type": "string",
                        "description": "新的图标emoji"
                    },
                    "color": {
                        "type": "string",
                        "description": "新的颜色标识"
                    },
                    "frequency_type": {
                        "type": "string",
                        "enum": ["daily", "weekly", "custom"],
                        "description": "新的频率类型"
                    },
                    "xp_per_check": {
                        "type": "integer",
                        "description": "每次打卡获得的XP经验值，默认5。修改后新打卡生效"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn delete_habit_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "delete_habit".to_string(),
            description: "删除一个习惯。当用户说[删掉某个习惯/不想要这个习惯了/放弃这个习惯]时调用。用query搜索或habit_id直传指定习惯。需要用户确认。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "habit_id": {
                        "type": "string",
                        "description": "习惯的唯一ID。如果已知ID，直接用habit_id"
                    },
                    "query": {
                        "type": "string",
                        "description": "习惯名称关键词，用于搜索要删除的习惯"
                    }
                }),
                required: vec![],
            },
        },
    }
}
