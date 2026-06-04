use serde::Serialize;
use serde_json::Value;

// ========== 工具定义结构 ==========

#[derive(Debug, Serialize, Clone)]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: FunctionDef,
}

#[derive(Debug, Serialize, Clone)]
pub struct FunctionDef {
    pub name: String,
    pub description: String,
    pub parameters: ToolParameters,
}

#[derive(Debug, Serialize, Clone)]
pub struct ToolParameters {
    #[serde(rename = "type")]
    pub param_type: String,
    pub properties: Value,
    pub required: Vec<String>,
}

// ========== AI 返回的 tool_calls 结构 ==========

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: FunctionCall,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
pub struct FunctionCall {
    pub name: String,
    /// JSON 字符串，需要二次解析
    pub arguments: String,
}

// ========== 工具清单 ==========

/// 返回所有可用工具的定义（OpenAI Function Calling 格式）
pub fn get_tools() -> Vec<ToolDefinition> {
    vec![
        // ── 任务 (5) ──
        create_task_definition(),
        complete_task_definition(),
        delete_task_definition(),
        search_tasks_definition(),
        update_task_definition(),
        // ── 日程 (5) ──
        create_schedule_definition(),
        list_schedules_in_range_definition(),
        list_calendars_definition(),
        update_schedule_definition(),
        delete_schedule_definition(),
        // ── 日记 (5) ──
        get_journal_by_date_definition(),
        save_journal_definition(),
        get_timeline_definition(),
        settle_diary_definition(),
        search_journals_definition(),
        // ── 人脉 (5) ──
        create_contact_definition(),
        search_contacts_definition(),
        list_contacts_definition(),
        update_contact_definition(),
        delete_contact_definition(),
        // ── 技能 (2) ──
        list_skills_definition(),
        get_task_skills_definition(),
        // ── 工具 (1) ──
        resolve_date_definition(),
        // ── 记忆 (3) ──
        record_memory_definition(),
        search_memories_definition(),
        delete_memory_definition(),
        // ── 倒数日 (1) ──
        list_countdowns_definition(),
        // ── 习惯 (6) ──
        list_habits_definition(),
        create_habit_definition(),
        update_habit_definition(),
        delete_habit_definition(),
        check_habit_definition(),
        uncheck_habit_definition(),
        // ── 指南 (1) ──
        get_guide_definition(),
        // ── 萤火 (10) ──
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
        // ── 专注 (2) ──
        start_pomodoro_definition(),
        get_pomodoro_stats_definition(),
    ]
}

/// 只读查询工具 — 这些工具不需要用户确认，自动执行
pub fn is_query_tool(name: &str) -> bool {
    matches!(
        name,
        "search_tasks"
            | "search_contacts"
            | "list_contacts"
            | "list_schedules_in_range"
            | "list_calendars"
            | "get_journal_by_date"
            | "get_timeline"
            | "list_skills"
            | "get_task_skills"
            | "resolve_date"
            | "search_memories"
            | "search_journals"
            | "list_countdowns"
            | "list_habits"
            | "get_guide"
            | "get_glow_balance"
            | "list_wishes"
            | "list_draws"
            | "list_glow_ledger"
            | "get_pomodoro_stats"
    )
}

// ====================================================================
// 任务工具
// ====================================================================

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

// ====================================================================
// 日程工具
// ====================================================================

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

// ====================================================================
// 日记工具
// ====================================================================

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

// ====================================================================
// 人脉工具
// ====================================================================

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

// ====================================================================
// 技能工具
// ====================================================================

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

fn resolve_date_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "resolve_date".to_string(),
            description: "将中文相对日期表达式解析为精确的YYYY-MM-DD日期。当用户提到[明天/后天/下周三/月底/周末/3天后]等相对时间时，先调用此工具获取准确日期，再传给其他工具。也支持[5月3号/12月20号]等具体日期确认。".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "expression": {
                        "type": "string",
                        "description": "中文日期表达式，如：明天、后天、下周三、月底、周末、3天后、这周五、5月3号、下个月15号"
                    }
                }),
                required: vec!["expression".to_string()],
            },
        },
    }
}

// ====================================================================
// 记忆工具
// ====================================================================

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

// ====================================================================
// 倒数日工具
// ====================================================================

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

// ====================================================================
// 习惯工具
// ====================================================================

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

fn get_guide_definition() -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDef {
            name: "get_guide".to_string(),
            description: "查阅某个模块的详细使用指南。当你不确定某个模块的用法、规则或最佳实践时调用。可选模块：任务、日程、日记、人脉、习惯、技能、小本本、XP、概览".to_string(),
            parameters: ToolParameters {
                param_type: "object".to_string(),
                properties: serde_json::json!({
                    "module": {
                        "type": "string",
                        "enum": ["任务", "日程", "日记", "人脉", "习惯", "技能", "小本本", "XP", "萤火", "专注", "概览"],
                        "description": "要查阅的模块名"
                    }
                }),
                required: vec!["module".to_string()],
            },
        },
    }
}

// ====================================================================
// 萤火工具
// ====================================================================

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

// ====================================================================
// 专注工具 (Pomodoro)
// ====================================================================

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

// ====================================================================
// 习惯工具（扩展）
// ====================================================================

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

// ====================================================================
// 心愿系统工具（扩展）
// ====================================================================

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
