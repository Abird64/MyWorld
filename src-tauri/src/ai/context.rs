use std::path::Path;
use rusqlite::Connection;

use crate::db::repositories::{
    contact_repo, journal_repo, memory_repo, task_repo,
};

use super::router::IntentAnalysis;

/// 搜索到的相关上下文数据
#[derive(Debug, Clone)]
pub struct ContextBundle {
    /// 相关小本本（去重，最多 10 条）
    pub memories: Vec<memory_repo::Memory>,
    /// 相关任务（最多 5 条）
    pub tasks: Vec<task_repo::Task>,
    /// 相关日记片段（最多 3 段，含日期+上下文）
    pub journal_snippets: Vec<JournalSnippet>,
    /// 相关联系人（最多 3 人）
    pub contacts: Vec<contact_repo::Contact>,
}

#[derive(Debug, Clone)]
pub struct JournalSnippet {
    pub date: String,
    pub title: String,
    pub snippet: String,
}

/// 根据意图分析结果搜索相关数据
pub fn gather_context(
    conn: &Connection,
    app_data_dir: &Path,
    analysis: &IntentAnalysis,
) -> ContextBundle {
    let mut memories = Vec::new();
    let mut tasks = Vec::new();
    let mut journal_snippets = Vec::new();
    let mut contacts = Vec::new();

    // 搜索小本本记忆
    for keyword in &analysis.keywords {
        if memories.len() >= 10 { break; }
        if let Ok(results) = memory_repo::search_memories(conn, keyword, None) {
            for m in results {
                if memories.len() >= 10 { break; }
                if !memories.iter().any(|existing: &memory_repo::Memory| existing.id == m.id) {
                    memories.push(m);
                }
            }
        }
    }

    // 搜索任务
    for keyword in &analysis.keywords {
        if tasks.len() >= 5 { break; }
        if let Ok(results) = task_repo::search_tasks(conn, keyword) {
            for t in results {
                if tasks.len() >= 5 { break; }
                if !tasks.iter().any(|existing: &task_repo::Task| existing.id == t.id) {
                    tasks.push(t);
                }
            }
        }
    }

    // 搜索日记
    for query in &analysis.journal_queries {
        if journal_snippets.len() >= 3 { break; }
        let remaining = 3 - journal_snippets.len();
        if let Ok(results) = journal_repo::search_journals(conn, app_data_dir, query, remaining) {
            for r in results {
                if journal_snippets.len() >= 3 { break; }
                journal_snippets.push(JournalSnippet {
                    date: r.journal.journal_date,
                    title: r.journal.title,
                    snippet: r.snippet,
                });
            }
        }
    }

    // 搜索联系人（只在关键词可能包含人名时搜索）
    for keyword in &analysis.keywords {
        if contacts.len() >= 3 { break; }
        // 简单判断：中文关键词且长度 2-4 字可能是人名
        let is_likely_name = keyword.chars().count() >= 2 && keyword.chars().count() <= 4
            && keyword.chars().all(|c| c.is_ascii_alphanumeric() || ('\u{4e00}' <= c && c <= '\u{9fff}'));
        if is_likely_name {
            if let Ok(results) = contact_repo::search_contacts(conn, keyword) {
                for c in results {
                    if contacts.len() >= 3 { break; }
                    if !contacts.iter().any(|existing: &contact_repo::Contact| existing.id == c.id) {
                        contacts.push(c);
                    }
                }
            }
        }
    }

    ContextBundle {
        memories,
        tasks,
        journal_snippets,
        contacts,
    }
}
