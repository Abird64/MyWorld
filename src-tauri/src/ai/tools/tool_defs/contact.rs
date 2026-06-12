use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn contact_definitions() -> Vec<ToolDefinition> {
    vec![
        create_contact_definition(),
        search_contacts_definition(),
        list_contacts_definition(),
        update_contact_definition(),
        delete_contact_definition(),
    ]
}

fn create_contact_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "create_contact".to_string(),
            description: "创建一个新联系人。当用户说[记一个联系人/加个人/认识了一个人/存个号码]时调用。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "name": {
                        "type": "string",
                        "description": "姓名"
                    },
                    "nickname": {
                        "type": "string",
                        "description": "昵称/别名，多个用逗号分隔"
                    },
                    "group_name": {
                        "type": "string",
                        "enum": ["家人", "朋友", "同学", "同事", "老师"],
                        "description": "分组。根据语境推断，不确定就不填"
                    },
                    "birthday_calendar": {
                        "type": "string",
                        "enum": ["solar", "lunar"],
                        "description": "日历类型：solar=阳历(公历)，lunar=农历(阴历)。用户没说则默认solar"
                    },
                    "birthday_year": {
                        "type": "integer",
                        "description": "出生年份，如 1998。如果用户没提供年份则不填"
                    },
                    "birthday_month": {
                        "type": "integer",
                        "description": "出生月份，1-12"
                    },
                    "birthday_day": {
                        "type": "integer",
                        "description": "出生日期，1-31"
                    },
                    "contact_methods": {
                        "type": "array",
                        "description": "联系方式列表，每项包含 method_type（phone/wechat/qq/email/other）和 value",
                        "items": {
                            "type": "object",
                            "properties": {
                                "method_type": { "type": "string", "description": "联系方式类型：phone, wechat, qq, email, other" },
                                "value": { "type": "string", "description": "联系方式的值" }
                            }
                        }
                    },
                    "notes": {
                        "type": "string",
                        "description": "备注/描述，如[上次见面是什么时候/有什么特点/怎么认识的]"
                    }
                }),
                required: vec!["name".to_string()],
            },
        },
    }
}

fn search_contacts_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "search_contacts".to_string(),
            description: "搜索联系人。当用户问[找一下谁/某人的联系方式/谁是谁]时调用。按姓名/昵称/描述搜索。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，匹配姓名/昵称/描述"
                    }
                }),
                required: vec!["query".to_string()],
            },
        },
    }
}

fn list_contacts_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "list_contacts".to_string(),
            description: "列出所有联系人。当用户问[我认识多少人/有哪些联系人/某组有谁]时调用。可按分组筛选。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "group_name": {
                        "type": "string",
                        "enum": ["家人", "朋友", "同学", "同事", "老师"],
                        "description": "按分组筛选，不填则列出全部"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn update_contact_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "update_contact".to_string(),
            description: "修改一个已有联系人。用query搜索或id直传指定联系人。如果已知联系人ID优先用id。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，匹配姓名/昵称"
                    },
                    "id": {
                        "type": "string",
                        "description": "联系人ID，如果已知则跳过搜索直接修改"
                    },
                    "name": {
                        "type": "string",
                        "description": "新姓名"
                    },
                    "nickname": {
                        "type": "string",
                        "description": "新昵称"
                    },
                    "group_name": {
                        "type": "string",
                        "enum": ["家人", "朋友", "同学", "同事", "老师"],
                        "description": "新分组"
                    },
                    "birthday_calendar": {
                        "type": "string",
                        "enum": ["solar", "lunar"],
                        "description": "新日历类型：solar=阳历，lunar=农历"
                    },
                    "birthday_year": {
                        "type": "integer",
                        "description": "新出生年份，如 1998。不填表示不修改"
                    },
                    "birthday_month": {
                        "type": "integer",
                        "description": "新出生月份，1-12"
                    },
                    "birthday_day": {
                        "type": "integer",
                        "description": "新出生日期，1-31"
                    },
                    "contact_methods": {
                        "type": "array",
                        "description": "新联系方式列表，每项包含 method_type（phone/wechat/qq/email/other）和 value",
                        "items": {
                            "type": "object",
                            "properties": {
                                "method_type": { "type": "string", "description": "联系方式类型" },
                                "value": { "type": "string", "description": "联系方式的值" }
                            }
                        }
                    },
                    "notes": {
                        "type": "string",
                        "description": "新备注"
                    }
                }),
                required: vec!["query".to_string()],
            },
        },
    }
}

fn delete_contact_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "delete_contact".to_string(),
            description: "删除一个联系人。用query搜索或id直传指定联系人。如果已知联系人ID优先用id。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，匹配姓名/昵称"
                    },
                    "id": {
                        "type": "string",
                        "description": "联系人ID，如果已知则跳过搜索直接删除"
                    }
                }),
                required: vec![],
            },
        },
    }
}
