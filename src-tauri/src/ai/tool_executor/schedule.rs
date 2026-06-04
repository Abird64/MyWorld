use chrono::{Local, NaiveDate};
use rusqlite::Connection;
use serde::Deserialize;

use crate::db::repositories::{calendar_repo, schedule_repo};

use super::shared::{extract_base_id, find_schedule_by_title, rrule_to_human, ToolQueryOrIdArgs};

// ── 参数 ──

#[derive(Debug, Deserialize)]
pub struct ToolCreateScheduleArgs {
    pub title: String,
    pub start_at: String,
    #[serde(default)]
    pub end_at: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_all_day: Option<bool>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub calendar_id: Option<String>,
    #[serde(default)]
    pub rrule: Option<String>,
    #[serde(default)]
    pub reminder: Option<String>,
    #[serde(default)]
    pub event_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ToolRangeArgs {
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Deserialize)]
pub struct ToolUpdateScheduleArgs {
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub start_at: Option<String>,
    #[serde(default)]
    pub end_at: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub calendar_id: Option<String>,
    #[serde(default)]
    pub is_all_day: Option<bool>,
}

// ── 执行函数 ──

pub fn execute_create_schedule(conn: &Connection, arguments: &str) -> Result<String, String> {
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

pub fn execute_list_schedules(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolRangeArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("list_schedules_in_range 参数解析失败: {}", e))?;

    let schedules = schedule_repo::list_schedules_in_range(conn, &args.start_date, &args.end_date)?;

    if schedules.is_empty() {
        return Ok(format!("{} 到 {} 之间没有日程安排。", args.start_date, args.end_date));
    }

    let mut result = format!("{} 到 {} 共有{}个日程：\n\n", args.start_date, args.end_date, schedules.len());
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

pub fn execute_list_calendars(conn: &Connection) -> Result<String, String> {
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

pub fn execute_update_schedule(conn: &Connection, arguments: &str) -> Result<String, String> {
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

pub fn execute_delete_schedule(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolQueryOrIdArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("delete_schedule 参数解析失败: {}", e))?;

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

// ========== 倒数日 ==========

pub fn execute_list_countdowns(conn: &Connection) -> Result<String, String> {
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
