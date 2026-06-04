use chrono::{Datelike, Local, NaiveDate};
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub frequency_type: String,
    pub frequency_value: Option<String>,
    pub target_minutes: Option<i32>,
    pub skill_id: Option<String>,
    pub xp_per_check: i32,
    pub is_active: i32,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HabitRecord {
    pub id: String,
    pub habit_id: String,
    pub checked_at: String,
    pub note: Option<String>,
    pub created_at: String,
}

const HABIT_COLUMNS: &str = "id, name, icon, color, frequency_type, frequency_value, target_minutes, skill_id, xp_per_check, is_active, sort_order, created_at, updated_at";

fn habit_from_row(row: &Row) -> rusqlite::Result<Habit> {
    Ok(Habit {
        id: row.get("id")?,
        name: row.get("name")?,
        icon: row.get("icon")?,
        color: row.get("color")?,
        frequency_type: row.get("frequency_type")?,
        frequency_value: row.get("frequency_value")?,
        target_minutes: row.get("target_minutes")?,
        skill_id: row.get("skill_id")?,
        xp_per_check: row.get("xp_per_check")?,
        is_active: row.get("is_active")?,
        sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn record_from_row(row: &Row) -> rusqlite::Result<HabitRecord> {
    Ok(HabitRecord {
        id: row.get("id")?,
        habit_id: row.get("habit_id")?,
        checked_at: row.get("checked_at")?,
        note: row.get("note")?,
        created_at: row.get("created_at")?,
    })
}

fn now() -> String {
    Local::now().to_rfc3339()
}

fn today() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn gen_id() -> String {
    nanoid::nanoid!()
}

/// 创建习惯
pub fn create_habit(
    conn: &Connection,
    name: &str,
    icon: Option<&str>,
    color: Option<&str>,
    frequency_type: &str,
    frequency_value: Option<&str>,
    target_minutes: Option<i32>,
    skill_id: Option<&str>,
    xp_per_check: i32,
) -> Result<Habit, String> {
    let id = gen_id();
    let time = now();

    conn.execute(
        "INSERT INTO habits (id, name, icon, color, frequency_type, frequency_value, target_minutes, skill_id, xp_per_check, is_active, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, 0, ?10, ?11)",
        params![id, name, icon, color, frequency_type, frequency_value, target_minutes, skill_id, xp_per_check, time, time],
    )
    .map_err(|e| format!("Failed to create habit: {}", e))?;

    get_habit(conn, &id)
}

/// 获取单个习惯
pub fn get_habit(conn: &Connection, id: &str) -> Result<Habit, String> {
    conn.query_row(
        &format!("SELECT {} FROM habits WHERE id = ?1 AND deleted_at IS NULL", HABIT_COLUMNS),
        params![id],
        habit_from_row,
    )
    .map_err(|e| format!("Habit not found: {}", e))
}

/// 更新习惯
pub fn update_habit(
    conn: &Connection,
    id: &str,
    name: Option<&str>,
    icon: Option<&str>,
    color: Option<&str>,
    frequency_type: Option<&str>,
    frequency_value: Option<&str>,
    target_minutes: Option<i32>,
    skill_id: Option<&str>,
    xp_per_check: Option<i32>,
) -> Result<Habit, String> {
    let time = now();
    let mut sets: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(v) = name {
        sets.push("name = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = icon {
        sets.push("icon = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = color {
        sets.push("color = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = frequency_type {
        sets.push("frequency_type = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = frequency_value {
        sets.push("frequency_value = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = target_minutes {
        sets.push("target_minutes = ?".to_string());
        param_values.push(Box::new(v));
    }
    if let Some(v) = skill_id {
        sets.push("skill_id = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = xp_per_check {
        sets.push("xp_per_check = ?".to_string());
        param_values.push(Box::new(v));
    }

    if sets.is_empty() {
        return get_habit(conn, id);
    }

    sets.push("updated_at = ?".to_string());
    param_values.push(Box::new(time));

    let sql = format!("UPDATE habits SET {} WHERE id = ?", sets.join(", "));
    param_values.push(Box::new(id.to_string()));

    let param_refs: Vec<&dyn rusqlite::ToSql> = param_values
        .iter()
        .map(|v| v.as_ref() as &dyn rusqlite::ToSql)
        .collect();

    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update habit: {}", e))?;

    get_habit(conn, id)
}

/// 删除习惯（级联软删除记录）
pub fn delete_habit(conn: &Connection, id: &str) -> Result<u64, String> {
    let time = now();
    conn.execute("UPDATE habit_records SET deleted_at = ?1 WHERE habit_id = ?2 AND deleted_at IS NULL", params![time, id])
        .map_err(|e| format!("Failed to delete habit records: {}", e))?;
    let affected = conn.execute("UPDATE habits SET deleted_at = ?1 WHERE id = ?2", params![time, id])
        .map_err(|e| format!("Failed to delete habit: {}", e))?;
    Ok(affected as u64)
}

/// 列出所有活跃习惯
pub fn list_habits(conn: &Connection) -> Result<Vec<Habit>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM habits WHERE is_active = 1 AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC",
            HABIT_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare list_habits: {}", e))?;

    let rows = stmt
        .query_map([], habit_from_row)
        .map_err(|e| format!("Failed to query habits: {}", e))?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("Failed to read habit: {}", e))?);
    }
    Ok(results)
}

/// 打卡（含 XP / 萤火 / 技能奖励）
pub fn check_habit(
    conn: &mut Connection,
    habit_id: &str,
    date: Option<&str>,
    note: Option<&str>,
) -> Result<super::task_repo::CompleteResult, String> {
    let checked_at = date.map(|d| d.to_string()).unwrap_or_else(today);
    let id = gen_id();
    let time = now();

    // 获取习惯信息（xp_per_check, skill_id）
    let habit = get_habit(conn, habit_id)?;
    let xp_reward = habit.xp_per_check;
    let glow_reward = xp_reward; // 萤火 = XP

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // 清理同一天已软删除的旧记录（取消打卡后再打卡的场景）
    let _ = tx.execute(
        "DELETE FROM habit_records WHERE habit_id = ?1 AND checked_at = ?2 AND deleted_at IS NOT NULL",
        params![habit_id, checked_at],
    );

    // 插入打卡记录
    tx.execute(
        "INSERT INTO habit_records (id, habit_id, checked_at, note, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![id, habit_id, checked_at, note, time],
    )
    .map_err(|e| format!("Failed to check habit (may already be checked today): {}", e))?;

    // 奖励萤火
    if glow_reward > 0 {
        tx.execute(
            "UPDATE glow_balances SET glow_amount = glow_amount + ?1, updated_at = ?2 WHERE id = 'user'",
            params![glow_reward, time],
        )
        .map_err(|e| format!("Failed to add habit glow reward: {}", e))?;

        let balance_after: i32 = tx
            .query_row("SELECT glow_amount FROM glow_balances WHERE id = 'user'", [], |row| row.get(0))
            .unwrap_or(0);
        let ledger_id = gen_id();
        let _ = tx.execute(
            "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
             VALUES (?1, 'glow', ?2, ?3, 'habit_check', ?4, ?5, ?6)",
            params![
                ledger_id,
                glow_reward,
                balance_after,
                format!("习惯打卡「{}」", habit.name),
                habit_id,
                time,
            ],
        );
    }

    // 奖励技能 XP
    let mut skill_xps: Vec<super::task_repo::SkillXp> = Vec::new();
    if let Some(ref skill_id_str) = habit.skill_id {
        if !skill_id_str.is_empty() && xp_reward > 0 {
            // 更新技能 total_xp
            tx.execute(
                "UPDATE skills SET total_xp = total_xp + ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL",
                params![xp_reward, time, skill_id_str],
            )
            .map_err(|e| format!("Failed to update skill xp: {}", e))?;

            // 记录 skill_event
            let event_id = gen_id();
            tx.execute(
                "INSERT INTO skill_events (id, skill_id, xp_amount, source_type, source_id, note, created_at, updated_at)
                 VALUES (?1, ?2, ?3, 'habit', ?4, '习惯打卡', ?5, ?5)",
                params![event_id, skill_id_str, xp_reward, habit_id, time],
            )
            .map_err(|e| format!("Failed to create skill event: {}", e))?;

            // 获取技能名称
            let skill_name: String = tx
                .query_row(
                    "SELECT name FROM skills WHERE id = ?1 AND deleted_at IS NULL",
                    params![skill_id_str],
                    |row| row.get(0),
                )
                .unwrap_or_else(|_| "未知技能".to_string());

            skill_xps.push(super::task_repo::SkillXp {
                skill_id: skill_id_str.clone(),
                skill_name,
                xp: xp_reward,
            });
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    // 升级检查
    if let Some(ref skill_id_str) = habit.skill_id {
        if !skill_id_str.is_empty() && xp_reward > 0 {
            super::skill_repo::check_level_up(conn, skill_id_str)?;
        }
    }

    Ok(super::task_repo::CompleteResult {
        xp_earned: xp_reward,
        glow_earned: glow_reward,
        skill_xps,
    })
}

/// 取消打卡
pub fn uncheck_habit(conn: &Connection, habit_id: &str, date: Option<&str>) -> Result<u64, String> {
    let checked_at = date.map(|d| d.to_string()).unwrap_or_else(today);
    let time = now();
    let affected = conn.execute(
        "UPDATE habit_records SET deleted_at = ?1 WHERE habit_id = ?2 AND checked_at = ?3 AND deleted_at IS NULL",
        params![time, habit_id, checked_at],
    )
    .map_err(|e| format!("Failed to uncheck habit: {}", e))?;
    Ok(affected as u64)
}

/// 获取某习惯的打卡记录
pub fn get_records(conn: &Connection, habit_id: &str, start_date: Option<&str>, end_date: Option<&str>) -> Result<Vec<HabitRecord>, String> {
    let sql = match (start_date, end_date) {
        (Some(_), Some(_)) => "SELECT id, habit_id, checked_at, note, created_at FROM habit_records WHERE habit_id = ?1 AND checked_at >= ?2 AND checked_at <= ?3 AND deleted_at IS NULL ORDER BY checked_at ASC",
        (Some(_), None) => "SELECT id, habit_id, checked_at, note, created_at FROM habit_records WHERE habit_id = ?1 AND checked_at >= ?2 AND deleted_at IS NULL ORDER BY checked_at ASC",
        (None, Some(_)) => "SELECT id, habit_id, checked_at, note, created_at FROM habit_records WHERE habit_id = ?1 AND checked_at <= ?2 AND deleted_at IS NULL ORDER BY checked_at ASC",
        (None, None) => "SELECT id, habit_id, checked_at, note, created_at FROM habit_records WHERE habit_id = ?1 AND deleted_at IS NULL ORDER BY checked_at ASC",
    };

    let mut stmt = conn.prepare(sql).map_err(|e| format!("Failed to prepare get_records: {}", e))?;

    let rows = match (start_date, end_date) {
        (Some(s), Some(e)) => stmt.query_map(params![habit_id, s, e], record_from_row),
        (Some(s), None) => stmt.query_map(params![habit_id, s], record_from_row),
        (None, Some(e)) => stmt.query_map(params![habit_id, e], record_from_row),
        (None, None) => stmt.query_map(params![habit_id], record_from_row),
    }
    .map_err(|e| format!("Failed to query records: {}", e))?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("Failed to read record: {}", e))?);
    }
    Ok(results)
}

/// 计算当前连续打卡天数
pub fn get_streak(conn: &Connection, habit_id: &str) -> Result<i32, String> {
    let today_str = today();

    // 获取所有打卡日期，降序
    let mut stmt = conn
        .prepare("SELECT checked_at FROM habit_records WHERE habit_id = ?1 AND deleted_at IS NULL ORDER BY checked_at DESC")
        .map_err(|e| format!("Failed to prepare get_streak: {}", e))?;

    let dates: Vec<String> = stmt
        .query_map(params![habit_id], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query streak dates: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect streak dates: {}", e))?;

    if dates.is_empty() {
        return Ok(0);
    }

    let today = NaiveDate::parse_from_str(&today_str, "%Y-%m-%d")
        .map_err(|e| format!("Failed to parse today: {}", e))?;

    // 检查今天是否已打卡
    let first = NaiveDate::parse_from_str(&dates[0], "%Y-%m-%d")
        .map_err(|e| format!("Failed to parse date: {}", e))?;

    // 如果最近一次打卡不是今天也不是昨天，streak 为 0
    let diff = (today - first).num_days();
    if diff > 1 {
        return Ok(0);
    }

    let mut streak = 1;
    for i in 1..dates.len() {
        let current = NaiveDate::parse_from_str(&dates[i - 1], "%Y-%m-%d")
            .map_err(|e| format!("Failed to parse date: {}", e))?;
        let prev = NaiveDate::parse_from_str(&dates[i], "%Y-%m-%d")
            .map_err(|e| format!("Failed to parse date: {}", e))?;

        if (current - prev).num_days() == 1 {
            streak += 1;
        } else {
            break;
        }
    }

    Ok(streak)
}

/// 批量获取所有习惯的 streak
#[derive(Debug, Serialize)]
pub struct HabitWithStreak {
    #[serde(flatten)]
    pub habit: Habit,
    pub streak: i32,
    pub checked_today: bool,
}

pub fn get_all_streaks(conn: &Connection) -> Result<Vec<HabitWithStreak>, String> {
    let habits = list_habits(conn)?;
    let today_str = today();
    let mut results = Vec::new();

    for habit in habits {
        let streak = get_streak(conn, &habit.id).unwrap_or(0);
        // 检查今天是否打卡
        let checked_today: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM habit_records WHERE habit_id = ?1 AND checked_at = ?2 AND deleted_at IS NULL",
                params![habit.id, today_str],
                |row| row.get::<_, i32>(0),
            )
            .map(|count| count > 0)
            .unwrap_or(false);

        results.push(HabitWithStreak {
            habit,
            streak,
            checked_today,
        });
    }

    Ok(results)
}

/// 获取本周打卡矩阵
#[derive(Debug, Serialize)]
pub struct WeekMatrix {
    pub habit_id: String,
    pub checked_days: Vec<String>, // 本周已打卡的日期列表
}

pub fn get_week_matrix(conn: &Connection) -> Result<Vec<WeekMatrix>, String> {
    let today = Local::now().date_naive();
    let weekday = today.weekday().num_days_from_monday(); // 0=Mon, 6=Sun
    let monday = today - chrono::Duration::days(weekday as i64);
    let sunday = monday + chrono::Duration::days(6);

    let start_str = monday.format("%Y-%m-%d").to_string();
    let end_str = sunday.format("%Y-%m-%d").to_string();

    let habits = list_habits(conn)?;
    let mut results = Vec::new();

    for habit in habits {
        let records = get_records(conn, &habit.id, Some(&start_str), Some(&end_str))?;
        let checked_days: Vec<String> = records.into_iter().map(|r| r.checked_at).collect();
        results.push(WeekMatrix {
            habit_id: habit.id,
            checked_days,
        });
    }

    Ok(results)
}
