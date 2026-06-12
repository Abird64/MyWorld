use crate::ai::tools::{ToolDefinition, FunctionDef, ToolParameters};

pub fn glow_definitions() -> Vec<ToolDefinition> {
    vec![
        reward_glow_definition(),
        get_glow_balance_definition(),
        list_wishes_definition(),
        create_wish_definition(),
        update_wish_definition(),
        delete_wish_definition(),
        buy_tickets_definition(),
        draw_wish_definition(),
        redeem_wish_definition(),
        list_draws_definition(),
        list_glow_ledger_definition(),
    ]
}

fn reward_glow_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "reward_glow".to_string(),
            description: "主动奖励用户萤火。当你观察到用户表现出自制力、坚持、成长、善意或突破时，主动调用此工具给予萤火奖励，并附上温暖的鼓励。这是提灯最特别的互动方式——不是冷冰冰的积分，而是一盏灯对旅人的认可。每次奖励5-50萤火，需要有充分的理由。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "amount": {
                        "type": "integer",
                        "description": "奖励萤火数量，5-50。小进步5-10，明显进步15-25，重大突破30-50"
                    },
                    "reason": {
                        "type": "string",
                        "description": "奖励理由，用温暖诗意的语言描述用户做了什么值得奖励的事。如「今天在很想放弃的时候坚持完成了学习计划」"
                    },
                    "category": {
                        "type": "string",
                        "enum": ["克制", "坚持", "成长", "善意", "突破", "其他"],
                        "description": "奖励类别：克制=控制住了欲望/冲动/拖延，坚持=持续做某件事/习惯打卡，成长=学到了新东西/有了新感悟，善意=帮助了别人/做了好事，突破=完成了挑战/迈出了舒适区，其他=不属于以上的值得鼓励的行为"
                    }
                }),
                required: vec!["amount".to_string(), "reason".to_string(), "category".to_string()],
            },
        },
    }
}

fn get_glow_balance_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "get_glow_balance".to_string(),
            description: "查看用户的萤火余额和奖券数量。当用户问[我有多少萤火/看看萤火/奖券有多少/萤火余额]时调用。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({}),
                required: vec![],
            },
        },
    }
}

fn list_wishes_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "list_wishes".to_string(),
            description: "查看用户的心愿清单。当用户问[我的心愿/许愿池里有什么/看看心愿/想要什么奖励]时调用。可按状态筛选。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "status": {
                        "type": "string",
                        "enum": ["active", "achieved"],
                        "description": "按状态筛选：active=未达成（默认），achieved=已达成。不填则返回全部"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn create_wish_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "create_wish".to_string(),
            description: "创建一个新心愿（许愿池商品）。当用户说[加个心愿/想兑换XX/添加一个奖励/许个愿]时调用。需要用户确认。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "title": {
                        "type": "string",
                        "description": "心愿名称，简洁描述想要的东西/体验"
                    },
                    "description": {
                        "type": "string",
                        "description": "心愿描述/详情"
                    },
                    "level": {
                        "type": "integer",
                        "enum": [1, 2, 3, 4],
                        "description": "心愿等级。1=微小心愿(20-50萤火)，2=光影心愿(50-150萤火)，3=流光心愿(150-400萤火)，4=极光心愿(400-1000萤火)。根据用户描述推断"
                    },
                    "cost_glow": {
                        "type": "integer",
                        "description": "兑换所需萤火数。根据等级推荐范围：L1:20-50, L2:50-150, L3:150-400, L4:400-1000"
                    },
                    "quantity": {
                        "type": "integer",
                        "description": "可兑换次数，不填默认1次，-1表示无限"
                    }
                }),
                required: vec!["title".to_string(), "level".to_string(), "cost_glow".to_string()],
            },
        },
    }
}

fn update_wish_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "update_wish".to_string(),
            description: "修改一个已有心愿。当用户说[改一下心愿/调整心愿/修改奖励]时调用。用id或搜索指定心愿。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "id": {
                        "type": "string",
                        "description": "心愿的ID。如果从list_wishes结果中已知，直接传id"
                    },
                    "query": {
                        "type": "string",
                        "description": "心愿名称关键词，用于搜索要修改的心愿"
                    },
                    "title": {
                        "type": "string",
                        "description": "新的心愿名称"
                    },
                    "description": {
                        "type": "string",
                        "description": "新的心愿描述"
                    },
                    "level": {
                        "type": "integer",
                        "enum": [1, 2, 3, 4],
                        "description": "新的心愿等级"
                    },
                    "cost_glow": {
                        "type": "integer",
                        "description": "新的兑换所需萤火数"
                    },
                    "quantity": {
                        "type": "integer",
                        "description": "新的可兑换次数，-1表示无限"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn delete_wish_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "delete_wish".to_string(),
            description: "删除一个心愿。当用户说[删掉心愿/不想要这个奖励了/移除心愿]时调用。需要用户确认。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "id": {
                        "type": "string",
                        "description": "心愿的ID。如果已知ID，直接传id精确删除"
                    },
                    "query": {
                        "type": "string",
                        "description": "心愿名称关键词，用于搜索要删除的心愿"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn buy_tickets_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "buy_tickets".to_string(),
            description: "用萤火购买抽奖券。微光券100萤火/张（抽Lv1-2心愿），拾光券500萤火/张（抽Lv3-4心愿）。当用户说[买奖券/买抽奖券/换奖券/用萤火买券]时调用。需要用户确认。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "ticket_type": {
                        "type": "string",
                        "enum": ["micro", "shimmer"],
                        "description": "奖券类型：micro=微光券（100萤火/张），shimmer=拾光券（500萤火/张）"
                    },
                    "count": {
                        "type": "integer",
                        "description": "购买数量，默认1。先确认用户有足够萤火（微光券100/张，拾光券500/张）"
                    }
                }),
                required: vec!["ticket_type".to_string(), "count".to_string()],
            },
        },
    }
}

fn draw_wish_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "draw_wish".to_string(),
            description: "用奖券抽奖（消耗1张奖券随机抽取心愿池中的心愿）。当用户说[抽奖/抽心愿/试试手气/抽一发]时调用。微光券抽Lv1-2，拾光券抽Lv3-4。每抽一次保底计数+1，微光30抽/拾光80抽可自选。需要用户确认。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "ticket_type": {
                        "type": "string",
                        "enum": ["micro", "shimmer"],
                        "description": "使用奖券类型：micro=微光券（抽Lv1-2），shimmer=拾光券（抽Lv3-4）"
                    }
                }),
                required: vec!["ticket_type".to_string()],
            },
        },
    }
}

fn redeem_wish_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "redeem_wish".to_string(),
            description: "用萤火直接兑换心愿（不抽奖，直接购买）。当用户说[兑换心愿/换这个奖励/买这个心愿]时调用。扣萤火 + 自动达成心愿。需要用户确认。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "wish_id": {
                        "type": "string",
                        "description": "要兑换的心愿ID，从list_wishes结果中获取"
                    },
                    "query": {
                        "type": "string",
                        "description": "心愿名称关键词，用于搜索要兑换的心愿。如果已知wish_id则不需要"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn list_draws_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "list_draws".to_string(),
            description: "查看抽奖记录。当用户问[抽奖记录/抽过什么/中过什么奖/抽奖历史]时调用。返回最近20条抽奖记录（中奖/未中）。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "limit": {
                        "type": "integer",
                        "description": "返回记录数，默认20，最大50"
                    }
                }),
                required: vec![],
            },
        },
    }
}

fn list_glow_ledger_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "list_glow_ledger".to_string(),
            description: "查看萤火收支明细（账本）。当用户问[萤火明细/收支记录/萤火怎么来的/萤火花哪了/奖券怎么来的]时调用。可按资产类型筛选。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "asset_type": {
                        "type": "string",
                        "enum": ["glow", "micro_ticket", "shimmer_ticket"],
                        "description": "按资产类型筛选：glow=萤火，micro_ticket=微光券，shimmer_ticket=拾光券。不填则查全部"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回记录数，默认30，最大100"
                    }
                }),
                required: vec![],
            },
        },
    }
}
