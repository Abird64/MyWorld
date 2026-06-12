use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn task_definitions() -> Vec<ToolDefinition> {
    vec![
        create_task_definition(),
        complete_task_definition(),
        delete_task_definition(),
        search_tasks_definition(),
        update_task_definition(),
    ]
}

fn create_task_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "create_task".to_string(),
            description: "创建一个新任务。当用户说[帮我记一下/提醒我/加个任务]等意图时调用。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "title": {
                        "type": "string",
                        "description": "任务标题，用简洁的语言概括要做的事"
                    },
                    "description": {
                        "type": "string",
                        "description": "任务描述/详情，用户补充的额外信息"
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["high", "medium", "low", "none"],
                        "description": "优先级：high=紧急且重要，medium=重要但不紧急，low=一般，none=未指定。默认根据语气推断"
                    },
                    "deadline": {
                        "type": "string",
                        "description": "截止时间，ISO8601格式如 2026-05-23T18:00:00+08:00。如果用户说明天下午3点前，请推算为带时区的完整时间"
                    },
                    "scheduled_at": {
                        "type": "string",
                        "description": "计划开始时间，ISO8601格式。用户说周六做就填周六的日期"
                    },
                    "estimated_minutes": {
                        "type": "integer",
                        "description": "预估耗时（分钟），用户如果说大概要2小时就填120"
                    },
                    "notes": {
                        "type": "string",
                        "description": "备注信息，用户提到的补充说明"
                    },
                    "tags": {
                        "type": "string",
                        "description": "标签，JSON字符串数组格式，如'[\"学习\",\"编程\"]'"
                    },
                    "xp_allocations": {
                        "type": "array",
                        "description": "XP经验值分配方案。根据任务难度确定总XP（轻松3-5/普通6-10/困难11-16），再分配到1-3个相关属性上，单属性上限8。例：[{\"skill_id\":\"focus\",\"xp_amount\":5},{\"skill_id\":\"creativity\",\"xp_amount\":3}]",
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
                required: vec!["title".to_string()],
            },
        },
    }
}

fn complete_task_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "complete_task".to_string(),
            description: "完成一个任务并分配经验值。当用户说做完了/搞定了某件事时调用。必须根据难度判断总XP并分配到对应属性上。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "id": {
                        "type": "string",
                        "description": "任务的唯一ID。如果已知ID（比如从搜索结果中获取），直接用id，不需要query"
                    },
                    "query": {
                        "type": "string",
                        "description": "任务标题/描述关键词，用于搜索要完成的任务。如果已知id则不需要填query"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress"],
                        "description": "按状态筛选，不填则默认只搜未完成(pending/in_progress)的任务"
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["high", "medium", "low", "none"],
                        "description": "按优先级筛选，用户说「那个紧急的任务」时可填high"
                    },
                    "xp_allocations": {
                        "type": "array",
                        "description": "XP经验值分配方案。根据任务难度确定总XP（轻松3-5/普通6-10/困难11-16），再分配到1-3个相关属性上，单属性上限8。例：[{\"skill_id\":\"focus\",\"xp_amount\":5},{\"skill_id\":\"creativity\",\"xp_amount\":3}]",
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
                required: vec![],
            },
        },
    }
}

fn delete_task_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "delete_task".to_string(),
            description: "删除一个任务。当用户说删掉/取消/不要了某个任务时调用。优先用id精确指定，或通过query搜索后选择。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "id": {
                        "type": "string",
                        "description": "任务的唯一ID。如果已知ID（比如从搜索结果中获取），直接用id精确删除，不需要query"
                    },
                    "query": {
                        "type": "string",
                        "description": "任务标题/描述关键词，用于搜索要删除的任务。如果已知id则不需要填query"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "completed", "cancelled"],
                        "description": "按状态筛选，不填则搜索所有状态（已完成的也可以删）"
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["high", "medium", "low", "none"],
                        "description": "按优先级筛选"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn search_tasks_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "search_tasks".to_string(),
            description: "查看/搜索任务列表。当用户问[有哪些任务/帮我看看任务/找一下某个任务/今天有什么安排]时调用。query为空则列出所有任务。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，匹配标题/描述/备注。不填则返回所有任务"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "completed", "cancelled"],
                        "description": "按状态筛选，不填则返回所有状态"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn update_task_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "update_task".to_string(),
            description: "修改一个已有任务。当用户说[改一下/修改/更新]某个任务时调用。优先用id精确指定，或通过query搜索后选择。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "id": {
                        "type": "string",
                        "description": "任务的唯一ID。如果已知ID（比如从搜索结果中获取），直接用id精确修改，不需要query"
                    },
                    "query": {
                        "type": "string",
                        "description": "任务标题关键词，用于搜索要修改的任务。如果已知id则不需要填query"
                    },
                    "title": {
                        "type": "string",
                        "description": "新的任务标题"
                    },
                    "description": {
                        "type": "string",
                        "description": "新的任务描述"
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["high", "medium", "low", "none"],
                        "description": "新的优先级"
                    },
                    "deadline": {
                        "type": "string",
                        "description": "新的截止时间，ISO8601格式"
                    },
                    "scheduled_at": {
                        "type": "string",
                        "description": "新的计划开始时间，ISO8601格式"
                    },
                    "estimated_minutes": {
                        "type": "integer",
                        "description": "新的预估耗时（分钟）"
                    },
                    "notes": {
                        "type": "string",
                        "description": "新的备注信息"
                    },
                    "tags": {
                        "type": "string",
                        "description": "新的标签，JSON数组字符串格式"
                    }
                }),
                required: vec![],
            },
        },
    }
}
