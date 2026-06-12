use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn schedule_definitions() -> Vec<ToolDefinition> {
    vec![
        create_schedule_definition(),
        list_schedules_in_range_definition(),
        list_calendars_definition(),
        update_schedule_definition(),
        delete_schedule_definition(),
        list_countdowns_definition(),
    ]
}

fn create_schedule_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "create_schedule".to_string(),
            description: "创建一个日历事件/日程。当用户说[安排/定在/约了/加个日程/添加课程]等时调用。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "title": {
                        "type": "string",
                        "description": "事件标题，简洁概括"
                    },
                    "start_at": {
                        "type": "string",
                        "description": "开始时间，ISO8601格式如 2026-05-23T14:00:00+08:00。带上时区"
                    },
                    "end_at": {
                        "type": "string",
                        "description": "结束时间，ISO8601格式。如果用户没说具体结束时间，默认为开始时间+1小时"
                    },
                    "description": {
                        "type": "string",
                        "description": "事件描述/详情"
                    },
                    "is_all_day": {
                        "type": "boolean",
                        "description": "是否全天事件，如生日、纪念日等"
                    },
                    "location": {
                        "type": "string",
                        "description": "地点"
                    },
                    "calendar_id": {
                        "type": "string",
                        "description": "日历ID。不填则使用默认日历。可通过 list_calendars 工具查看可选日历"
                    },
                    "rrule": {
                        "type": "string",
                        "description": "重复规则，iCal RRULE格式。如 FREQ=WEEKLY;BYDAY=MO,TU 表示每周一二重复。INTERVAL=2表示每隔一次，如 FREQ=WEEKLY;INTERVAL=2 表示每隔两周。注意：结束时间用UNTIL指定，格式为YYYYMMDDTHHMMSSZ"
                    },
                    "reminder": {
                        "type": "string",
                        "description": "提醒时间，提前多少分钟，如'10'表示提前10分钟提醒"
                    },
                    "event_type": {
                        "type": "string",
                        "enum": ["event", "countdown"],
                        "description": "事件类型：event=普通日程（默认），countdown=倒数日。倒数日的 start_at 填目标日期"
                    }
                }),
                required: vec!["title".to_string(), "start_at".to_string()],
            },
        },
    }
}

fn list_schedules_in_range_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "list_schedules_in_range".to_string(),
            description: "查看某个日期范围内的日程/事件。当用户问[这周有什么安排/今天有什么课/下周有什么计划/某天的日程]时调用。包含重复事件的展开实例。返回每条日程的 id 可用于后续修改/删除操作。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "start_date": {
                        "type": "string",
                        "description": "范围开始日期，YYYY-MM-DD格式如 2026-05-23"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "范围结束日期，YYYY-MM-DD格式如 2026-05-29"
                    }
                }),
                required: vec!["start_date".to_string(), "end_date".to_string()],
            },
        },
    }
}

fn list_calendars_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "list_calendars".to_string(),
            description: "查看所有可用的日历分类（仅返回日历定义：名称、ID、颜色，不含具体日程事件）。如需查看某天的日程安排，请使用 list_schedules_in_range。创建或修改日程时，用这里的 calendar_id 分配日程到对应日历。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({}),
                required: vec![],
            },
        },
    }
}

fn update_schedule_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "update_schedule".to_string(),
            description: "修改一个已有日程。用query搜索或id直传指定日程，传要修改的字段。如果已知日程ID优先用id。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，匹配日程标题"
                    },
                    "id": {
                        "type": "string",
                        "description": "日程ID，如果已知ID则跳过搜索直接修改"
                    },
                    "title": {
                        "type": "string",
                        "description": "新标题"
                    },
                    "start_at": {
                        "type": "string",
                        "description": "新的开始时间，ISO8601格式"
                    },
                    "end_at": {
                        "type": "string",
                        "description": "新的结束时间，ISO8601格式"
                    },
                    "description": {
                        "type": "string",
                        "description": "新描述"
                    },
                    "location": {
                        "type": "string",
                        "description": "新地点"
                    },
                    "calendar_id": {
                        "type": "string",
                        "description": "新的日历ID"
                    },
                    "is_all_day": {
                        "type": "boolean",
                        "description": "是否全天事件"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn delete_schedule_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "delete_schedule".to_string(),
            description: "删除一个已有日程。当用户说[取消日程/删掉某个活动/不去了]时调用。用query或id指定要删除的日程。如果已知日程ID（从list_schedules_in_range结果的序号中获取），优先用id。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，匹配日程标题。当用户说名字时用"
                    },
                    "id": {
                        "type": "string",
                        "description": "日程ID，如果从之前list_schedules_in_range结果中已知ID，直接传此参数，跳过搜索"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn list_countdowns_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "list_countdowns".to_string(),
            description: "查看所有倒数日。当用户问[有哪些倒数日/看看倒数/离什么还有多久]时调用。返回每个倒数日的标题、目标日期和剩余天数。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({}),
                required: vec![],
            },
        },
    }
}
