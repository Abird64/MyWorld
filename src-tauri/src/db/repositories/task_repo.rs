use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use crate::sync::change_tracking::{next_db_version, record_change, ensure_site_id};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: Option<String>,
    pub scheduled_at: Option<String>,
    pub deadline: Option<String>,
    pub completed_at: Option<String>,
    pub xp_earned: i32,
    pub estimated_minutes: i32,
    pub notes: Option<String>,
    pub tags: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

const TASK_COLUMNS: &str = "id, parent_id, title, description, status, priority, scheduled_at, deadline, completed_at, xp_earned, estimated_minutes, notes, tags, sort_order, created_at, updated_at";

fn task_from_row(row: &Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get("id")?,
        parent_id: row.get("parent_id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        status: row.get("status")?,
        priority: row.get("priority")?,
        scheduled_at: row.get("scheduled_at")?,
        deadline: row.get("deadline")?,
        completed_at: row.get("completed_at")?,
        xp_earned: row.get("xp_earned")?,
        estimated_minutes: row.get("estimated_minutes")?,
        notes: row.get("notes")?,
        tags: row.get("tags")?,
        sort_order: row.get("sort_order")?,
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

/// 创建任务
pub fn create_task(
    conn: &Connection,
    title: &str,
    parent_id: Option<&str>,
    description: Option<&str>,
    priority: Option<&str>,
    scheduled_at: Option<&str>,
    deadline: Option<&str>,
    estimated_minutes: i32,
    tags: Option<&str>,
) -> Result<Task, String> {
    let id = gen_id();
    let time = now();

    conn.execute(
        "INSERT INTO tasks (id, parent_id, title, description, status, priority, scheduled_at, deadline, estimated_minutes, tags, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![id, parent_id, title, description, priority, scheduled_at, deadline, estimated_minutes, tags, time, time],
    )
    .map_err(|e| format!("Failed to create task: {}", e))?;

    // 记录变更
    let db_version = next_db_version(conn)?;
    let site_id = ensure_site_id(conn);
    let pk_json = serde_json::json!({"id": &id}).to_string();
    record_change(conn, "tasks", &pk_json, None, None, db_version, &site_id, 1, false)?;

    get_task(conn, &id)
}

/// 获取单个任务
pub fn get_task(conn: &Connection, id: &str) -> Result<Task, String> {
    conn.query_row(
        &format!("SELECT {} FROM tasks WHERE id = ?1 AND deleted_at IS NULL", TASK_COLUMNS),
        params![id],
        task_from_row,
    )
    .map_err(|e| format!("Task not found: {}", e))
}

/// 获取所有任务 (可按状态筛选)
pub fn list_tasks(
    conn: &Connection,
    status: Option<&str>,
    parent_id: Option<Option<&str>>,
) -> Result<Vec<Task>, String> {
    let mut sql = format!(
        "SELECT {} FROM tasks WHERE deleted_at IS NULL",
        TASK_COLUMNS
    );
    let mut params_vec: Vec<String> = Vec::new();

    if let Some(s) = status {
        sql.push_str(" AND status = ?");
        params_vec.push(s.to_string());
    }

    match parent_id {
        Some(Some(pid)) => {
            sql.push_str(" AND parent_id = ?");
            params_vec.push(pid.to_string());
        }
        Some(None) => {
            sql.push_str(" AND parent_id IS NULL");
        }
        None => {}
    }

    sql.push_str(" ORDER BY sort_order ASC, created_at DESC");

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let tasks = stmt
        .query_map(param_refs.as_slice(), task_from_row)
        .map_err(|e| format!("Failed to query tasks: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect tasks: {}", e))?;

    Ok(tasks)
}

/// 更新任务
pub fn update_task(
    conn: &Connection,
    id: &str,
    title: Option<&str>,
    description: Option<&str>,
    status: Option<&str>,
    priority: Option<&str>,
    scheduled_at: Option<&str>,
    deadline: Option<&str>,
    estimated_minutes: Option<i32>,
    notes: Option<&str>,
    tags: Option<&str>,
) -> Result<Task, String> {
    let time = now();

    // 构建动态 UPDATE
    let mut sets: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(v) = title {
        sets.push("title = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = description {
        sets.push("description = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = status {
        sets.push("status = ?".to_string());
        param_values.push(Box::new(v.to_string()));
        if v == "completed" {
            sets.push("completed_at = ?".to_string());
            param_values.push(Box::new(time.clone()));
        }
    }
    if let Some(v) = priority {
        sets.push("priority = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = scheduled_at {
        sets.push("scheduled_at = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = deadline {
        sets.push("deadline = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = estimated_minutes {
        sets.push("estimated_minutes = ?".to_string());
        param_values.push(Box::new(v));
    }
    if let Some(v) = notes {
        sets.push("notes = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = tags {
        sets.push("tags = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }

    if sets.is_empty() {
        return get_task(conn, id);
    }

    sets.push("updated_at = ?".to_string());
    param_values.push(Box::new(time));

    let sql = format!(
        "UPDATE tasks SET {} WHERE id = ?",
        sets.join(", ")
    );
    param_values.push(Box::new(id.to_string()));

    let param_refs: Vec<&dyn rusqlite::ToSql> = param_values
        .iter()
        .map(|v| v.as_ref() as &dyn rusqlite::ToSql)
        .collect();

    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update task: {}", e))?;

    // 记录变更
    let db_version = next_db_version(conn)?;
    let site_id = ensure_site_id(conn);
    let pk_json = serde_json::json!({"id": id}).to_string();
    record_change(conn, "tasks", &pk_json, None, None, db_version, &site_id, 1, false)?;

    get_task(conn, id)
}

/// 删除任务
pub fn delete_task(conn: &Connection, id: &str, cascade: bool) -> Result<u64, String> {
    let time = now();
    let db_version = next_db_version(conn)?;
    let site_id = ensure_site_id(conn);
    let pk_json = serde_json::json!({"id": id}).to_string();

    if cascade {
        // 软删除所有子任务并记录变更
        let child_ids: Vec<String> = conn
            .prepare("SELECT id FROM tasks WHERE parent_id = ?1 AND deleted_at IS NULL")
            .map_err(|e| format!("Failed to prepare: {}", e))?
            .query_map(params![id], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Failed to query: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        for child_id in child_ids {
            let child_pk = serde_json::json!({"id": &child_id}).to_string();
            let child_version = next_db_version(conn)?;
            record_change(conn, "tasks", &child_pk, None, None, child_version, &site_id, 1, true)?;
        }

        conn.execute(
            "UPDATE tasks SET deleted_at = ?1 WHERE parent_id = ?2 AND deleted_at IS NULL",
            params![time, id],
        )
        .map_err(|e| format!("Failed to delete subtasks: {}", e))?;
    } else {
        // 将子任务的 parent_id 设为 NULL
        conn.execute(
            "UPDATE tasks SET parent_id = NULL WHERE parent_id = ?1 AND deleted_at IS NULL",
            params![id],
        )
        .map_err(|e| format!("Failed to update subtasks: {}", e))?;
    }

    let affected = conn.execute("UPDATE tasks SET deleted_at = ?1 WHERE id = ?2", params![time, id])
        .map_err(|e| format!("Failed to delete task: {}", e))?;

    // 记录删除变更
    record_change(conn, "tasks", &pk_json, None, None, db_version, &site_id, 1, true)?;

    Ok(affected as u64)
}

/// 完成任务并分配XP和萤火
pub fn complete_task(conn: &mut Connection, id: &str) -> Result<CompleteResult, String> {
    let time = now();
    let site_id = ensure_site_id(conn);

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // 获取任务信息（用于计算萤火奖励）
    let task_info: (Option<i32>, i32) = tx
        .query_row(
            "SELECT estimated_minutes, xp_earned FROM tasks WHERE id = ?1",
            params![id],
            |row| Ok((row.get::<_, Option<i32>>(0)?, row.get::<_, i32>(1)?)),
        )
        .map_err(|e| format!("Failed to get task info: {}", e))?;

    let estimated_minutes = task_info.0.unwrap_or(25);
    let current_xp_earned = task_info.1;

    // 如果已经获得过XP（表示之前已完成过），不再重复奖励
    let glow_reward = if current_xp_earned == 0 {
        // 计算萤火奖励：每估计分钟数 = 1 萤火，最少 5 萤火
        let glow = (estimated_minutes as i32).max(5);
        glow
    } else {
        0
    };

    // 更新任务状态
    tx.execute(
        "UPDATE tasks SET status = 'completed', completed_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![time, id],
    )
    .map_err(|e| format!("Failed to complete task: {}", e))?;

    // 查询关联的技能
    let skill_xps: Vec<(String, i32)> = {
        let mut stmt = tx
            .prepare("SELECT skill_id, xp_amount FROM task_skills WHERE task_id = ?1 AND deleted_at IS NULL")
            .map_err(|e| format!("Failed to query task_skills: {}", e))?;

        let rows: Vec<(String, i32)> = stmt.query_map(params![id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
        })
        .map_err(|e| format!("Failed to read skill_xps: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect skill_xps: {}", e))?;

        rows
    };

    let mut total_xp = 0;
    let mut result_skills = Vec::new();

    for (skill_id, xp) in &skill_xps {
        total_xp += xp;

        // 给技能加XP
        tx.execute(
            "UPDATE skills SET total_xp = total_xp + ?1, updated_at = ?2 WHERE id = ?3",
            params![xp, time, skill_id],
        )
        .map_err(|e| format!("Failed to update skill xp: {}", e))?;

        // 记录XP流水
        let event_id = gen_id();
        tx.execute(
            "INSERT INTO skill_events (id, skill_id, xp_amount, source_type, source_id, note, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'task', ?4, '任务完成', ?5, ?5)",
            params![event_id, skill_id, xp, id, time],
        )
        .map_err(|e| format!("Failed to create skill event: {}", e))?;

        // 获取技能名称
        let skill_name: String = tx
            .query_row("SELECT name FROM skills WHERE id = ?1 AND deleted_at IS NULL", params![skill_id], |row| row.get(0))
            .unwrap_or_else(|_| "未知技能".to_string());

        result_skills.push(SkillXp {
            skill_id: skill_id.clone(),
            skill_name,
            xp: *xp,
        });
    }

    // 更新任务的 xp_earned
    tx.execute(
        "UPDATE tasks SET xp_earned = ?1 WHERE id = ?2",
        params![total_xp, id],
    )
    .map_err(|e| format!("Failed to update task xp_earned: {}", e))?;

    // 奖励萤火（如果未重复完成）
    if glow_reward > 0 {
        tx.execute(
            "UPDATE glow_balances SET glow_amount = glow_amount + ?1, updated_at = ?2 WHERE id = 'user'",
            params![glow_reward, time],
        )
        .map_err(|e| format!("Failed to add glow reward: {}", e))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    // 在事务外记录变更（简化版：事务完成后记录）
    let db_version = next_db_version(conn)?;
    let pk_json = serde_json::json!({"id": id}).to_string();
    record_change(conn, "tasks", &pk_json, None, None, db_version, &site_id, 1, false)?;

    // 升级检查（在事务提交后，确保能看到最新的 total_xp）
    for (skill_id, _) in &skill_xps {
        super::skill_repo::check_level_up(conn, skill_id)?;
    }

    Ok(CompleteResult {
        xp_earned: total_xp,
        glow_earned: glow_reward,
        skill_xps: result_skills,
    })
}

/// 取消完成任务并撤回XP
pub fn uncomplete_task(conn: &mut Connection, id: &str) -> Result<(), String> {
    let time = now();

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // 查询关联的技能XP（完成时分配的）
    let skill_xps: Vec<(String, i32)> = {
        let mut stmt = tx
            .prepare("SELECT skill_id, xp_amount FROM task_skills WHERE task_id = ?1 AND deleted_at IS NULL")
            .map_err(|e| format!("Failed to query task_skills: {}", e))?;

        let rows: Vec<(String, i32)> = stmt.query_map(params![id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
        })
        .map_err(|e| format!("Failed to read skill_xps: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect skill_xps: {}", e))?;

        rows
    };

    // 撤回每个技能的XP
    for (skill_id, xp) in &skill_xps {
        // 回退技能XP
        tx.execute(
            "UPDATE skills SET total_xp = CASE WHEN total_xp >= ?1 THEN total_xp - ?1 ELSE 0 END, updated_at = ?2 WHERE id = ?3",
            params![xp, time, skill_id],
        )
        .map_err(|e| format!("Failed to rollback skill xp: {}", e))?;

        // 记录撤回流水（负值）
        let event_id = gen_id();
        tx.execute(
            "INSERT INTO skill_events (id, skill_id, xp_amount, source_type, source_id, note, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'task', ?4, '取消完成', ?5, ?5)",
            params![event_id, skill_id, -xp, id, time],
        )
        .map_err(|e| format!("Failed to create skill event: {}", e))?;
    }

    // 重置任务状态
    tx.execute(
        "UPDATE tasks SET status = 'pending', completed_at = NULL, xp_earned = 0, updated_at = ?1 WHERE id = ?2",
        params![time, id],
    )
    .map_err(|e| format!("Failed to uncomplete task: {}", e))?;

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(())
}

/// 搜索任务 (关键词)
pub fn search_tasks(conn: &Connection, query: &str) -> Result<Vec<Task>, String> {
    let pattern = format!("%{}%", query);
    let sql = format!(
        "SELECT {} FROM tasks WHERE (title LIKE ?1 OR description LIKE ?1 OR notes LIKE ?1) AND deleted_at IS NULL ORDER BY created_at DESC",
        TASK_COLUMNS
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare search: {}", e))?;

    let tasks = stmt
        .query_map(params![pattern], task_from_row)
        .map_err(|e| format!("Failed to search tasks: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect search results: {}", e))?;

    Ok(tasks)
}

/// 分词加权搜索：将 query 拆成词，多字段命中打分，按总分降序返回
/// 字段权重：标题=10，标签=5，描述=3，备注=2
pub fn search_tasks_scored(
    conn: &Connection,
    query: &str,
    status_filter: Option<&str>,
    priority_filter: Option<&str>,
) -> Result<Vec<(Task, i32)>, String> {
    // 分词：按空白字符和中文标点拆
    let tokens: Vec<&str> = query
        .split(|c: char| c.is_whitespace() || c == '，' || c == '。' || c == '、' || c == '；')
        .filter(|t| !t.is_empty())
        .collect();

    if tokens.is_empty() {
        // 无有效 token → 列出所有（带筛选）
        let tasks = list_tasks(conn, status_filter, None)?;
        let filtered: Vec<Task> = if let Some(p) = priority_filter {
            tasks.into_iter().filter(|t| t.priority.as_deref() == Some(p)).collect()
        } else {
            tasks
        };
        return Ok(filtered.into_iter().map(|t| (t, 0)).collect());
    }

    // 构建动态 SQL：每个 token 产生一组 (title LIKE ? OR description LIKE ? OR notes LIKE ? OR tags LIKE ?)
    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<String> = Vec::new();

    for token in &tokens {
        let pattern = format!("%{}%", token);
        conditions.push(
            "(title LIKE ? OR description LIKE ? OR notes LIKE ? OR tags LIKE ?)".to_string(),
        );
        for _ in 0..4 {
            param_values.push(pattern.clone());
        }
    }

    let mut sql = format!(
        "SELECT {} FROM tasks WHERE ({}) AND deleted_at IS NULL",
        TASK_COLUMNS,
        conditions.join(" OR ")
    );

    if let Some(s) = status_filter {
        sql.push_str(" AND status = ?");
        param_values.push(s.to_string());
    }

    if let Some(p) = priority_filter {
        sql.push_str(" AND priority = ?");
        param_values.push(p.to_string());
    }

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare scored search: {}", e))?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = param_values
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let tasks: Vec<Task> = stmt
        .query_map(param_refs.as_slice(), task_from_row)
        .map_err(|e| format!("Failed to execute scored search: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect scored results: {}", e))?;

    // 打分
    let mut scored: Vec<(Task, i32)> = tasks
        .into_iter()
        .map(|task| {
            let score = score_task_against_tokens(&task, &tokens);
            (task, score)
        })
        .collect();

    // 按分数降序
    scored.sort_by(|a, b| b.1.cmp(&a.1));

    Ok(scored)
}

fn score_task_against_tokens(task: &Task, tokens: &[&str]) -> i32 {
    let title = task.title.to_lowercase();
    let desc = task.description.as_deref().unwrap_or("").to_lowercase();
    let notes = task.notes.as_deref().unwrap_or("").to_lowercase();
    let tags = task.tags.as_deref().unwrap_or("").to_lowercase();

    let mut score = 0;
    for token in tokens {
        let t = token.to_lowercase();
        if title.contains(&t) {
            score += 10;
        }
        if tags.contains(&t) {
            score += 5;
        }
        if desc.contains(&t) {
            score += 3;
        }
        if notes.contains(&t) {
            score += 2;
        }
    }
    score
}

#[derive(Debug, Serialize)]
pub struct SkillXp {
    pub skill_id: String,
    pub skill_name: String,
    pub xp: i32,
}

#[derive(Debug, Serialize)]
pub struct CompleteResult {
    pub xp_earned: i32,
    pub glow_earned: i32,
    pub skill_xps: Vec<SkillXp>,
}
