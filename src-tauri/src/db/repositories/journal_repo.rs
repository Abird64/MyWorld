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
pub fn write_md_file(
    path: &Path,
    date: &str,
    mood: Option<&str>,
    tags: Option<&str>,
    word_count: i32,
    entry_type: &str,
    body: &str,
) -> Result<(), String> {
    // 确保父目录存在
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create journal dir: {}", e))?;
    }

    let tags_yaml = match tags {
        Some(t) if !t.is_empty() => {
            // tags 是 JSON 数组字符串，转成 YAML 列表
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

    let content = format!(
        "---\ndate: \"{}\"\nmood: {}\ntags:{}\nword_count: {}\ntype: \"{}\"\n---\n\n{}",
        date, mood_str, tags_yaml, word_count, entry_type, body
    );

    std::fs::write(path, content).map_err(|e| format!("Failed to write journal file: {}", e))
}

/// 读取 .md 文件，返回 (body内容, frontmatter解析结果)
/// 如果文件不存在，返回空内容
pub fn read_md_file(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Ok(String::new());
    }

    let content =
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read journal file: {}", e))?;

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
    write_md_file(&file_path, date, None, None, 0, "user", "")?;

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
            "SELECT {} FROM journals WHERE journal_date = ?1 AND entry_type = 'user'",
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
        &format!("SELECT {} FROM journals WHERE id = ?1", JOURNAL_COLUMNS),
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
            "SELECT DISTINCT journal_date FROM journals WHERE journal_date LIKE ?1 AND entry_type = 'user' ORDER BY journal_date",
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
    // 删除 DB 记录
    conn.execute("DELETE FROM journals WHERE id = ?1", params![id])
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
            "SELECT {} FROM journals WHERE journal_date = ?1 AND entry_type = 'ai'",
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
        &format!("SELECT {} FROM journals WHERE id = ?1", JOURNAL_COLUMNS),
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
        "knowledge", "physique", "charm", "talent", "worldliness", "cultivation",
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
            .prepare("SELECT id FROM tasks WHERE title = ?1 AND status = 'completed'")
            .map_err(|e| format!("Failed to check diary task: {}", e))?;

        let mut rows = stmt
            .query_map(params![task_title], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Failed to query diary task: {}", e))?;

        if rows.next().is_some() {
            return Err("今日已结算 XP".to_string());
        }
    }

    // 创建虚拟任务
    let task_id = gen_id();
    let time = now();

    conn.execute(
        "INSERT INTO tasks (id, title, status, created_at, updated_at)
         VALUES (?1, ?2, 'pending', ?3, ?4)",
        params![task_id, task_title, time, time],
    )
    .map_err(|e| format!("Failed to create diary task: {}", e))?;

    // 写入 AI 分配的 XP
    for (skill_id, xp_amount) in allocations {
        let link_id = gen_id();
        conn.execute(
            "INSERT INTO task_skills (id, task_id, skill_id, xp_amount) VALUES (?1, ?2, ?3, ?4)",
            params![link_id, task_id, skill_id, xp_amount],
        )
        .map_err(|e| format!("Failed to link diary task skill: {}", e))?;
    }

    // 复用 complete_task 完成 XP 结算
    super::task_repo::complete_task(conn, &task_id)
}
