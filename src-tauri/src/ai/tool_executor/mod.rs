use std::path::Path;

use rusqlite::Connection;

pub mod shared;
pub mod date_utils;

mod task;
mod schedule;
mod journal;
mod contact;
mod skill;
mod memory;
mod habit;
mod glow;
mod pomodoro;
mod guide;
pub mod aihot;

/// 判断工具是否需要在 async 上下文中处理（如需要 HTTP 请求的工具）
/// 这些工具不能在同步的 execute_tool 中执行，需要在 async 调用方特殊处理
pub fn is_async_tool(name: &str) -> bool {
    matches!(name, "search_ai_news")
}

/// 执行不需要数据库连接的同步工具
pub fn execute_tool_without_conn(name: &str, arguments: &str) -> Result<String, String> {
    match name {
        _ => Err(format!("工具 {} 不是无连接工具", name)),
    }
}

/// 判断工具是否需要数据库连接
pub fn needs_conn(name: &str) -> bool {
    !matches!(name, "search_ai_news")
}

/// 根据工具名和参数执行对应的数据库操作，返回结果描述文本
/// `app_data_dir` 仅日记工具需要，其他工具可传 None
/// 注意：search_ai_news 等 async 工具不在此函数中处理
pub fn execute_tool(
    conn: &mut Connection,
    app_data_dir: Option<&Path>,
    name: &str,
    arguments: &str,
) -> Result<String, String> {
    match name {
        // 任务 (5)
        "create_task" => task::execute_create_task(conn, arguments),
        "complete_task" => task::execute_complete_task(conn, arguments),
        "delete_task" => task::execute_delete_task(conn, arguments),
        "search_tasks" => task::execute_search_tasks(conn, arguments),
        "update_task" => task::execute_update_task(conn, arguments),
        // 日程 (5)
        "create_schedule" => schedule::execute_create_schedule(conn, arguments),
        "list_schedules_in_range" => schedule::execute_list_schedules(conn, arguments),
        "list_calendars" => schedule::execute_list_calendars(conn),
        "update_schedule" => schedule::execute_update_schedule(conn, arguments),
        "delete_schedule" => schedule::execute_delete_schedule(conn, arguments),
        // 日记 (5)
        "get_journal_by_date" => journal::execute_get_journal(conn, app_data_dir, arguments),
        "save_journal" => journal::execute_save_journal(conn, app_data_dir, arguments),
        "get_timeline" => journal::execute_get_timeline(conn, arguments),
        "settle_diary" => journal::execute_settle_diary(conn, arguments),
        "search_journals" => journal::execute_search_journals(conn, app_data_dir, arguments),
        // 人脉 (5)
        "create_contact" => contact::execute_create_contact(conn, arguments),
        "search_contacts" => contact::execute_search_contacts(conn, arguments),
        "list_contacts" => contact::execute_list_contacts(conn, arguments),
        "update_contact" => contact::execute_update_contact(conn, arguments),
        "delete_contact" => contact::execute_delete_contact(conn, arguments),
        // 技能 (2)
        "list_skills" => skill::execute_list_skills(conn, arguments),
        "get_task_skills" => skill::execute_get_task_skills(conn, arguments),
        // 工具
        "resolve_date" => guide::execute_resolve_date(arguments),
        // 记忆 (3)
        "record_memory" => memory::execute_record_memory(conn, arguments),
        "search_memories" => memory::execute_search_memories(conn, arguments),
        "delete_memory" => memory::execute_delete_memory(conn, arguments),
        // 倒数日 (1)
        "list_countdowns" => schedule::execute_list_countdowns(conn),
        // 习惯 (6)
        "list_habits" => habit::execute_list_habits(conn),
        "create_habit" => habit::execute_create_habit(conn, arguments),
        "update_habit" => habit::execute_update_habit(conn, arguments),
        "delete_habit" => habit::execute_delete_habit(conn, arguments),
        "check_habit" => habit::execute_check_habit(conn, arguments),
        "uncheck_habit" => habit::execute_uncheck_habit(conn, arguments),
        // 指南
        "get_guide" => guide::execute_get_guide(arguments),
        // 萤火 (10)
        "reward_glow" => glow::execute_reward_glow(conn, arguments),
        "get_glow_balance" => glow::execute_get_glow_balance(conn),
        "list_wishes" => glow::execute_list_wishes(conn, arguments),
        "create_wish" => glow::execute_create_wish(conn, arguments),
        "update_wish" => glow::execute_update_wish(conn, arguments),
        "delete_wish" => glow::execute_delete_wish(conn, arguments),
        "buy_tickets" => glow::execute_buy_tickets(conn, arguments),
        "draw_wish" => glow::execute_draw_wish(conn, arguments),
        "redeem_wish" => glow::execute_redeem_wish(conn, arguments),
        "list_draws" => glow::execute_list_draws(conn, arguments),
        "list_glow_ledger" => glow::execute_list_glow_ledger(conn, arguments),
        // 专注 (2)
        "start_pomodoro" => pomodoro::execute_start_pomodoro(conn, arguments),
        "get_pomodoro_stats" => pomodoro::execute_get_pomodoro_stats(conn),
        // AI 资讯 — 由 async 调用方通过 spawn_blocking 处理，不在此执行
        "search_ai_news" => Err("search_ai_news 应由 async 上下文处理".to_string()),
        _ => Err(format!("未知工具: {}", name)),
    }
}
