use serde::Serialize;
use serde_json::Value;

pub mod tool_defs;

// Re-export for external callers (journal_commands.rs)
pub use tool_defs::journal::settle_diary_definition;

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

/// 检查插件是否启用（默认启用）
pub fn is_plugin_enabled(conn: &rusqlite::Connection, plugin_id: &str) -> bool {
    crate::db::repositories::setting_repo::get_setting(conn, &format!("plugin.{}.enabled", plugin_id))
        .ok()
        .flatten()
        .map(|s| s.value != "false")
        .unwrap_or(true) // 默认启用
}

/// 返回所有可用工具的定义（OpenAI Function Calling 格式）
///
/// 根据插件开关动态过滤工具，禁用的插件不会注册其工具。
pub fn get_tools(conn: &rusqlite::Connection) -> Vec<ToolDefinition> {
    let mut tools = Vec::new();
    tools.extend(tool_defs::task_definitions());
    tools.extend(tool_defs::schedule_definitions());
    tools.extend(tool_defs::journal_definitions());
    tools.extend(tool_defs::contact_definitions());
    tools.extend(tool_defs::skill_definitions());
    tools.extend(tool_defs::guide_definitions());
    tools.extend(tool_defs::memory_definitions());
    tools.extend(tool_defs::habit_definitions());
    tools.extend(tool_defs::glow_definitions());
    tools.extend(tool_defs::pomodoro_definitions());
    if is_plugin_enabled(conn, "aihot") {
        tools.extend(tool_defs::aihot_definitions());
    }
    tools
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
            | "search_ai_news"
    )
}
