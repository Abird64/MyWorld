use std::path::Path;

use rusqlite::Connection;
use serde::Deserialize;

use crate::db::repositories::journal_repo;

use super::shared::{format_xp_result, XpAllocation};

// ── 参数 ──

#[derive(Debug, Deserialize)]
pub struct ToolDateArgs {
    pub date: String,
}

#[derive(Debug, Deserialize)]
pub struct ToolSaveJournalArgs {
    pub date: String,
    pub content: String,
    #[serde(default)]
    pub mood: Option<String>,
    #[serde(default)]
    pub tags: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ToolTimelineArgs {
    pub year: i32,
    pub month: i32,
}

#[derive(Debug, Deserialize)]
pub struct ToolSearchJournalsArgs {
    pub query: String,
    #[serde(default)]
    pub limit: Option<usize>,
}

// ── 执行函数 ──

pub fn execute_get_journal(conn: &Connection, _app_data_dir: Option<&Path>, arguments: &str) -> Result<String, String> {
    let args: ToolDateArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("get_journal_by_date 参数解析失败: {}", e))?;

    let journal_opt = journal_repo::get_journal_by_date(conn, &args.date)?;

    match journal_opt {
        None => Ok(format!("{} 还没有日记。想说点什么吗？", args.date)),
        Some(journal) => {
            let content = std::fs::read_to_string(&journal.file_path)
                .unwrap_or_else(|_| "(文件读取失败)".to_string());

            let truncated = if content.chars().count() > 3000 {
                let truncated: String = content.chars().take(3000).collect();
                format!("{}...\n\n(日记较长，已截断前3000字符)", truncated)
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

pub fn execute_search_journals(conn: &Connection, app_data_dir: Option<&Path>, arguments: &str) -> Result<String, String> {
    let args: ToolSearchJournalsArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("search_journals 参数解析失败: {}", e))?;

    let app_data_dir = app_data_dir.ok_or("app_data_dir 不可用")?;
    let limit = args.limit.unwrap_or(3).min(10);

    let results = journal_repo::search_journals(conn, app_data_dir, &args.query, limit)?;

    if results.is_empty() {
        return Ok(format!("没有找到与[{}]相关的日记。", args.query));
    }

    let mut output = format!("找到 {} 条与[{}]相关的日记：\n\n", results.len(), args.query);
    for (i, r) in results.iter().enumerate() {
        output.push_str(&format!(
            "{}. [{}] {}\n   {}\n\n",
            i + 1,
            r.journal.journal_date,
            r.journal.title,
            r.snippet
        ));
    }

    Ok(output)
}

pub fn execute_save_journal(conn: &Connection, app_data_dir: Option<&Path>, arguments: &str) -> Result<String, String> {
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

pub fn execute_get_timeline(conn: &Connection, arguments: &str) -> Result<String, String> {
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

pub fn execute_settle_diary(conn: &mut Connection, arguments: &str) -> Result<String, String> {
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
