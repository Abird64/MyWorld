use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Journal {
    pub id: String,
    pub title: String,
    pub summary: Option<String>,
    pub file_path: String,
    pub mood: Option<String>,
    pub journal_date: String,
    pub word_count: i32,
    pub entry_type: String,
    pub tags: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

const JOURNAL_COLUMNS: &str =
    "id, title, summary, file_path, mood, journal_date, word_count, entry_type, tags, created_at, updated_at";

fn journal_from_row(row: &Row) -> rusqlite::Result<Journal> {
    Ok(Journal {
        id: row.get("id")?,
        title: row.get("title")?,
        summary: row.get("summary")?,
        file_path: row.get("file_path")?,
        mood: row.get("mood")?,
        journal_date: row.get("journal_date")?,
        word_count: row.get("word_count")?,
        entry_type: row.get("entry_type")?,
        tags: row.get("tags")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn now() -> String {
    chrono::Local::now().to_rfc3339()
}

fn gen_id() -> String {
    nanoid::nanoid!()
}

// ─── 文件系统辅助 ───

/// 将日期解析为文件路径: journals/YYYY/MM/YYYY-MM-DD[-ai].md
pub fn date_to_file_path(app_data_dir: &Path, date: &str, is_ai: bool) -> PathBuf {
    // date 格式: "YYYY-MM-DD"
    let parts: Vec<&str> = date.split('-').collect();
    let (year, month) = if parts.len() >= 2 {
        (parts[0], parts[1])
    } else {
        ("unknown", "unknown")
    };

    let suffix = if is_ai { "-ai" } else { "" };
    let filename = format!("{}{}.md", date, suffix);

    app_data_dir
        .join("journals")
        .join(year)
        .join(month)
        .join(filename)
}

/// 写入 .md 文件（含 frontmatter）
///
/// 在 Android 上 app_data_dir 可能指向只读分区，
/// 如果写入失败会尝试降级到 cache_dir / temp_dir。
/// 返回实际写入的路径（可能是原始路径或降级路径）。
pub fn write_md_file(
    path: &Path,
    date: &str,
    mood: Option<&str>,
    tags: Option<&str>,
    word_count: i32,
    entry_type: &str,
    body: &str,
) -> Result<PathBuf, String> {
    let content = build_md_content(date, mood, tags, word_count, entry_type, body);

    // 尝试写入目标路径
    if let Err(e) = try_write_file(path, &content) {
        // Android 上 app_data_dir 可能只读，尝试降级
        log::warn!("日记写入失败 {:?}: {}，尝试降级路径", path, e);

        if let Some(relative) = extract_journals_relative(path) {
            let fallback_dirs = [
                std::path::PathBuf::from("/data/data/com.lantern.app/cache"),
                std::env::temp_dir(),
            ];
            for fallback_dir in &fallback_dirs {
                let fallback_path = fallback_dir.join("lantern_journals").join(&relative);
                if try_write_file(&fallback_path, &content).is_ok() {
                    log::warn!("日记降级写入成功: {:?}", fallback_path);
                    return Ok(fallback_path);
                }
            }
        }

        return Err(format!(
            "日记写入失败 (path: {:?}): {}",
            path, e
        ));
    }

    Ok(path.to_path_buf())
}

/// 构建 .md 文件内容（含 frontmatter）
fn build_md_content(
    date: &str,
    mood: Option<&str>,
    tags: Option<&str>,
    word_count: i32,
    entry_type: &str,
    body: &str,
) -> String {
    let tags_yaml = match tags {
        Some(t) if !t.is_empty() => {
            let parsed: Vec<String> =
                serde_json::from_str(t).unwrap_or_default();
            if parsed.is_empty() {
                "[]".to_string()
            } else {
                format!(
                    "\n{}",
                    parsed
                        .iter()
                        .map(|t| format!("  - \"{}\"", t))
                        .collect::<Vec<_>>()
                        .join("\n")
                )
            }
        }
        _ => "[]".to_string(),
    };

    let mood_str = match mood {
        Some(m) => format!("\"{}\"", m),
        None => "null".to_string(),
    };

    format!(
        "---\ndate: \"{}\"\nmood: {}\ntags:{}\nword_count: {}\ntype: \"{}\"\n---\n\n{}",
        date, mood_str, tags_yaml, word_count, entry_type, body
    )
}

/// 尝试创建目录并写入文件
fn try_write_file(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("mkdir {:?}: {}", parent, e))?;
    }
    std::fs::write(path, content)
        .map_err(|e| format!("write {:?}: {}", path, e))
}

/// 从完整路径中提取 journals/ 相对路径部分
fn extract_journals_relative(path: &Path) -> Option<std::path::PathBuf> {
    let components: Vec<_> = path.components().collect();
    let journals_idx = components.iter().position(|c| {
        c.as_os_str() == "journals"
    })?;
    let relative: std::path::PathBuf = components[journals_idx..].iter().collect();
    Some(relative)
}

/// 检查降级路径中是否有该文件（用于 read 时降级查找）
fn find_in_fallback_dirs(original_path: &Path) -> Option<std::path::PathBuf> {
    let relative = extract_journals_relative(original_path)?;
    let fallback_dirs = [
        std::path::PathBuf::from("/data/data/com.lantern.app/cache"),
        std::env::temp_dir(),
    ];
    for dir in &fallback_dirs {
        let candidate = dir.join("lantern_journals").join(&relative);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

/// 读取 .md 文件，返回 body 内容（去掉 frontmatter）
/// 如果文件不存在，尝试降级路径
pub fn read_md_file(path: &Path) -> Result<String, String> {
    // 先尝试原始路径
    let actual_path = if path.exists() {
        path.to_path_buf()
    } else if let Some(fallback) = find_in_fallback_dirs(path) {
        fallback
    } else {
        return Ok(String::new());
    };

    let content =
        std::fs::read_to_string(&actual_path).map_err(|e| format!("Failed to read journal file: {}", e))?;

    // 解析 frontmatter：找到第二个 "---" 分隔符
    let body = if content.starts_with("---") {
        if let Some(second_dash) = content[3..].find("---") {
            let after_front = 3 + second_dash + 3;
            // 跳过 frontmatter 后面的空行
            content[after_front..].trim_start().to_string()
        } else {
            content
        }
    } else {
        content
    };

    Ok(body)
}

// ─── 数据库操作 ───

/// 根据日期获取或创建日记（仅元数据，不含文件内容）
pub fn get_or_create_journal(
    conn: &Connection,
    app_data_dir: &Path,
    date: &str,
) -> Result<Journal, String> {
    // 先查
    if let Some(journal) = get_journal_by_date(conn, date)? {
        return Ok(journal);
    }

    // 不存在则创建
    let id = gen_id();
    let time = now();
    let file_path = date_to_file_path(app_data_dir, date, false);
    let file_path_str = file_path.to_string_lossy().to_string();
    let title = format!("{} 尘笺", date);

    conn.execute(
        "INSERT INTO journals (id, title, summary, file_path, mood, journal_date, word_count, entry_type, tags, created_at, updated_at)
         VALUES (?1, ?2, NULL, ?3, NULL, ?4, 0, 'user', NULL, ?5, ?6)",
        params![id, title, file_path_str, date, time, time],
    )
    .map_err(|e| format!("Failed to create journal: {}", e))?;

    // 创建空的 .md 文件
    let actual_path = write_md_file(&file_path, date, None, None, 0, "user", "")?;

    // 如果写入到了降级路径，更新 DB 中的 file_path
    if actual_path != file_path {
        let actual_str = actual_path.to_string_lossy().to_string();
        log::warn!("[journal] updating file_path from {:?} to {:?}", file_path, actual_path);
        conn.execute(
            "UPDATE journals SET file_path = ?1 WHERE id = ?2",
            params![actual_str, id],
        )
        .map_err(|e| format!("Failed to update journal file_path: {}", e))?;
    }

    get_journal_by_date(conn, date)?
        .ok_or_else(|| "Failed to retrieve created journal".to_string())
}

/// 根据日期获取日记（不自动创建）
pub fn get_journal_by_date(
    conn: &Connection,
    date: &str,
) -> Result<Option<Journal>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM journals WHERE journal_date = ?1 AND entry_type = 'user' AND deleted_at IS NULL",
            JOURNAL_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut rows = stmt
        .query_map(params![date], journal_from_row)
        .map_err(|e| format!("Failed to query journal: {}", e))?;

    match rows.next() {
        Some(row) => Ok(Some(
            row.map_err(|e| format!("Failed to read journal row: {}", e))?,
        )),
        None => Ok(None),
    }
}

/// 更新日记文件路径（降级写入时使用）
pub fn update_journal_file_path(
    conn: &Connection,
    id: &str,
    new_path: &Path,
) -> Result<(), String> {
    let path_str = new_path.to_string_lossy().to_string();
    conn.execute(
        "UPDATE journals SET file_path = ?1 WHERE id = ?2",
        params![path_str, id],
    )
    .map_err(|e| format!("Failed to update journal file_path: {}", e))?;
    Ok(())
}

/// 更新日记元数据
pub fn update_journal_metadata(
    conn: &Connection,
    id: &str,
    title: Option<&str>,
    mood: Option<&str>,
    tags: Option<&str>,
    word_count: i32,
) -> Result<Journal, String> {
    let time = now();

    let mut sets: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(v) = title {
        sets.push("title = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = mood {
        sets.push("mood = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = tags {
        sets.push("tags = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }

    sets.push("word_count = ?".to_string());
    param_values.push(Box::new(word_count));

    sets.push("updated_at = ?".to_string());
    param_values.push(Box::new(time));

    param_values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE journals SET {} WHERE id = ?",
        sets.join(", ")
    );

    let param_refs: Vec<&dyn rusqlite::ToSql> = param_values
        .iter()
        .map(|v| v.as_ref() as &dyn rusqlite::ToSql)
        .collect();

    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update journal metadata: {}", e))?;

    // 返回更新后的 journal
    conn.query_row(
        &format!("SELECT {} FROM journals WHERE id = ?1 AND deleted_at IS NULL", JOURNAL_COLUMNS),
        params![id],
        journal_from_row,
    )
    .map_err(|e| format!("Failed to retrieve updated journal: {}", e))
}

/// 获取某月有日记的日期列表
pub fn get_timeline_entries(
    conn: &Connection,
    year: i32,
    month: i32,
) -> Result<Vec<String>, String> {
    let pattern = format!("{}-{:02}-%", year, month);

    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT journal_date FROM journals WHERE journal_date LIKE ?1 AND entry_type = 'user' AND deleted_at IS NULL ORDER BY journal_date",
        )
        .map_err(|e| format!("Failed to prepare timeline query: {}", e))?;

    let dates = stmt
        .query_map(params![pattern], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query timeline: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect timeline: {}", e))?;

    Ok(dates)
}

/// 删除日记（DB + 文件）
#[allow(dead_code)]
pub fn delete_journal(
    conn: &Connection,
    app_data_dir: &Path,
    id: &str,
    date: &str,
) -> Result<(), String> {
    // 软删除 DB 记录
    let time = now();
    conn.execute("UPDATE journals SET deleted_at = ?1 WHERE id = ?2", params![time, id])
        .map_err(|e| format!("Failed to delete journal: {}", e))?;

    // 删除文件
    let file_path = date_to_file_path(app_data_dir, date, false);
    if file_path.exists() {
        let _ = std::fs::remove_file(file_path);
    }

    // 也尝试删除 AI 文件
    let ai_path = date_to_file_path(app_data_dir, date, true);
    if ai_path.exists() {
        let _ = std::fs::remove_file(ai_path);
    }

    Ok(())
}

/// 保存 AI 日记元数据（如果不存在则创建）
pub fn save_ai_diary_meta(
    conn: &Connection,
    app_data_dir: &Path,
    date: &str,
) -> Result<Journal, String> {
    // 检查是否已有 AI 日记
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM journals WHERE journal_date = ?1 AND entry_type = 'ai' AND deleted_at IS NULL",
            JOURNAL_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut rows = stmt
        .query_map(params![date], journal_from_row)
        .map_err(|e| format!("Failed to query ai journal: {}", e))?;

    if let Some(row) = rows.next() {
        return row.map_err(|e| format!("Failed to read ai journal: {}", e));
    }

    // 创建新的 AI 日记记录
    let id = gen_id();
    let time = now();
    let file_path = date_to_file_path(app_data_dir, date, true);
    let file_path_str = file_path.to_string_lossy().to_string();
    let title = format!("{} AI尘笺", date);

    conn.execute(
        "INSERT INTO journals (id, title, summary, file_path, mood, journal_date, word_count, entry_type, tags, created_at, updated_at)
         VALUES (?1, ?2, NULL, ?3, NULL, ?4, 0, 'ai', NULL, ?5, ?6)",
        params![id, title, file_path_str, date, time, time],
    )
    .map_err(|e| format!("Failed to create ai journal: {}", e))?;

    conn.query_row(
        &format!("SELECT {} FROM journals WHERE id = ?1 AND deleted_at IS NULL", JOURNAL_COLUMNS),
        params![id],
        journal_from_row,
    )
    .map_err(|e| format!("Failed to retrieve created ai journal: {}", e))
}

/// 日记 XP 结算（默认分配：6属性各+1）
/// 每日一次，日省按钮直接调用此函数
pub fn complete_diary(
    conn: &mut Connection,
    date: &str,
) -> Result<super::task_repo::CompleteResult, String> {
    let default_allocations: Vec<(String, i32)> = [
        "focus", "vitality", "empathy", "creativity", "insight", "expression",
    ]
    .iter()
    .map(|s| (s.to_string(), 1))
    .collect();
    complete_diary_with_xp(conn, date, &default_allocations)
}

/// 日记 XP 结算（AI 指定分配）
/// allocations: [(skill_id, xp_amount)]，总XP 3-10，单属性上限5
pub fn complete_diary_with_xp(
    conn: &mut Connection,
    date: &str,
    allocations: &[(String, i32)],
) -> Result<super::task_repo::CompleteResult, String> {
    let task_title = format!("{} 日省", date);

    // 检查是否已经结算过（虚拟任务已完成）
    {
        let mut stmt = conn
            .prepare("SELECT id FROM tasks WHERE title = ?1 AND status = 'completed' AND deleted_at IS NULL")
            .map_err(|e| format!("Failed to check diary task: {}", e))?;

        let mut rows = stmt
            .query_map(params![task_title], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Failed to query diary task: {}", e))?;

        if rows.next().is_some() {
            return Err("今日已结算 XP".to_string());
        }
    }

    let time = now();

    // 奖励日记萤火：固定20萤火
    conn.execute(
        "UPDATE glow_balances SET glow_amount = glow_amount + 20, updated_at = ?1 WHERE id = 'user'",
        params![time],
    )
    .map_err(|e| format!("Failed to add diary glow reward: {}", e))?;

    // 记录萤火账本
    {
        let balance_after: i32 = conn
            .query_row("SELECT glow_amount FROM glow_balances WHERE id = 'user'", [], |row| row.get(0))
            .unwrap_or(0);
        let ledger_id = gen_id();
        conn.execute(
            "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
             VALUES (?1, 'glow', 20, ?2, 'diary_settle', ?3, ?4, ?5)",
            params![ledger_id, balance_after, format!("「{}」日省结算", date), date, time],
        )
        .map_err(|e| format!("Failed to record diary ledger: {}", e))?;
    }

    // 创建虚拟任务
    let task_id = gen_id();

    conn.execute(
        "INSERT INTO tasks (id, title, status, created_at, updated_at)
         VALUES (?1, ?2, 'pending', ?3, ?4)",
        params![task_id, task_title, time, time],
    )
    .map_err(|e| format!("Failed to create diary task: {}", e))?;

    // 写入 AI 分配的 XP
    for (skill_id, xp_amount) in allocations {
        let link_id = gen_id();
        let time = now();
        conn.execute(
            "INSERT INTO task_skills (id, task_id, skill_id, xp_amount, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![link_id, task_id, skill_id, xp_amount, time],
        )
        .map_err(|e| format!("Failed to link diary task skill: {}", e))?;
    }

    // 复用 complete_task 完成 XP 结算
    let result = super::task_repo::complete_task(conn, &task_id)?;

    // 返回包含日记萤火奖励的结果
    Ok(super::task_repo::CompleteResult {
        xp_earned: result.xp_earned,
        glow_earned: result.glow_earned + 20, // 额外20萤火
        skill_xps: result.skill_xps,
    })
}

/// 日记搜索结果（含上下文片段）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JournalSearchResult {
    pub journal: Journal,
    pub snippet: String, // 匹配的上下文片段（前后各 50 字）
}

/// 搜索日记：查 DB 的 title/summary + 读 .md 文件内容做 LIKE 匹配
/// 返回带上下文片段的搜索结果，最多 limit 条
pub fn search_journals(
    conn: &Connection,
    app_data_dir: &Path,
    query: &str,
    limit: usize,
) -> Result<Vec<JournalSearchResult>, String> {
    let pattern = format!("%{}%", query);
    let query_lower = query.to_lowercase();

    // 1. 先从 DB 搜索 title/summary 命中的
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM journals WHERE (title LIKE ?1 OR summary LIKE ?1) AND entry_type = 'user' AND deleted_at IS NULL ORDER BY journal_date DESC",
            JOURNAL_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare journal search: {}", e))?;

    let db_hits: Vec<Journal> = stmt
        .query_map(params![pattern], journal_from_row)
        .map_err(|e| format!("Failed to search journals: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect journal search: {}", e))?;

    let mut results: Vec<JournalSearchResult> = Vec::new();
    let mut seen_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

    // DB 命中的，生成 snippet
    for journal in db_hits {
        if results.len() >= limit { break; }
        seen_ids.insert(journal.id.clone());
        let snippet = if let Some(ref summary) = journal.summary {
            if summary.to_lowercase().contains(&query_lower) {
                extract_snippet(summary, query)
            } else {
                // title 命中，snippet 用 title + summary
                journal.summary.clone().unwrap_or_default()
            }
        } else {
            journal.title.clone()
        };
        results.push(JournalSearchResult { journal, snippet });
    }

    // 2. 遍历最近的日记文件，在内容中搜索
    if results.len() < limit {
        let mut stmt2 = conn
            .prepare(&format!(
                "SELECT {} FROM journals WHERE entry_type = 'user' AND deleted_at IS NULL ORDER BY journal_date DESC LIMIT 100",
                JOURNAL_COLUMNS
            ))
            .map_err(|e| format!("Failed to prepare journal scan: {}", e))?;

        let recent: Vec<Journal> = stmt2
            .query_map([], journal_from_row)
            .map_err(|e| format!("Failed to scan journals: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect journals: {}", e))?;

        for journal in recent {
            if results.len() >= limit { break; }
            if seen_ids.contains(&journal.id) { continue; }

            // 读取文件内容（支持降级路径）
            let file_path = if std::path::Path::new(&journal.file_path).is_absolute() {
                std::path::PathBuf::from(&journal.file_path)
            } else {
                app_data_dir.join(&journal.file_path)
            };
            let actual_path = if file_path.exists() {
                file_path.clone()
            } else if let Some(fb) = find_in_fallback_dirs(&file_path) {
                fb
            } else {
                file_path.clone()
            };
            if let Ok(content) = read_md_file(&actual_path) {
                if content.to_lowercase().contains(&query_lower) {
                    let snippet = extract_snippet(&content, query);
                    seen_ids.insert(journal.id.clone());
                    results.push(JournalSearchResult { journal, snippet });
                }
            }
        }
    }

    Ok(results)
}

/// 从文本中提取匹配关键词的上下文片段（前后各 50 字）
fn extract_snippet(text: &str, query: &str) -> String {
    let lower = text.to_lowercase();
    let query_lower = query.to_lowercase();

    if let Some(pos) = lower.find(&query_lower) {
        let start = text[..pos].char_indices()
            .nth_back(50)
            .map(|(i, _)| i)
            .unwrap_or(0);
        let end_pos = pos + query.len();
        let end = text[end_pos..].char_indices()
            .nth(50)
            .map(|(i, _)| end_pos + i)
            .unwrap_or(text.len());

        let mut snippet = String::new();
        if start > 0 { snippet.push_str("..."); }
        snippet.push_str(&text[start..end]);
        if end < text.len() { snippet.push_str("..."); }
        snippet
    } else {
        // fallback: 取前 100 字
        let end = text.char_indices()
            .nth(100)
            .map(|(i, _)| i)
            .unwrap_or(text.len());
        text[..end].to_string()
    }
}

/// 获取日记总天数
pub fn get_journal_count(conn: &Connection) -> Result<i32, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM journals WHERE deleted_at IS NULL",
        [],
        |row| row.get(0),
    )
    .map_err(|e| format!("Failed to count journals: {}", e))
}

// ========== 日记图片 CRUD ==========

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JournalImage {
    pub id: String,
    pub journal_id: String,
    pub file_path: String,
    pub file_name: String,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
    pub sort_order: i32,
    pub created_at: String,
}

fn journal_image_from_row(row: &Row) -> rusqlite::Result<JournalImage> {
    Ok(JournalImage {
        id: row.get("id")?,
        journal_id: row.get("journal_id")?,
        file_path: row.get("file_path")?,
        file_name: row.get("file_name")?,
        mime_type: row.get("mime_type")?,
        file_size: row.get("file_size")?,
        sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?,
    })
}

/// 保存图片记录到数据库
pub fn create_journal_image(
    conn: &Connection,
    journal_id: &str,
    file_path: &str,
    file_name: &str,
    mime_type: Option<&str>,
    file_size: Option<i64>,
) -> Result<JournalImage, String> {
    let id = nanoid::nanoid!();
    let ts = chrono::Local::now().to_rfc3339();

    // 获取当前最大 sort_order
    let max_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM journal_images WHERE journal_id = ?1",
            params![journal_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO journal_images (id, journal_id, file_path, file_name, mime_type, file_size, sort_order, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, journal_id, file_path, file_name, mime_type, file_size, max_order + 1, ts],
    )
    .map_err(|e| e.to_string())?;

    Ok(JournalImage {
        id,
        journal_id: journal_id.to_string(),
        file_path: file_path.to_string(),
        file_name: file_name.to_string(),
        mime_type: mime_type.map(|s| s.to_string()),
        file_size,
        sort_order: max_order + 1,
        created_at: ts,
    })
}

/// 获取日记的所有图片
pub fn get_journal_images(conn: &Connection, journal_id: &str) -> Result<Vec<JournalImage>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, journal_id, file_path, file_name, mime_type, file_size, sort_order, created_at
             FROM journal_images WHERE journal_id = ?1 ORDER BY sort_order ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![journal_id], journal_image_from_row)
        .map_err(|e| e.to_string())?;

    let mut images = Vec::new();
    for row in rows {
        images.push(row.map_err(|e| e.to_string())?);
    }
    Ok(images)
}

/// 删除图片记录
pub fn delete_journal_image(conn: &Connection, image_id: &str) -> Result<String, String> {
    // 先获取文件路径，方便调用方删除物理文件
    let file_path: String = conn
        .query_row(
            "SELECT file_path FROM journal_images WHERE id = ?1",
            params![image_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Image {} not found: {}", image_id, e))?;

    conn.execute("DELETE FROM journal_images WHERE id = ?1", params![image_id])
        .map_err(|e| e.to_string())?;

    Ok(file_path)
}
