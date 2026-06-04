use chrono::{Duration, Local};
use rusqlite::Connection;
use serde::Deserialize;

use crate::db::repositories::{habit_repo, schedule_repo, task_repo};
use crate::db::repositories::task_repo::Task;

// ========== 共享参数结构 ==========

#[derive(Debug, Deserialize)]
pub struct XpAllocation {
    pub skill_id: String,
    pub xp_amount: i32,
}

#[derive(Debug, Deserialize)]
pub struct ToolQueryArgs {
    pub query: String,
}

#[derive(Debug, Deserialize)]
pub struct ToolQueryOrIdArgs {
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ToolSearchArgs {
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

// ========== 匹配结果 ==========

pub enum MatchResult {
    None,
    Unique(usize),
    Ambiguous,
    TooMany(usize),
}

// ========== 通用辅助函数 ==========

pub fn skill_name_by_id(skill_id: &str) -> &'static str {
    match skill_id {
        "focus" => "专注力",
        "vitality" => "生命力",
        "empathy" => "共情力",
        "creativity" => "创造力",
        "insight" => "洞察力",
        "expression" => "表现力",
        _ => "未知",
    }
}

pub fn status_cn(status: &str) -> &str {
    match status {
        "pending" => "待办",
        "in_progress" => "进行中",
        "completed" => "已完成",
        "cancelled" => "已取消",
        _ => status,
    }
}

pub fn memory_type_label(memory_type: &str) -> &str {
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

pub const VALID_MEMORY_TYPES: &[&str] = &[
    "identity", "interest", "taste", "habit", "personality",
    "relationship", "status", "goal", "event", "other",
];

pub fn format_xp_result(result: &crate::db::repositories::task_repo::CompleteResult) -> String {
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

// ========== 任务搜索辅助 ==========

pub fn scored_search(
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

pub fn classify_matches(scored: &[(Task, i32)]) -> MatchResult {
    let n = scored.len();
    match n {
        0 => MatchResult::None,
        1 => MatchResult::Unique(0),
        2..=5 => {
            if scored[0].1 >= scored[1].1 * 2 && scored[0].1 > 0 {
                MatchResult::Unique(0)
            } else {
                MatchResult::Ambiguous
            }
        }
        _ => {
            if scored[0].1 >= scored[1].1 * 2 && scored[0].1 > 0 {
                MatchResult::Unique(0)
            } else {
                MatchResult::TooMany(n)
            }
        }
    }
}

pub fn format_task_for_ai(task: &Task, index: usize) -> String {
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

// ========== 日程搜索辅助 ==========

pub fn find_schedule_by_title(
    conn: &Connection,
    query: &str,
) -> Result<(Vec<schedule_repo::Schedule>, usize), String> {
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

pub fn extract_base_id(id: &str) -> &str {
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

pub fn rrule_to_human(rrule: &str) -> String {
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

// ========== 习惯搜索辅助 ==========

pub fn find_habit_by_query(conn: &Connection, habit_id: &Option<String>, query: &Option<String>) -> Result<habit_repo::Habit, String> {
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
