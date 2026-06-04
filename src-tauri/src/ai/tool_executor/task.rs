use rusqlite::Connection;
use serde::Deserialize;

use crate::db::repositories::{skill_repo, task_repo};
use crate::db::repositories::task_repo::Task;

use super::shared::{classify_matches, format_task_for_ai, format_xp_result, scored_search, status_cn, MatchResult, ToolQueryOrIdArgs, ToolSearchArgs, XpAllocation};

// ── 参数 ──

#[derive(Debug, Deserialize)]
pub struct ToolCreateTaskArgs {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub scheduled_at: Option<String>,
    #[serde(default)]
    pub deadline: Option<String>,
    #[serde(default)]
    pub estimated_minutes: Option<i32>,
    #[serde(default)]
    pub tags: Option<String>,
    #[serde(default)]
    pub xp_allocations: Option<Vec<XpAllocation>>,
}

#[derive(Debug, Deserialize)]
pub struct ToolUpdateTaskArgs {
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub scheduled_at: Option<String>,
    #[serde(default)]
    pub deadline: Option<String>,
    #[serde(default)]
    pub estimated_minutes: Option<i32>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub tags: Option<String>,
}

// ── 执行函数 ──

pub fn execute_create_task(conn: &mut Connection, arguments: &str) -> Result<String, String> {
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
        0, // glow_reward: AI doesn't set this, user sets manually
    )?;

    let xp_line = if let Some(ref allocs) = args.xp_allocations {
        let pairs: Vec<(String, i32)> = allocs
            .iter()
            .map(|a| (a.skill_id.clone(), a.xp_amount))
            .collect();
        skill_repo::set_task_skills(conn, &task.id, &pairs)?;
        let total: i32 = pairs.iter().map(|(_, xp)| xp).sum();
        let parts: Vec<String> = pairs
            .iter()
            .map(|(sid, xp)| format!("{}+{}", super::shared::skill_name_by_id(sid), xp))
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

pub fn execute_complete_task(conn: &mut Connection, arguments: &str) -> Result<String, String> {
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

    if let Some(ref id) = args.id {
        if !id.is_empty() {
            let task = task_repo::get_task(conn, id)?;
            let title = task.title.clone();

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

pub fn execute_delete_task(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolQueryOrIdArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("delete_task 参数解析失败: {}", e))?;

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

pub fn execute_search_tasks(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolSearchArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("search_tasks 参数解析失败: {}", e))?;

    let all_tasks: Vec<Task> = match &args.query {
        Some(q) if !q.trim().is_empty() => {
            let scored = task_repo::search_tasks_scored(conn, q, None, None)?;
            scored.into_iter().map(|(t, _)| t).collect()
        }
        _ => task_repo::list_tasks(conn, None, None)?,
    };

    let tasks: Vec<&Task> = match &args.status {
        Some(s) if !s.is_empty() => all_tasks.iter().filter(|t| t.status == *s).collect(),
        _ => all_tasks.iter().collect(),
    };

    if tasks.is_empty() {
        let hint = match (&args.query, &args.status) {
            (Some(q), Some(s)) => format!("没有找到匹配[{}]且状态为[{}]的任务", q, status_cn(s)),
            (Some(q), _) => format!("没有找到匹配[{}]的任务", q),
            (_, Some(s)) => format!("没有[{}]状态的任务", status_cn(s)),
            _ => "目前还没有任何任务。试试说「帮我记一下…」来创建第一个任务吧！".to_string(),
        };
        return Ok(hint);
    }

    let mut result = format!("找到{}个任务：\n\n", tasks.len());

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

        if let Some(ref p) = task.priority {
            if p != "none" {
                result.push_str(&format!(" `{}`", status_cn(p)));
            }
        }

        if let Some(ref d) = task.deadline {
            result.push_str(&format!("，截止：{}", d));
        }

        result.push('\n');
    }

    result.push_str("\n提示：你可以对这些任务进行操作，比如「完成xxx」或「删掉xxx」。");
    Ok(result)
}

pub fn execute_update_task(conn: &Connection, arguments: &str) -> Result<String, String> {
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
