use std::path::Path;

use chrono::{Datelike, Duration, Local, NaiveDate, Weekday};
use rusqlite::Connection;
use serde::Deserialize;

use crate::db::repositories::{calendar_repo, contact_repo, habit_repo, journal_repo, memory_repo, schedule_repo, skill_repo, task_repo};
use crate::db::repositories::contact_repo::ContactMethodInput;
use crate::db::repositories::task_repo::Task;

// ========== 工具参数解析 ==========

#[derive(Debug, Deserialize)]
struct XpAllocation {
    skill_id: String,
    xp_amount: i32,
}

/// skill_id → 中文名（静态映射，6个默认技能）
fn skill_name_by_id(skill_id: &str) -> &'static str {
    match skill_id {
        "knowledge" => "学识",
        "physique" => "筋骨",
        "charm" => "风华",
        "talent" => "才情",
        "worldliness" => "入世",
        "cultivation" => "修为",
        _ => "未知",
    }
}

#[derive(Debug, Deserialize)]
struct ToolCreateTaskArgs {
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    priority: Option<String>,
    #[serde(default)]
    scheduled_at: Option<String>,
    #[serde(default)]
    deadline: Option<String>,
    #[serde(default)]
    estimated_minutes: Option<i32>,
    #[serde(default)]
    tags: Option<String>,
    #[serde(default)]
    xp_allocations: Option<Vec<XpAllocation>>,
}

#[derive(Debug, Deserialize)]
struct ToolQueryArgs {
    query: String,
}

#[derive(Debug, Deserialize)]
struct ToolQueryOrIdArgs {
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    priority: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolSearchArgs {
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    status: Option<String>,
}

// ── 日程参数 ──

#[derive(Debug, Deserialize)]
struct ToolCreateScheduleArgs {
    title: String,
    start_at: String,
    #[serde(default)]
    end_at: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    is_all_day: Option<bool>,
    #[serde(default)]
    location: Option<String>,
    #[serde(default)]
    category: Option<String>,
    #[serde(default)]
    calendar_id: Option<String>,
    #[serde(default)]
    rrule: Option<String>,
    #[serde(default)]
    reminder: Option<String>,
    #[serde(default)]
    event_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolRangeArgs {
    start_date: String,
    end_date: String,
}

#[derive(Debug, Deserialize)]
struct ToolUpdateScheduleArgs {
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    start_at: Option<String>,
    #[serde(default)]
    end_at: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    location: Option<String>,
    #[serde(default)]
    category: Option<String>,
    #[serde(default)]
    calendar_id: Option<String>,
    #[serde(default)]
    is_all_day: Option<bool>,
}

// ── 日记参数 ──

#[derive(Debug, Deserialize)]
struct ToolDateArgs {
    date: String,
}

#[derive(Debug, Deserialize)]
struct ToolSaveJournalArgs {
    date: String,
    content: String,
    #[serde(default)]
    mood: Option<String>,
    #[serde(default)]
    tags: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolTimelineArgs {
    year: i32,
    month: i32,
}

// ── 人脉参数 ──

#[derive(Debug, Deserialize)]
struct ToolContactMethod {
    method_type: String,
    value: String,
}

#[derive(Debug, Deserialize)]
struct ToolCreateContactArgs {
    name: String,
    #[serde(default)]
    nickname: Option<String>,
    #[serde(default)]
    group_name: Option<String>,
    #[serde(default)]
    birthday_calendar: Option<String>,
    #[serde(default)]
    birthday_year: Option<i32>,
    #[serde(default)]
    birthday_month: Option<i32>,
    #[serde(default)]
    birthday_day: Option<i32>,
    #[serde(default)]
    contact_methods: Option<Vec<ToolContactMethod>>,
    #[serde(default)]
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolUpdateContactArgs {
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    nickname: Option<String>,
    #[serde(default)]
    group_name: Option<String>,
    #[serde(default)]
    birthday_calendar: Option<String>,
    #[serde(default)]
    birthday_year: Option<i32>,
    #[serde(default)]
    birthday_month: Option<i32>,
    #[serde(default)]
    birthday_day: Option<i32>,
    #[serde(default)]
    contact_methods: Option<Vec<ToolContactMethod>>,
    #[serde(default)]
    notes: Option<String>,
}

// ── 任务更新参数 ──

#[derive(Debug, Deserialize)]
struct ToolUpdateTaskArgs {
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    priority: Option<String>,
    #[serde(default)]
    scheduled_at: Option<String>,
    #[serde(default)]
    deadline: Option<String>,
    #[serde(default)]
    estimated_minutes: Option<i32>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    tags: Option<String>,
}

// ── 习惯参数 ──

#[derive(Debug, Deserialize)]
struct ToolCreateHabitArgs {
    name: String,
    #[serde(default)]
    frequency_type: Option<String>,
    #[serde(default)]
    icon: Option<String>,
    #[serde(default)]
    color: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolCheckHabitArgs {
    #[serde(default)]
    habit_id: Option<String>,
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    date: Option<String>,
    #[serde(default)]
    note: Option<String>,
}

// ========== 工具调度 ==========

/// 根据工具名和参数执行对应的数据库操作，返回结果描述文本
/// `app_data_dir` 仅日记工具需要，其他工具可传 None
pub fn execute_tool(
    conn: &mut Connection,
    app_data_dir: Option<&Path>,
    name: &str,
    arguments: &str,
) -> Result<String, String> {
    match name {
        // 任务 (5)
        "create_task" => execute_create_task(conn, arguments),
        "complete_task" => execute_complete_task(conn, arguments),
        "delete_task" => execute_delete_task(conn, arguments),
        "search_tasks" => execute_search_tasks(conn, arguments),
        "update_task" => execute_update_task(conn, arguments),
        // 日程 (4)
        "create_schedule" => execute_create_schedule(conn, arguments),
        "list_schedules_in_range" => execute_list_schedules(conn, arguments),
        "list_calendars" => execute_list_calendars(conn),
        "update_schedule" => execute_update_schedule(conn, arguments),
        "delete_schedule" => execute_delete_schedule(conn, arguments),
        // 日记 (4)
        "get_journal_by_date" => execute_get_journal(conn, app_data_dir, arguments),
        "save_journal" => execute_save_journal(conn, app_data_dir, arguments),
        "get_timeline" => execute_get_timeline(conn, arguments),
        "settle_diary" => execute_settle_diary(conn, arguments),
        // 人脉 (5)
        "create_contact" => execute_create_contact(conn, arguments),
        "search_contacts" => execute_search_contacts(conn, arguments),
        "list_contacts" => execute_list_contacts(conn, arguments),
        "update_contact" => execute_update_contact(conn, arguments),
        "delete_contact" => execute_delete_contact(conn, arguments),
        // 技能 (2)
        "list_skills" => execute_list_skills(conn, arguments),
        "get_task_skills" => execute_get_task_skills(conn, arguments),
        // 工具
        "resolve_date" => execute_resolve_date(arguments),
        // 记忆 (2)
        "record_memory" => execute_record_memory(conn, arguments),
        "search_memories" => execute_search_memories(conn, arguments),
        "delete_memory" => execute_delete_memory(conn, arguments),
        // 倒数日 (1)
        "list_countdowns" => execute_list_countdowns(conn),
        // 习惯 (4)
        "list_habits" => execute_list_habits(conn),
        "create_habit" => execute_create_habit(conn, arguments),
        "check_habit" => execute_check_habit(conn, arguments),
        "uncheck_habit" => execute_uncheck_habit(conn, arguments),
        _ => Err(format!("未知工具: {}", name)),
    }
}

// ========== 具体工具实现 ==========

fn execute_create_task(conn: &mut Connection, arguments: &str) -> Result<String, String> {
    let args: ToolCreateTaskArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("create_task 参数解析失败: {}", e))?;

    let task = task_repo::create_task(
        conn,
        &args.title,
        None,
        args.description.as_deref(),
        args.priority.as_deref(),
        args.scheduled_at.as_deref(),
        args.deadline.as_deref(),
        args.estimated_minutes.unwrap_or(0),
        args.tags.as_deref(),
    )?;

    // 如果 AI 传了 XP 分配，写入 task_skills 并显示在结果中
    let xp_line = if let Some(ref allocs) = args.xp_allocations {
        let pairs: Vec<(String, i32)> = allocs
            .iter()
            .map(|a| (a.skill_id.clone(), a.xp_amount))
            .collect();
        skill_repo::set_task_skills(conn, &task.id, &pairs)?;
        let total: i32 = pairs.iter().map(|(_, xp)| xp).sum();
        let parts: Vec<String> = pairs
            .iter()
            .map(|(sid, xp)| format!("{}+{}", skill_name_by_id(sid), xp))
            .collect();
        format!(" | XP: {}（{}）", total, parts.join(" "))
    } else {
        String::new()
    };

    let mut result = format!("任务已创建：{}{}", task.title, xp_line);
    if let Some(ref deadline) = task.deadline {
        result.push_str(&format!("，截止时间：{}", deadline));
    }
    if let Some(ref priority) = task.priority {
        let label = match priority.as_str() {
            "high" => "紧急",
            "medium" => "重要",
            "low" => "一般",
            _ => priority,
        };
        result.push_str(&format!("，优先级：{}", label));
    }

    Ok(result)
}

// ========== 分词加权搜索 ==========

/// 调用 task_repo::search_tasks_scored，并额外按状态过滤
fn scored_search(
    conn: &Connection,
    query: &str,
    status_filter: Option<&str>,
    priority_filter: Option<&str>,
    allowed_statuses: &[&str],
) -> Result<Vec<(Task, i32)>, String> {
    let scored = task_repo::search_tasks_scored(conn, query, status_filter, priority_filter)?;

    if allowed_statuses.is_empty() {
        Ok(scored)
    } else {
        Ok(scored
            .into_iter()
            .filter(|(t, _)| allowed_statuses.contains(&t.status.as_str()))
            .collect())
    }
}

// ========== 智能匹配逻辑 ==========

/// 匹配结果处理策略
enum MatchResult {
    /// 0 条匹配
    None,
    /// 唯一高置信度匹配（只有1条，或第1名分数远超第2名）
    Unique(usize),
    /// 多条接近（2-5条），让用户选
    Ambiguous,
    /// 太多匹配（>5条），需要更具体
    TooMany(usize),
}

fn classify_matches(scored: &[(Task, i32)]) -> MatchResult {
    let n = scored.len();
    match n {
        0 => MatchResult::None,
        1 => MatchResult::Unique(0),
        2..=5 => {
            // 如果第一名分数 ≥ 第二名×2，视为唯一匹配
            if scored[0].1 >= scored[1].1 * 2 && scored[0].1 > 0 {
                MatchResult::Unique(0)
            } else {
                MatchResult::Ambiguous
            }
        }
        _ => {
            // >5条：检查第一名是否明显胜出
            if scored[0].1 >= scored[1].1 * 2 && scored[0].1 > 0 {
                MatchResult::Unique(0)
            } else {
                MatchResult::TooMany(n)
            }
        }
    }
}

fn format_task_for_ai(task: &Task, index: usize) -> String {
    let status_label = match task.status.as_str() {
        "pending" => "[待办]",
        "in_progress" => "[进行中]",
        "completed" => "[已完成]",
        "cancelled" => "[已取消]",
        _ => "[未知]",
    };
    let mut s = format!("{}. {} {} (ID: {})", index + 1, status_label, task.title, task.id);
    if let Some(ref p) = task.priority {
        if p != "none" {
            s.push_str(&format!(" [{}]", status_cn(p)));
        }
    }
    if let Some(ref d) = task.deadline {
        s.push_str(&format!(" 截止:{}", d));
    }
    s
}

// ========== 完成任务 ==========

fn execute_complete_task(conn: &mut Connection, arguments: &str) -> Result<String, String> {
    #[derive(Debug, Deserialize)]
    struct CompleteTaskArgs {
        #[serde(default)]
        query: Option<String>,
        #[serde(default)]
        id: Option<String>,
        #[serde(default)]
        status: Option<String>,
        #[serde(default)]
        priority: Option<String>,
        #[serde(default)]
        xp_allocations: Option<Vec<XpAllocation>>,
    }

    let args: CompleteTaskArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("complete_task 参数解析失败: {}", e))?;

    // 如果有 id，直接精确完成
    if let Some(ref id) = args.id {
        if !id.is_empty() {
            let task = task_repo::get_task(conn, id)?;
            let title = task.title.clone();

            // 如果 AI 传了 XP 分配，先写入 task_skills
            if let Some(ref allocs) = args.xp_allocations {
                let pairs: Vec<(String, i32)> = allocs
                    .iter()
                    .map(|a| (a.skill_id.clone(), a.xp_amount))
                    .collect();
                skill_repo::set_task_skills(conn, id, &pairs)?;
            }

            let result = task_repo::complete_task(conn, id)?;
            let xp_line = format_xp_result(&result);
            return Ok(format!("任务已完成：{}{}", title, xp_line));
        }
    }

    let query = args.query.as_deref().unwrap_or("");
    if query.is_empty() {
        return Err("请提供 id 或 query 来指定要完成的任务".to_string());
    }

    // 默认只搜未完成任务
    let allowed = &["pending", "in_progress"];
    let scored = scored_search(
        conn,
        query,
        args.status.as_deref(),
        args.priority.as_deref(),
        allowed,
    )?;

    match classify_matches(&scored) {
        MatchResult::None => {
            // 检查是不是所有任务都已经完成了
            let all_scored = task_repo::search_tasks_scored(
                conn,
                query,
                None,
                args.priority.as_deref(),
            )?;
            let completed: Vec<_> = all_scored
                .iter()
                .filter(|(t, _)| t.status == "completed")
                .collect();
            if !completed.is_empty() {
                let names: Vec<String> = completed
                    .iter()
                    .map(|(t, _)| format!("[已完成]{}", t.title))
                    .collect();
                return Err(format!(
                    "没有找到未完成的任务匹配[{}]。但找到了这些已完成的任务：{}。是不是已经做完了？",
                    query,
                    names.join("、")
                ));
            }
            Err(format!(
                "没有找到匹配[{}]的未完成任务。试试换个关键词？比如用任务名里的其他词。",
                query
            ))
        }

        MatchResult::Unique(idx) => {
            let task = &scored[idx].0;

            // 如果 AI 传了 XP 分配，先写入 task_skills
            if let Some(ref allocs) = args.xp_allocations {
                let pairs: Vec<(String, i32)> = allocs
                    .iter()
                    .map(|a| (a.skill_id.clone(), a.xp_amount))
                    .collect();
                skill_repo::set_task_skills(conn, &task.id, &pairs)?;
            }

            let result = task_repo::complete_task(conn, &task.id)?;
            let xp_line = format_xp_result(&result);
            Ok(format!("任务已完成：{}{}", task.title, xp_line))
        }

        MatchResult::Ambiguous => {
            let mut result = format!(
                "找到{}个匹配[{}]的未完成任务，请告诉用户具体要完成哪一个，然后用对应的 id 重新调用 complete_task：\n\n",
                scored.len(),
                query
            );
            for (i, (task, _score)) in scored.iter().enumerate() {
                result.push_str(&format!("{}\n", format_task_for_ai(task, i)));
            }
            Err(result)
        }

        MatchResult::TooMany(n) => {
            // 展示前5条
            let mut result = format!(
                "找到{}个匹配[{}]的任务，太多了。最匹配的几条：\n\n",
                n, query
            );
            for (i, (task, _)) in scored.iter().take(5).enumerate() {
                result.push_str(&format!("{}\n", format_task_for_ai(task, i)));
            }
            result.push_str("\n请让用户提供更具体的关键词（如加空格多写几个词），然后用 id 精确完成。");
            Err(result)
        }
    }
}

// ========== 删除任务 ==========

fn execute_delete_task(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolQueryOrIdArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("delete_task 参数解析失败: {}", e))?;

    // 如果有 id，直接精确删除
    if let Some(ref id) = args.id {
        if !id.is_empty() {
            let task = task_repo::get_task(conn, id)?;
            let title = task.title.clone();
            task_repo::delete_task(conn, id, false)?;
            return Ok(format!("任务已删除：{}", title));
        }
    }

    let query = args.query.as_deref().unwrap_or("");
    if query.is_empty() {
        return Err("请提供 id 或 query 来指定要删除的任务".to_string());
    }

    // 删除不限制状态，所有状态都可以删
    let scored = scored_search(
        conn,
        query,
        args.status.as_deref(),
        args.priority.as_deref(),
        &[],
    )?;

    match classify_matches(&scored) {
        MatchResult::None => {
            Err(format!(
                "没有找到匹配[{}]的任务。试试换个关键词？",
                query
            ))
        }

        MatchResult::Unique(idx) => {
            let task = &scored[idx].0;
            let title = task.title.clone();
            task_repo::delete_task(conn, &task.id, false)?;
            Ok(format!("任务已删除：{}", title))
        }

        MatchResult::Ambiguous => {
            let mut result = format!(
                "找到{}个匹配[{}]的任务，请告诉用户具体要删哪一个，然后用对应的 id 重新调用 delete_task：\n\n",
                scored.len(),
                query
            );
            for (i, (task, _)) in scored.iter().enumerate() {
                result.push_str(&format!("{}\n", format_task_for_ai(task, i)));
            }
            Err(result)
        }

        MatchResult::TooMany(n) => {
            let mut result = format!(
                "找到{}个匹配[{}]的任务，太多了。最匹配的几条：\n\n",
                n, query
            );
            for (i, (task, _)) in scored.iter().take(5).enumerate() {
                result.push_str(&format!("{}\n", format_task_for_ai(task, i)));
            }
            result.push_str("\n请让用户提供更具体的关键词，然后用 id 精确删除。");
            Err(result)
        }
    }
}

// ========== 搜索/列出任务 ==========

fn execute_search_tasks(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolSearchArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("search_tasks 参数解析失败: {}", e))?;

    // 查询任务
    let all_tasks: Vec<Task> = match &args.query {
        Some(q) if !q.trim().is_empty() => {
            // 使用加权搜索
            let scored = task_repo::search_tasks_scored(conn, q, None, None)?;
            scored.into_iter().map(|(t, _)| t).collect()
        }
        _ => {
            // 没有搜索词 → 列出所有任务
            task_repo::list_tasks(conn, None, None)?
        }
    };

    // 按状态筛选
    let tasks: Vec<&Task> = match &args.status {
        Some(s) if !s.is_empty() => all_tasks.iter().filter(|t| t.status == *s).collect(),
        _ => all_tasks.iter().collect(),
    };

    if tasks.is_empty() {
        let hint = match (&args.query, &args.status) {
            (Some(q), Some(s)) => {
                format!("没有找到匹配[{}]且状态为[{}]的任务", q, status_cn(s))
            }
            (Some(q), _) => format!("没有找到匹配[{}]的任务", q),
            (_, Some(s)) => format!("没有[{}]状态的任务", status_cn(s)),
            _ => "目前还没有任何任务。试试说「帮我记一下…」来创建第一个任务吧！".to_string(),
        };
        return Ok(hint);
    }

    // 格式化输出：按状态排序
    let mut result = String::new();
    result.push_str(&format!("找到{}个任务：\n\n", tasks.len()));

    // 按状态排序：pending > in_progress > completed > cancelled
    let status_order = |s: &str| match s {
        "pending" => 0,
        "in_progress" => 1,
        "completed" => 2,
        "cancelled" => 3,
        _ => 4,
    };
    let mut sorted: Vec<&&Task> = tasks.iter().collect();
    sorted.sort_by_key(|t| (status_order(&t.status), t.title.clone()));

    for task in sorted {
        let status_badge = match task.status.as_str() {
            "pending" => "⬜",
            "in_progress" => "🔄",
            "completed" => "✅",
            "cancelled" => "❌",
            _ => "❓",
        };

        result.push_str(&format!("{} **{}**", status_badge, task.title));

        // 优先级
        if let Some(ref p) = task.priority {
            if p != "none" {
                result.push_str(&format!(" `{}`", status_cn(p)));
            }
        }

        // 截止时间
        if let Some(ref d) = task.deadline {
            result.push_str(&format!("，截止：{}", d));
        }

        result.push('\n');
    }

    result.push_str("\n提示：你可以对这些任务进行操作，比如「完成xxx」或「删掉xxx」。");
    Ok(result)
}

// ========== 更新任务 ==========

fn execute_update_task(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolUpdateTaskArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("update_task 参数解析失败: {}", e))?;

    let task_id: String;

    if let Some(ref id) = args.id {
        if !id.is_empty() {
            task_id = id.clone();
        } else {
            return Err("id 不能为空".to_string());
        }
    } else if let Some(ref query) = args.query {
        if query.is_empty() {
            return Err("请提供 query 或 id".to_string());
        }
        let scored = scored_search(conn, query, None, None, &[])?;
        match classify_matches(&scored) {
            MatchResult::None => return Err(format!("没有找到匹配[{}]的任务", query)),
            MatchResult::Unique(idx) => task_id = scored[idx].0.id.clone(),
            _ => {
                let mut result = format!("找到{}个匹配的任务：\n\n", scored.len());
                for (i, (task, _)) in scored.iter().take(5).enumerate() {
                    result.push_str(&format!("{}\n", format_task_for_ai(task, i)));
                }
                result.push_str("\n请让用户选择后，用对应的 id 重新调用 update_task。");
                return Err(result);
            }
        }
    } else {
        return Err("请提供 query 或 id 来指定要修改的任务".to_string());
    }

    let updated = task_repo::update_task(
        conn, &task_id,
        args.title.as_deref(),
        args.description.as_deref(),
        None,
        args.priority.as_deref(),
        args.scheduled_at.as_deref(),
        args.deadline.as_deref(),
        args.estimated_minutes,
        args.notes.as_deref(),
        args.tags.as_deref(),
    )?;

    Ok(format!("任务已更新：{}", updated.title))
}

// ========== 创建日程 ==========

fn execute_create_schedule(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolCreateScheduleArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("create_schedule 参数解析失败: {}", e))?;

    let schedule = schedule_repo::create_schedule(
        conn, &args.title,
        args.description.as_deref(),
        &args.start_at,
        args.end_at.as_deref(),
        args.rrule.as_deref(),
        args.reminder.as_deref(),
        None,
        if args.is_all_day.unwrap_or(false) { 1 } else { 0 },
        args.location.as_deref(),
        "manual",
        None,
        args.category.as_deref(),
        args.calendar_id.as_deref(),
        args.event_type.as_deref().unwrap_or("event"),
    )?;

    let mut result = format!("日程已创建：{}", schedule.title);
    result.push_str(&format!("，开始时间：{}", schedule.start_at));
    if let Some(ref cal_id) = schedule.calendar_id {
        if let Ok(cal) = calendar_repo::get_calendar(conn, cal_id) {
            result.push_str(&format!("，日历：{}", cal.name));
        }
    }
    if let Some(ref loc) = schedule.location {
        result.push_str(&format!("，地点：{}", loc));
    }
    if let Some(ref rrule) = schedule.rrule {
        result.push_str(&format!("，重复：{}", rrule_to_human(rrule)));
    }
    if let Some(ref reminder) = schedule.reminder {
        if let Ok(mins) = reminder.parse::<i64>() {
            let label = if mins >= 1440 {
                format!("{}天前", mins / 1440)
            } else if mins >= 60 {
                format!("{}小时前", mins / 60)
            } else {
                format!("{}分钟前", mins)
            };
            result.push_str(&format!("，提醒：{}", label));
        }
    }
    Ok(result)
}

/// 将 RRULE 转换为人类可读的中文描述
fn rrule_to_human(rrule: &str) -> String {
    let rules: std::collections::HashMap<&str, &str> = rrule
        .split(';')
        .filter_map(|part| {
            let mut split = part.splitn(2, '=');
            Some((split.next()?, split.next()?))
        })
        .collect();

    let freq = rules.get("FREQ").copied().unwrap_or("");
    let interval: u32 = rules.get("INTERVAL")
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);

    let freq_cn = match freq {
        "DAILY" => {
            if interval > 1 { format!("每{}天", interval) } else { "每天".to_string() }
        }
        "WEEKLY" => {
            if interval > 1 { format!("每{}周", interval) } else { "每周".to_string() }
        }
        "MONTHLY" => {
            if interval > 1 { format!("每{}月", interval) } else { "每月".to_string() }
        }
        _ => freq.to_string(),
    };

    let mut desc = freq_cn;

    if let Some(byday) = rules.get("BYDAY") {
        let days_cn: Vec<String> = byday.split(',').map(|d| {
            match d.trim() {
                "MO" => "一".to_string(), "TU" => "二".to_string(), "WE" => "三".to_string(),
                "TH" => "四".to_string(), "FR" => "五".to_string(), "SA" => "六".to_string(), "SU" => "日".to_string(),
                other => other.to_string(),
            }
        }).collect();
        desc.push_str(&format!(" 周{}", days_cn.join("、")));
    }

    if let Some(until) = rules.get("UNTIL") {
        desc.push_str(&format!("，截止 {}", until));
    }
    if let Some(count) = rules.get("COUNT") {
        desc.push_str(&format!("，共{}次", count));
    }

    desc
}

// ========== 查看日程 ==========

fn execute_list_schedules(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolRangeArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("list_schedules_in_range 参数解析失败: {}", e))?;

    let schedules = schedule_repo::list_schedules_in_range(conn, &args.start_date, &args.end_date)?;

    if schedules.is_empty() {
        return Ok(format!("{} 到 {} 之间没有日程安排。", args.start_date, args.end_date));
    }

    let mut result = format!("{} 到 {} 共有{}个日程：\n\n", args.start_date, args.end_date, schedules.len());
    // 预加载日历名称 lookup
    let calendars = calendar_repo::list_calendars(conn).unwrap_or_default();
    let cal_name_by_id: std::collections::HashMap<&str, &str> = calendars
        .iter()
        .map(|c| (c.id.as_str(), c.name.as_str()))
        .collect();
    for s in &schedules {
        let cat = s.calendar_id.as_deref()
            .and_then(|id| cal_name_by_id.get(id))
            .copied()
            .unwrap_or("未分类");
        let loc = s.location.as_deref().unwrap_or("");
        let loc_str = if loc.is_empty() { String::new() } else { format!("，地点：{}", loc) };
        // 对展开实例，提取基础 ID（去掉 _{date} 后缀），方便 AI 后续操作
        let display_id = extract_base_id(&s.id);
        result.push_str(&format!("- **{}** ({})，{}", s.title, cat, s.start_at));
        if let Some(ref end) = s.end_at {
            result.push_str(&format!(" -> {}", end));
        }
        result.push_str(&format!("{}{}  (id: `{}`)\n", loc_str, if s.is_all_day == 1 { " [全天]" } else { "" }, display_id));
    }
    result.push_str("\n提示：你可以说[查看某天的详情]或[创建一个新的日程]。操作日程时请使用上面列出的 id。");
    Ok(result)
}

// ========== 查看日历 ==========

fn execute_list_calendars(conn: &Connection) -> Result<String, String> {
    let calendars = calendar_repo::list_calendars(conn)?;

    if calendars.is_empty() {
        return Ok("当前没有日历表。你可以在设置中创建日历。".to_string());
    }

    let mut result = format!("共有{}个日历：\n\n", calendars.len());
    for cal in &calendars {
        let default_mark = if cal.is_default == 1 { " [默认]" } else { "" };
        result.push_str(&format!(
            "- **{}** (id: `{}`, 颜色: {}){}\n",
            cal.name, cal.id, cal.color, default_mark
        ));
    }
    result.push_str("\n提示：创建或修改日程时，可以用 calendar_id 参数指定日历。");
    Ok(result)
}

// ========== 日程搜索辅助 ==========

fn find_schedule_by_title(
    conn: &Connection,
    query: &str,
) -> Result<(Vec<schedule_repo::Schedule>, usize), String> {
    // 搜索最近一年到未来一年的范围，避免展开过多重复实例
    let one_year_ago = (Local::now() - Duration::days(365)).format("%Y-%m-%d").to_string();
    let one_year_later = (Local::now() + Duration::days(365)).format("%Y-%m-%d").to_string();
    let all = schedule_repo::list_schedules_in_range(conn, &one_year_ago, &one_year_later)?;
    let tokens: Vec<&str> = query
        .split(|c: char| c.is_whitespace() || c == '\u{ff0c}' || c == '\u{3002}')
        .filter(|t| !t.is_empty())
        .collect();

    let mut scored: Vec<(schedule_repo::Schedule, i32)> = all
        .into_iter()
        .map(|s| {
            let score = tokens.iter().fold(0, |acc, token| {
                let mut s_score = 0;
                if s.title.contains(token) { s_score += 10; }
                if let Some(ref desc) = s.description { if desc.contains(token) { s_score += 3; } }
                acc + s_score
            });
            (s, score)
        })
        .filter(|(_, score)| *score > 0)
        .collect();

    scored.sort_by(|a, b| b.1.cmp(&a.1));

    // 按基础 ID 去重（展开实例共享同一个 base ID）
    let mut seen_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut deduped: Vec<schedule_repo::Schedule> = Vec::new();
    for (s, _) in scored {
        let bid = extract_base_id(&s.id).to_string();
        if seen_ids.insert(bid) {
            deduped.push(s);
        }
    }
    let count = deduped.len();
    Ok((deduped, count))
}

// ========== 更新日程 ==========

fn execute_update_schedule(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolUpdateScheduleArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("update_schedule 参数解析失败: {}", e))?;

    let raw_schedule_id: String;

    if let Some(ref id) = args.id {
        if !id.is_empty() {
            raw_schedule_id = id.clone();
        } else {
            return Err("id 不能为空".to_string());
        }
    } else if let Some(ref query) = args.query {
        if query.is_empty() {
            return Err("请提供 query 或 id".to_string());
        }
        let (schedules, count) = find_schedule_by_title(conn, query)?;
        if count == 0 {
            return Err(format!("没有找到匹配[{}]的日程", query));
        }
        if count > 1 {
            let names: Vec<String> = schedules.iter().take(5).map(|s| {
                let date = &s.start_at[..s.start_at.len().min(16)];
                format!("\n- {} (ID: {}, {})", s.title, s.id, date)
            }).collect();
            return Err(format!(
                "找到{}个匹配的日程：{}\n\n请告诉用户是哪一个，然后用对应的 id 重新调用 update_schedule。",
                count, names.join("")
            ));
        }
        raw_schedule_id = schedules[0].id.clone();
    } else {
        return Err("请提供 query 或 id 来指定要修改的日程".to_string());
    }

    // 处理展开实例 ID：提取基础 ID（去掉 _{date} 后缀）
    let schedule_id = extract_base_id(&raw_schedule_id);

    let updated = schedule_repo::update_schedule(
        conn, schedule_id,
        args.title.as_deref(),
        args.description.as_deref(),
        args.start_at.as_deref(),
        args.end_at.as_deref(),
        None, None, None,
        args.is_all_day.map(|b| if b { 1 } else { 0 }),
        args.location.as_deref(),
        args.category.as_deref(),
        args.calendar_id.as_deref(),
        None,
    )?;

    Ok(format!("日程已更新：{}，开始时间：{}", updated.title, updated.start_at))
}

// ========== 删除日程 ==========

fn execute_delete_schedule(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolQueryOrIdArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("delete_schedule 参数解析失败: {}", e))?;

    // 如果有 id，直接删除（处理展开实例 ID）
    if let Some(ref id) = args.id {
        if !id.is_empty() {
            let base_id = extract_base_id(id);
            let schedule = schedule_repo::get_schedule(conn, base_id)?;
            let title = schedule.title.clone();
            schedule_repo::delete_schedule(conn, base_id)?;
            return Ok(format!("日程已删除：{}", title));
        }
    }

    let query = args.query.as_deref().unwrap_or("");
    if query.is_empty() {
        return Err("请提供 query 或 id 来指定要删除的日程".to_string());
    }

    let (schedules, count) = find_schedule_by_title(conn, query)?;

    if count == 0 {
        return Err(format!("没有找到匹配[{}]的日程", query));
    }

    if count > 1 {
        let names: Vec<String> = schedules.iter().take(5).map(|s| {
            let date = &s.start_at[..s.start_at.len().min(16)];
            let base_id = extract_base_id(&s.id);
            format!("\n- {} (ID: {}, {})", s.title, base_id, date)
        }).collect();
        return Err(format!(
            "找到{}个匹配[{}]的日程：{}\n\n请告诉用户是哪一个，然后用对应的 id 重新调用 delete_schedule。",
            count, query, names.join("")
        ));
    }

    let s = &schedules[0];
    let title = s.title.clone();
    let base_id = extract_base_id(&s.id);
    schedule_repo::delete_schedule(conn, base_id)?;
    Ok(format!("日程已删除：{}", title))
}

// ========== 读取日记 ==========

fn execute_get_journal(conn: &Connection, _app_data_dir: Option<&Path>, arguments: &str) -> Result<String, String> {
    let args: ToolDateArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("get_journal_by_date 参数解析失败: {}", e))?;

    let journal_opt = journal_repo::get_journal_by_date(conn, &args.date)?;

    match journal_opt {
        None => Ok(format!("{} 还没有日记。想说点什么吗？", args.date)),
        Some(journal) => {
            let content = std::fs::read_to_string(&journal.file_path)
                .unwrap_or_else(|_| "(文件读取失败)".to_string());

            let truncated = if content.len() > 3000 {
                format!("{}...\n\n(日记较长，已截断前3000字符)", &content[..3000])
            } else {
                content
            };

            let mut result = format!("\u{1f4c5} {} 的日记\n\n", args.date);
            if let Some(ref mood) = journal.mood {
                result.push_str(&format!("心情：{}\n", mood));
            }
            result.push_str(&format!("\n{}", truncated));
            Ok(result)
        }
    }
}

// ========== 写入日记 ==========

fn execute_save_journal(conn: &Connection, app_data_dir: Option<&Path>, arguments: &str) -> Result<String, String> {
    let args: ToolSaveJournalArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("save_journal 参数解析失败: {}", e))?;

    let app_data_dir = app_data_dir.ok_or("app_data_dir 不可用")?;

    let journal = journal_repo::get_or_create_journal(conn, app_data_dir, &args.date)?;

    let word_count = args.content.chars().count() as i32;

    journal_repo::write_md_file(
        std::path::Path::new(&journal.file_path),
        &args.date,
        args.mood.as_deref(),
        args.tags.as_deref(),
        word_count,
        "user",
        &args.content,
    )?;

    journal_repo::update_journal_metadata(
        conn, &journal.id, None, args.mood.as_deref(), args.tags.as_deref(), word_count,
    )?;

    Ok(format!("{} 的日记已保存（{}字）", args.date, word_count))
}

// ========== 查看时间线 ==========

fn execute_get_timeline(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolTimelineArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("get_timeline 参数解析失败: {}", e))?;

    let dates = journal_repo::get_timeline_entries(conn, args.year, args.month)?;

    if dates.is_empty() {
        return Ok(format!("{}年{}月还没有任何日记记录。", args.year, args.month));
    }

    let mut result = format!("{}年{}月有{}天写了日记：\n\n", args.year, args.month, dates.len());
    for date in &dates {
        result.push_str(&format!("- {}\n", date));
    }
    result.push_str("\n你可以说[看看某天的日记]来读取内容。");
    Ok(result)
}

// ========== 创建联系人 ==========

// ========== 结算日记 XP ==========

fn execute_settle_diary(conn: &mut Connection, arguments: &str) -> Result<String, String> {
    #[derive(Debug, Deserialize)]
    struct SettleDiaryArgs {
        date: String,
        xp_allocations: Vec<XpAllocation>,
    }

    let args: SettleDiaryArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("settle_diary 参数解析失败: {}", e))?;

    let allocations: Vec<(String, i32)> = args
        .xp_allocations
        .iter()
        .map(|a| (a.skill_id.clone(), a.xp_amount))
        .collect();

    let result = journal_repo::complete_diary_with_xp(conn, &args.date, &allocations)?;
    let xp_line = format_xp_result(&result);
    Ok(format!("日记 XP 已结算{}{}", args.date, xp_line))
}

fn execute_create_contact(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolCreateContactArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("create_contact 参数解析失败: {}", e))?;

    let methods: Vec<ContactMethodInput> = args.contact_methods
        .unwrap_or_default()
        .into_iter()
        .map(|m| ContactMethodInput { method_type: m.method_type, value: m.value })
        .collect();

    let contact = contact_repo::create_contact(
        conn, &args.name,
        args.nickname.as_deref(),
        args.group_name.as_deref(),
        None,
        args.birthday_calendar.as_deref(),
        args.birthday_year,
        args.birthday_month,
        args.birthday_day,
        &methods,
        args.notes.as_deref(),
    )?;

    let mut result = format!("联系人已创建：{}", contact.name);
    if let Some(ref g) = contact.group_name {
        result.push_str(&format!("，分组：{}", g));
    }
    if let (Some(m), Some(d)) = (contact.birthday_month, contact.birthday_day) {
        let cal = contact.birthday_calendar.as_deref().unwrap_or("solar");
        let cal_label = if cal == "lunar" { "农历" } else { "阳历" };
        if let Some(y) = contact.birthday_year {
            result.push_str(&format!("，生日：{}{}年{}月{}日", cal_label, y, m, d));
        } else {
            result.push_str(&format!("，生日：{}{}月{}日", cal_label, m, d));
        }
    }
    Ok(result)
}

// ========== 搜索联系人 ==========

fn execute_search_contacts(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolQueryArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("search_contacts 参数解析失败: {}", e))?;

    let contacts = contact_repo::search_contacts(conn, &args.query)?;

    if contacts.is_empty() {
        return Ok(format!("没有找到匹配[{}]的联系人。", args.query));
    }

    let mut result = format!("找到{}个匹配的联系人：\n\n", contacts.len());
    for c in &contacts {
        let group = c.group_name.as_deref().unwrap_or("未分组");
        let mut line = format!("- **{}** ({})", c.name, group);
        if !c.contact_methods.is_empty() {
            let methods: Vec<String> = c.contact_methods.iter()
                .map(|m| format!("[{}]{}", m.method_type, m.value))
                .collect();
            line.push_str(&format!("，联系方式：{}", methods.join(", ")));
        }
        if let Some(ref notes) = c.notes {
            line.push_str(&format!("，备注：{}", notes));
        }
        result.push_str(&format!("{}\n", line));
    }
    Ok(result)
}

// ========== 列出联系人 ==========

fn execute_list_contacts(conn: &Connection, arguments: &str) -> Result<String, String> {
    #[derive(Debug, Deserialize)]
    struct ListContactArgs {
        #[serde(default)]
        group_name: Option<String>,
    }
    let args: ListContactArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("list_contacts 参数解析失败: {}", e))?;

    let contacts = contact_repo::list_contacts(conn, args.group_name.as_deref())?;

    if contacts.is_empty() {
        let hint = match &args.group_name {
            Some(g) => format!("[{}]分组下暂无联系人", g),
            None => "还没有任何联系人。试试说[记一个联系人]来添加吧！".to_string(),
        };
        return Ok(hint);
    }

    let mut result = format!("共有{}个联系人：\n\n", contacts.len());
    use std::collections::BTreeMap;
    let mut groups: BTreeMap<String, Vec<&contact_repo::Contact>> = BTreeMap::new();
    for c in &contacts {
        let g = c.group_name.clone().unwrap_or_else(|| "未分组".to_string());
        groups.entry(g).or_default().push(c);
    }
    for (group, members) in &groups {
        result.push_str(&format!("**{}** ({}人)\n", group, members.len()));
        for m in members {
            let birthday = match (m.birthday_month, m.birthday_day) {
                (Some(month), Some(day)) => {
                    let cal = m.birthday_calendar.as_deref().unwrap_or("solar");
                    let cal_label = if cal == "lunar" { "农历" } else { "" };
                    let year_str = m.birthday_year.map(|y| format!("{}年", y)).unwrap_or_default();
                    format!("，生日：{}{}{}月{}日", cal_label, year_str, month, day)
                }
                _ => String::new(),
            };
            result.push_str(&format!("  - {}{}\n", m.name, birthday));
        }
    }
    Ok(result)
}

// ========== 更新联系人 ==========

fn execute_update_contact(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolUpdateContactArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("update_contact 参数解析失败: {}", e))?;

    let contact_id: String;

    if let Some(ref id) = args.id {
        if !id.is_empty() {
            contact_id = id.clone();
        } else {
            return Err("id 不能为空".to_string());
        }
    } else if let Some(ref query) = args.query {
        if query.is_empty() {
            return Err("请提供 query 或 id".to_string());
        }
        let contacts = contact_repo::search_contacts(conn, query)?;
        if contacts.is_empty() {
            return Err(format!("没有找到匹配[{}]的联系人", query));
        }
        if contacts.len() > 1 {
            let names: Vec<String> = contacts.iter().map(|c| {
                let group = c.group_name.as_deref().unwrap_or("未分组");
                format!("\n- {} (ID: {}, 分组: {})", c.name, c.id, group)
            }).collect();
            return Err(format!(
                "找到{}个匹配的联系人：{}\n\n请告诉用户是哪一个，然后用对应的 id 重新调用 update_contact。",
                contacts.len(), names.join("")
            ));
        }
        contact_id = contacts[0].id.clone();
    } else {
        return Err("请提供 query 或 id 来指定要修改的联系人".to_string());
    }

    let methods: Option<Vec<ContactMethodInput>> = args.contact_methods.map(|ms|
        ms.into_iter().map(|m| ContactMethodInput { method_type: m.method_type, value: m.value }).collect()
    );

    let updated = contact_repo::update_contact(
        conn, &contact_id,
        args.name.as_deref(),
        args.nickname.as_deref(),
        args.group_name.as_deref(),
        None,
        args.birthday_calendar.as_deref(),
        args.birthday_year,
        args.birthday_month,
        args.birthday_day,
        methods.as_deref(),
        args.notes.as_deref(),
    )?;

    Ok(format!("联系人已更新：{}", updated.name))
}

// ========== 删除联系人 ==========

fn execute_delete_contact(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolQueryOrIdArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("delete_contact 参数解析失败: {}", e))?;

    if let Some(ref id) = args.id {
        if !id.is_empty() {
            let contact = contact_repo::get_contact(conn, id)?;
            let name = contact.name.clone();
            contact_repo::delete_contact(conn, id)?;
            return Ok(format!("联系人已删除：{}", name));
        }
    }

    let query = args.query.as_deref().unwrap_or("");
    if query.is_empty() {
        return Err("请提供 query 或 id 来指定要删除的联系人".to_string());
    }

    let contacts = contact_repo::search_contacts(conn, query)?;

    if contacts.is_empty() {
        return Err(format!("没有找到匹配[{}]的联系人", query));
    }

    if contacts.len() > 1 {
        let names: Vec<String> = contacts.iter().map(|c| {
            let group = c.group_name.as_deref().unwrap_or("未分组");
            format!("\n- {} (ID: {}, 分组: {})", c.name, c.id, group)
        }).collect();
        return Err(format!(
            "找到{}个匹配的联系人：{}\n\n请告诉用户是哪一个，然后用对应的 id 重新调用 delete_contact。",
            contacts.len(), names.join("")
        ));
    }

    let c = &contacts[0];
    let name = c.name.clone();
    contact_repo::delete_contact(conn, &c.id)?;
    Ok(format!("联系人已删除：{}", name))
}

/// 格式化 XP 结算结果
fn format_xp_result(result: &crate::db::repositories::task_repo::CompleteResult) -> String {
    if result.skill_xps.is_empty() {
        return String::new();
    }
    let parts: Vec<String> = result
        .skill_xps
        .iter()
        .map(|s| format!("{}+{}", s.skill_name, s.xp))
        .collect();
    format!(" | XP: {}（{}）", result.xp_earned, parts.join(" "))
}

// ========== 查看技能 ==========

fn execute_list_skills(conn: &Connection, _arguments: &str) -> Result<String, String> {
    let skills = skill_repo::list_skills(conn)?;

    if skills.is_empty() {
        return Ok("六维属性尚未初始化。".to_string());
    }

    let mut result = "六维属性面板：\n\n".to_string();
    for s in &skills {
        let xp_in_level = s.total_xp % 100;
        let progress_bar = if s.total_xp > 0 {
            let filled = (xp_in_level / 10) as usize;
            let bar_len = 10usize;
            let empty = bar_len.saturating_sub(filled);
            "\u{2588}".repeat(filled) + &"\u{2591}".repeat(empty)
        } else {
            "\u{2591}".repeat(10)
        };
        result.push_str(&format!(
            "**{}** Lv.{} | \u{603b}XP: {} | [{}/100]\n{}\n\n",
            s.name, s.level, s.total_xp, xp_in_level, progress_bar
        ));
    }
    result.push_str("\u{63d0}\u{793a}\u{ff1a}\u{5b8c}\u{6210}\u{4efb}\u{52a1}\u{53ef}\u{83b7}\u{5f97}\u{5404}\u{5c5e}\u{6027}\u{7ecf}\u{9a8c}\u{503c}\u{63d0}\u{5347}\u{3002}");
    Ok(result)
}

// ========== 查看任务技能分配 ==========

fn execute_get_task_skills(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolQueryArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("get_task_skills 参数解析失败: {}", e))?;

    let scored = scored_search(conn, &args.query, None, None, &[])?;

    let task = match classify_matches(&scored) {
        MatchResult::None => return Err(format!("没有找到匹配[{}]的任务", args.query)),
        MatchResult::Unique(idx) => &scored[idx].0,
        _ => {
            let names: Vec<String> = scored.iter().map(|(t, _)| t.title.clone()).collect();
            return Err(format!(
                "找到多个匹配任务：{}。请更具体地指定要查看哪个。",
                names.join("、")
            ));
        }
    };

    let task_skills = skill_repo::get_task_skills(conn, &task.id)?;

    if task_skills.is_empty() {
        return Ok(format!("任务[{}]尚未分配属性经验值。在任务详情中可为各属性设置XP加成。", task.title));
    }

    let skills = skill_repo::list_skills(conn)?;
    let mut result = format!("任务[{}]的属性加成：\n\n", task.title);
    for ts in &task_skills {
        let skill_name = skills.iter()
            .find(|s| s.id == ts.skill_id)
            .map(|s| s.name.as_str())
            .unwrap_or("未知");
        result.push_str(&format!("- {}：+{} XP\n", skill_name, ts.xp_amount));
    }
    Ok(result)
}

// ========== 辅助函数 ==========

fn status_cn(status: &str) -> &str {
    match status {
        "pending" => "待办",
        "in_progress" => "进行中",
        "completed" => "已完成",
        "cancelled" => "已取消",
        _ => status,
    }
}

/// 从展开实例 ID ({base}_{YYYY-MM-DD}) 中提取基础 ID
fn extract_base_id(id: &str) -> &str {
    // 检查是否匹配 {base}_{YYYY-MM-DD} 格式
    if let Some(pos) = id.rfind('_') {
        let suffix = &id[pos + 1..];
        if suffix.len() == 10
            && suffix.chars().nth(4) == Some('-')
            && suffix.chars().nth(7) == Some('-')
            && suffix.chars().filter(|c| *c == '-').count() == 2
        {
            return &id[..pos];
        }
    }
    id
}

// ========== 日期解析 ==========

#[derive(Debug, Deserialize)]
struct ToolResolveDateArgs {
    expression: String,
}

fn execute_resolve_date(arguments: &str) -> Result<String, String> {
    let args: ToolResolveDateArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("resolve_date 参数解析失败: {}", e))?;
    let today = Local::now().date_naive();
    match resolve_date_expression(&args.expression, today) {
        Ok((result, explanation)) => {
            Ok(format!("{}\n日期: {}", explanation, result))
        }
        Err(e) => Err(e),
    }
}

fn resolve_date_expression(expr: &str, today: NaiveDate) -> Result<(String, String), String> {
    let cleaned = expr.trim();

    // ── 精确匹配：相对天 ──
    match cleaned {
        "今天" => {
            let s = today.format("%Y-%m-%d").to_string();
            return Ok((s, format!("今天 = {}", fmt_date_cn(today))));
        }
        "明天" => {
            let d = today.succ_opt().ok_or("日期溢出")?;
            let s = d.format("%Y-%m-%d").to_string();
            return Ok((s, format!("明天 = {}", fmt_date_cn(d))));
        }
        "后天" => {
            let d = today
                .succ_opt()
                .and_then(|d| d.succ_opt())
                .ok_or("日期溢出")?;
            let s = d.format("%Y-%m-%d").to_string();
            return Ok((s, format!("后天 = {}", fmt_date_cn(d))));
        }
        "大后天" => {
            let d = today
                .succ_opt()
                .and_then(|d| d.succ_opt())
                .and_then(|d| d.succ_opt())
                .ok_or("日期溢出")?;
            let s = d.format("%Y-%m-%d").to_string();
            return Ok((s, format!("大后天 = {}", fmt_date_cn(d))));
        }
        "昨天" => {
            let d = today.pred_opt().ok_or("日期溢出")?;
            let s = d.format("%Y-%m-%d").to_string();
            return Ok((s, format!("昨天 = {}", fmt_date_cn(d))));
        }
        "前天" => {
            let d = today
                .pred_opt()
                .and_then(|d| d.pred_opt())
                .ok_or("日期溢出")?;
            let s = d.format("%Y-%m-%d").to_string();
            return Ok((s, format!("前天 = {}", fmt_date_cn(d))));
        }
        "周末" | "这周末" | "本周周末" => {
            let (sat, sun) = weekend_of_week(today)?;
            let s = format!("{}~{}", sat.format("%Y-%m-%d"), sun.format("%Y-%m-%d"));
            return Ok((s, format!("本周末 = {} 至 {}", fmt_date_cn(sat), fmt_date_cn(sun))));
        }
        "下周末" | "下个周末" => {
            let next = today + Duration::days(7);
            let (sat, sun) = weekend_of_week(next)?;
            let s = format!("{}~{}", sat.format("%Y-%m-%d"), sun.format("%Y-%m-%d"));
            return Ok((s, format!("下周末 = {} 至 {}", fmt_date_cn(sat), fmt_date_cn(sun))));
        }
        _ => {}
    }

    // ── 星期X / 这周X / 下周X / 上周X ──
    if let Some(result) = try_parse_weekday(cleaned, today) {
        return result;
    }

    // ── N天后 / N周后 / N个月后 ──
    if let Some(result) = try_parse_offset(cleaned, today) {
        return result;
    }

    // ── X月X号 / 这个月X号 / 下个月X号 ──
    if let Some(result) = try_parse_month_day(cleaned, today) {
        return result;
    }

    // ── 月底 / 月初 / 月末 / 下个月底 ──
    if let Some(result) = try_parse_month_edge(cleaned, today) {
        return result;
    }

    // ── ISO 日期透传 (YYYY-MM-DD) ──
    if let Ok(d) = NaiveDate::parse_from_str(cleaned, "%Y-%m-%d") {
        let s = d.format("%Y-%m-%d").to_string();
        return Ok((s, format!("日期: {}", fmt_date_cn(d))));
    }

    // ── 无法识别 ──
    Err(format!(
        "无法解析日期表达式[{}]。请直接提供 YYYY-MM-DD 格式的日期。",
        cleaned
    ))
}

// ── 星期解析 ──

const WEEKDAY_NAMES: &[(&str, Weekday)] = &[
    ("周一", Weekday::Mon), ("星期一", Weekday::Mon),
    ("周二", Weekday::Tue), ("星期二", Weekday::Tue),
    ("周三", Weekday::Wed), ("星期三", Weekday::Wed),
    ("周四", Weekday::Thu), ("星期四", Weekday::Thu),
    ("周五", Weekday::Fri), ("星期五", Weekday::Fri),
    ("周六", Weekday::Sat), ("星期六", Weekday::Sat),
    ("周日", Weekday::Sun), ("星期天", Weekday::Sun), ("星期日", Weekday::Sun),
];

fn try_parse_weekday(expr: &str, today: NaiveDate) -> Option<Result<(String, String), String>> {
    // 确定偏移: 这周, 下周, 上周
    let (prefix, offset_weeks) = if expr.starts_with("下下周") {
        ("下下周", 2)
    } else if expr.starts_with("这周") || expr.starts_with("本周") {
        ("这周", 0)
    } else if expr.starts_with("下周") || expr.starts_with("下个星期") {
        ("下周", 1)
    } else if expr.starts_with("上周") || expr.starts_with("上个星期") {
        ("上周", -1)
    } else {
        // 无前缀：最接近的未来的那一天
        ("", -999) // sentinel for "next occurrence"
    };

    let day_part = if prefix.is_empty() {
        expr
    } else {
        expr.strip_prefix(prefix).unwrap_or(expr)
    };

    let Some(target_wd) = WEEKDAY_NAMES.iter().find(|(name, _)| day_part == *name) else {
        return None;
    };
    let target_wd = target_wd.1;

    let date = if offset_weeks == -999 {
        // 没有前缀：找最近的那个星期几（今天或未来）
        match next_weekday(today, target_wd) {
            Ok((d, _)) => d,
            Err(_) => return None,
        }
    } else {
        // 这周一 = 本周一
        let monday = monday_of_week(today);
        let d = monday + Duration::days(offset_weeks as i64 * 7);
        match next_weekday_from(d, target_wd) {
            Ok((date, _)) => date,
            Err(_) => return None,
        }
    };

    let s = date.format("%Y-%m-%d").to_string();
    Some(Ok((s, format!("{} = {}", expr, fmt_date_cn(date)))))
}

// ── 偏移量解析: N天后 / N周后 / N个月后 / N年前 ──

fn try_parse_offset(expr: &str, today: NaiveDate) -> Option<Result<(String, String), String>> {
    let re_days = regex_lite_match(r"(\d+)\s*天[之后]", expr);
    let re_weeks = regex_lite_match(r"(\d+)\s*[个]?周[之以]后", expr);
    let re_months = regex_lite_match(r"(\d+)\s*[个]?月[之以]后", expr);

    if let Some(n_str) = re_days {
        let n: i64 = n_str.parse().ok()?;
        let d = today + Duration::days(n);
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{} = {}天后 = {}", expr, n, fmt_date_cn(d)))));
    }
    if let Some(n_str) = re_weeks {
        let n: i64 = n_str.parse().ok()?;
        let d = today + Duration::days(n * 7);
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{} = {}周后 = {}", expr, n, fmt_date_cn(d)))));
    }
    if let Some(n_str) = re_months {
        let n: u32 = n_str.parse().ok()?;
        let d = add_months(today, n)?;
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{} = {}个月后 = {}", expr, n, fmt_date_cn(d)))));
    }
    None
}

// ── 月日解析: X月X号 / 这个月X号 / 下个月X号 ──

fn try_parse_month_day(expr: &str, today: NaiveDate) -> Option<Result<(String, String), String>> {
    // 匹配: 5月3号, 05月03号, 12月31号
    let re_full = regex_lite_captures(r"(\d{1,2})\s*月\s*(\d{1,2})\s*[号日]?", expr);
    if let Some((m_str, d_str)) = re_full {
        let month: u32 = m_str.parse().ok()?;
        let day: u32 = d_str.parse().ok()?;
        let year = today.year();
        let d = NaiveDate::from_ymd_opt(year, month, day)?;
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{} = {}", expr, fmt_date_cn(d)))));
    }

    // 匹配: 这个月5号, 下个月15号, 这个月3号
    let re_rel = regex_lite_captures(r"(这个月|下个月|下月)\s*(\d{1,2})\s*[号日]?", expr);
    if let Some((prefix, day_str)) = re_rel {
        let day: u32 = day_str.parse().ok()?;
        let (year, month) = match prefix.as_str() {
            "这个月" => (today.year(), today.month()),
            "下个月" | "下月" => {
                if today.month() == 12 {
                    (today.year() + 1, 1)
                } else {
                    (today.year(), today.month() + 1)
                }
            }
            _ => unreachable!(),
        };
        let d = NaiveDate::from_ymd_opt(year, month, day)?;
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{} = {}", expr, fmt_date_cn(d)))));
    }

    // 单独一个数字: 15号 → 这个月15号
    let re_day = regex_lite_captures(r"^(\d{1,2})\s*[号日]$", expr);
    if let Some((day_str, _)) = re_day {
        let day: u32 = day_str.parse().ok()?;
        let d = NaiveDate::from_ymd_opt(today.year(), today.month(), day)?;
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{}号 = {}", day, fmt_date_cn(d)))));
    }

    None
}

// ── 月边界: 月底 / 月初 / 月末 / 下个月底 ──

fn try_parse_month_edge(expr: &str, today: NaiveDate) -> Option<Result<(String, String), String>> {
    let (offset, edge) = match expr {
        "月底" | "月末" | "这个月底" | "这个月末" => (0, "end"),
        "月初" | "这个月初" => (0, "start"),
        "下个月底" | "下个月末" | "下月底" | "下月末" => (1, "end"),
        "下个月初" | "下月初" => (1, "start"),
        _ => return None,
    };

    let (year, month) = if today.month() == 12 {
        (today.year() + offset, if offset > 0 { 1 } else { 12 })
    } else {
        (today.year(), today.month() + offset as u32)
    };

    let d = match edge {
        "end" => last_day_of_month(year, month)?,
        "start" => NaiveDate::from_ymd_opt(year, month, 1)?,
        _ => unreachable!(),
    };

    let label = match edge { "end" => "最后一天", "start" => "第一天", _ => "" };
    let s = d.format("%Y-%m-%d").to_string();
    Some(Ok((s, format!("{} = {} {}", expr, format!("{}年{}月", year, month), label))))
}

// ── 日期计算辅助 ──

fn monday_of_week(date: NaiveDate) -> NaiveDate {
    let num = date.weekday().num_days_from_monday();
    date - Duration::days(num as i64)
}

fn next_weekday(today: NaiveDate, target: Weekday) -> Result<(NaiveDate, Option<String>), String> {
    let today_wd = today.weekday();
    let days_ahead = (target.num_days_from_monday() as i32 - today_wd.num_days_from_monday() as i32 + 7) % 7;
    let d = if days_ahead == 0 {
        today
    } else {
        today + Duration::days(days_ahead as i64)
    };
    Ok((d, None))
}

fn next_weekday_from(from: NaiveDate, target: Weekday) -> Result<(NaiveDate, Option<String>), String> {
    let from_wd = from.weekday();
    let days_ahead = (target.num_days_from_monday() as i32 - from_wd.num_days_from_monday() as i32 + 7) % 7;
    let d = from + Duration::days(days_ahead as i64);
    Ok((d, None))
}

fn weekend_of_week(date: NaiveDate) -> Result<(NaiveDate, NaiveDate), String> {
    let monday = monday_of_week(date);
    let sat = monday + Duration::days(5);
    let sun = monday + Duration::days(6);
    Ok((sat, sun))
}

fn add_months(date: NaiveDate, n: u32) -> Option<NaiveDate> {
    let total_months = date.month() + n;
    let year_offset: i32 = ((total_months - 1) / 12) as i32;
    let new_month = (total_months - 1) % 12 + 1;
    let max_day = days_in_month(date.year() + year_offset, new_month);
    let day = date.day().min(max_day);
    NaiveDate::from_ymd_opt(date.year() + year_offset, new_month, day)
}

fn last_day_of_month(year: i32, month: u32) -> Option<NaiveDate> {
    let day = days_in_month(year, month);
    NaiveDate::from_ymd_opt(year, month, day)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

fn fmt_date_cn(date: NaiveDate) -> String {
    let weekdays_cn = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    format!(
        "{}年{}月{}日 {}",
        date.year(),
        date.month(),
        date.day(),
        weekdays_cn[date.weekday().num_days_from_monday() as usize]
    )
}

// ── 简单的正则辅助(不引入 regex crate) ──

fn regex_lite_match(_pattern: &str, text: &str) -> Option<String> {
    // 提取第一个数字序列
    let mut num_str = String::new();
    let mut in_num = false;
    for c in text.chars() {
        if c.is_ascii_digit() {
            num_str.push(c);
            in_num = true;
        } else if in_num {
            break;
        }
    }
    if num_str.is_empty() {
        return None;
    }
    Some(num_str)
}

fn regex_lite_captures(pattern: &str, text: &str) -> Option<(String, String)> {
    // ── 简单数字提取 ──
    let chars: Vec<char> = text.chars().collect();
    let mut nums: Vec<String> = Vec::new();
    let mut current = String::new();
    for &c in &chars {
        if c.is_ascii_digit() {
            current.push(c);
        } else {
            if !current.is_empty() {
                nums.push(current.clone());
                current.clear();
            }
        }
    }
    if !current.is_empty() {
        nums.push(current);
    }

    if pattern.contains("月") && pattern.contains("号") {
        if nums.len() >= 2 {
            return Some((nums[0].clone(), nums[1].clone()));
        }
    }
    if pattern.contains("这个月") || pattern.contains("下个月") || pattern.contains("下月") {
        if nums.len() >= 1 {
            let prefix = if text.contains("这个月") {
                "这个月".to_string()
            } else if text.contains("下个月") {
                "下个月".to_string()
            } else if text.contains("下月") {
                "下月".to_string()
            } else {
                return None;
            };
            return Some((prefix, nums[0].clone()));
        }
    }
    if pattern.contains("[号日]") {
        if nums.len() == 1 && (text.contains('号') || text.contains('日')) {
            return Some((nums[0].clone(), String::new()));
        }
    }

    None
}

// ========== 记忆工具 ==========

const VALID_MEMORY_TYPES: &[&str] = &[
    "identity", "interest", "taste", "habit", "personality",
    "relationship", "status", "goal", "event", "other",
];

fn memory_type_label(memory_type: &str) -> &str {
    match memory_type {
        "identity" => "身份信息",
        "interest" => "兴趣爱好",
        "taste" => "口味偏好",
        "habit" => "日常习惯",
        "personality" => "性格特点",
        "relationship" => "人际关系",
        "status" => "当前状态",
        "goal" => "近期目标",
        "event" => "重要事件",
        "other" => "其他",
        _ => "未知",
    }
}

#[derive(Debug, Deserialize)]
struct ToolRecordMemoryArgs {
    content: String,
    memory_type: String,
    #[serde(default)]
    source_text: Option<String>,
}

fn execute_record_memory(conn: &mut Connection, arguments: &str) -> Result<String, String> {
    let args: ToolRecordMemoryArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("record_memory 参数解析失败: {}", e))?;

    // 验证 memory_type
    if !VALID_MEMORY_TYPES.contains(&args.memory_type.as_str()) {
        return Err(format!(
            "无效的记忆类型: {}。有效类型: {}",
            args.memory_type,
            VALID_MEMORY_TYPES.join(", ")
        ));
    }

    // 去重检查：搜索已有记忆中是否有内容高度相似的
    let existing = memory_repo::list_memories(conn, None).unwrap_or_default();
    for m in &existing {
        // 子串包含检查
        if m.content.contains(&args.content) || args.content.contains(&m.content) {
            return Ok(format!(
                "小本本中已有类似记忆：[{}] \"{}\"。跳过重复记录。",
                memory_type_label(&m.memory_type),
                m.content
            ));
        }
    }

    let memory = memory_repo::create_memory(
        conn,
        &args.content,
        &args.memory_type,
        args.source_text.as_deref(),
        None,
    )?;

    Ok(format!(
        "已记入小本本：[{}] {}",
        memory_type_label(&memory.memory_type),
        memory.content
    ))
}

#[derive(Debug, Deserialize)]
struct ToolSearchMemoriesArgs {
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    memory_type: Option<String>,
}

fn execute_search_memories(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolSearchMemoriesArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("search_memories 参数解析失败: {}", e))?;

    // 验证 memory_type（如果提供）
    if let Some(ref t) = args.memory_type {
        if !VALID_MEMORY_TYPES.contains(&t.as_str()) {
            return Err(format!(
                "无效的记忆类型: {}。有效类型: {}",
                t,
                VALID_MEMORY_TYPES.join(", ")
            ));
        }
    }

    let memories = match &args.query {
        Some(q) if !q.trim().is_empty() => {
            memory_repo::search_memories(conn, q, args.memory_type.as_deref())?
        }
        _ => memory_repo::list_memories(conn, args.memory_type.as_deref())?,
    };

    if memories.is_empty() {
        let hint = match (&args.query, &args.memory_type) {
            (Some(q), Some(t)) => {
                format!("小本本中还没有匹配[{}]的{}类记忆。", q, memory_type_label(t))
            }
            (Some(q), _) => format!("小本本中还没有匹配[{}]的记忆。", q),
            (_, Some(t)) => format!("小本本中还没有{}类记忆。", memory_type_label(t)),
            _ => "小本本还是空的。当你在对话中了解到值得记住的信息时，我会帮你记下来。".to_string(),
        };
        return Ok(hint);
    }

    let mut result = format!("小本本中找到{}条记忆：\n\n", memories.len());
    for m in &memories {
        let label = memory_type_label(&m.memory_type);
        let time = &m.created_at[..m.created_at.len().min(16)];
        result.push_str(&format!("- [{}] {}（{}）\n", label, m.content, time));
    }
    result.push_str("\n提示：你可以说「帮我记住xxx」来添加新记忆。");
    Ok(result)
}

#[derive(Debug, Deserialize)]
struct ToolDeleteMemoryArgs {
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    id: Option<String>,
}

fn execute_delete_memory(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolDeleteMemoryArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("delete_memory 参数解析失败: {}", e))?;

    // 有 id 直接精确删除
    if let Some(ref id) = args.id {
        if !id.is_empty() {
            let memory = memory_repo::get_memory(conn, id)?;
            let content = memory.content.clone();
            memory_repo::delete_memory(conn, id)?;
            return Ok(format!("已从小本本中删除记忆：{}", content));
        }
    }

    let query = args.query.as_deref().unwrap_or("");
    if query.is_empty() {
        return Err("请提供 id 或 query 来指定要删除的记忆".to_string());
    }

    let results = memory_repo::search_memories(conn, query, None)?;

    if results.is_empty() {
        return Ok(format!("小本本中没有找到匹配[{}]的记忆。", query));
    }

    if results.len() == 1 {
        let m = &results[0];
        let content = m.content.clone();
        memory_repo::delete_memory(conn, &m.id)?;
        return Ok(format!("已从小本本中删除记忆：{}", content));
    }

    // 多条匹配，列出让用户选
    let mut msg = format!("找到{}条匹配[{}]的记忆，请告诉用户具体要删哪一条，然后用对应的 id 重新调用 delete_memory：\n\n", results.len(), query);
    for m in &results {
        let label = memory_type_label(&m.memory_type);
        msg.push_str(&format!("- [{}] {} (id: {})\n", label, m.content, m.id));
    }
    Err(msg)
}

// ========== 倒数日工具 ==========

fn execute_list_countdowns(conn: &Connection) -> Result<String, String> {
    let countdowns = schedule_repo::list_countdowns(conn)?;

    if countdowns.is_empty() {
        return Ok("暂无倒数日。告诉用户可以创建一个倒数日来追踪重要日期。".to_string());
    }

    let today = Local::now().date_naive();
    let mut result = format!("共有{}个倒数日：\n\n", countdowns.len());

    for (i, cd) in countdowns.iter().enumerate() {
        let days_info = if let Ok(target) = NaiveDate::parse_from_str(&cd.start_at[..10], "%Y-%m-%d") {
            let diff = (target - today).num_days();
            if diff > 0 {
                format!("还有{}天", diff)
            } else if diff == 0 {
                "就是今天！".to_string()
            } else {
                format!("已过{}天", -diff)
            }
        } else {
            cd.start_at[..10].to_string()
        };

        result.push_str(&format!("{}. {} — {} ({})\n", i + 1, cd.title, &cd.start_at[..10], days_info));
    }

    Ok(result)
}

// ========== 习惯工具 ==========

fn execute_list_habits(conn: &Connection) -> Result<String, String> {
    let habits = habit_repo::get_all_streaks(conn)?;

    if habits.is_empty() {
        return Ok("暂无习惯。告诉用户可以创建一个习惯开始打卡。".to_string());
    }

    let mut result = format!("共有{}个习惯：\n\n", habits.len());

    for (i, hws) in habits.iter().enumerate() {
        let habit = &hws.habit;
        let icon = habit.icon.as_deref().unwrap_or("");
        let freq = match habit.frequency_type.as_str() {
            "daily" => "每天",
            "weekly" => "每周",
            _ => "自定义",
        };
        let checked = if hws.checked_today { "✅ 今日已打卡" } else { "⬜ 今日未打卡" };
        let streak_info = if hws.streak > 0 {
            format!("连续{}天", hws.streak)
        } else {
            "暂无连续".to_string()
        };

        result.push_str(&format!("{}. {}{} — {}，{}，{}\n", i + 1, icon, habit.name, freq, streak_info, checked));
    }

    Ok(result)
}

fn execute_create_habit(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolCreateHabitArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("create_habit 参数解析失败: {}", e))?;

    let freq_type = args.frequency_type.as_deref().unwrap_or("daily");

    let habit = habit_repo::create_habit(
        conn,
        &args.name,
        args.icon.as_deref(),
        args.color.as_deref(),
        freq_type,
        None,
        None,
        None,
        5,
    )?;

    let mut result = format!("习惯已创建：{}", habit.name);
    if let Some(ref icon) = habit.icon {
        result.push_str(&format!(" {}", icon));
    }
    let freq = match habit.frequency_type.as_str() {
        "daily" => "每天",
        "weekly" => "每周",
        _ => "自定义",
    };
    result.push_str(&format!("，频率：{}", freq));

    Ok(result)
}

fn find_habit_by_query(conn: &Connection, habit_id: &Option<String>, query: &Option<String>) -> Result<habit_repo::Habit, String> {
    if let Some(ref id) = habit_id {
        if !id.is_empty() {
            return habit_repo::get_habit(conn, id);
        }
    }

    let q = query.as_deref().ok_or("请提供 habit_id 或 query 来指定习惯")?;
    if q.is_empty() {
        return Err("请提供 habit_id 或 query 来指定习惯".to_string());
    }

    let habits = habit_repo::list_habits(conn)?;
    let q_lower = q.to_lowercase();

    let matches: Vec<&habit_repo::Habit> = habits.iter()
        .filter(|h| h.name.to_lowercase().contains(&q_lower))
        .collect();

    match matches.len() {
        0 => Err(format!("没有找到名称包含[{}]的习惯", q)),
        1 => Ok(matches[0].clone()),
        _ => {
            let mut msg = format!("找到{}个匹配[{}]的习惯，请告诉用户具体是哪一个，然后用对应的 habit_id 重新调用：\n\n", matches.len(), q);
            for h in &matches {
                msg.push_str(&format!("- {} (id: {})\n", h.name, h.id));
            }
            Err(msg)
        }
    }
}

fn execute_check_habit(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolCheckHabitArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("check_habit 参数解析失败: {}", e))?;

    let habit = find_habit_by_query(conn, &args.habit_id, &args.query)?;
    let date_str = args.date.as_deref();

    let record = habit_repo::check_habit(conn, &habit.id, date_str, args.note.as_deref())?;

    let icon = habit.icon.as_deref().unwrap_or("");
    let date_display = &record.checked_at;
    Ok(format!("打卡成功：{}{} (日期：{})", icon, habit.name, date_display))
}

fn execute_uncheck_habit(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolCheckHabitArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("uncheck_habit 参数解析失败: {}", e))?;

    let habit = find_habit_by_query(conn, &args.habit_id, &args.query)?;
    let date_str = args.date.as_deref();

    let affected = habit_repo::uncheck_habit(conn, &habit.id, date_str)?;

    if affected > 0 {
        let date_display = date_str.unwrap_or("今天");
        Ok(format!("已取消打卡：{} (日期：{})", habit.name, date_display))
    } else {
        Err(format!("{}在指定日期没有打卡记录", habit.name))
    }
}
