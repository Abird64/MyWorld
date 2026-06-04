use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub parent_id: Option<String>,
    pub category: Option<String>,
    pub level: i32,
    pub total_xp: i32,
    pub is_unlocked: i32,
    pub created_at: String,
    pub updated_at: String,
}

const SKILL_COLUMNS: &str = "id, name, description, icon, color, parent_id, category, level, total_xp, is_unlocked, created_at, updated_at";

fn skill_from_row(row: &Row) -> rusqlite::Result<Skill> {
    Ok(Skill {
        id: row.get("id")?,
        name: row.get("name")?,
        description: row.get("description")?,
        icon: row.get("icon")?,
        color: row.get("color")?,
        parent_id: row.get("parent_id")?,
        category: row.get("category")?,
        level: row.get("level")?,
        total_xp: row.get("total_xp")?,
        is_unlocked: row.get("is_unlocked")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskSkill {
    pub task_id: String,
    pub skill_id: String,
    pub xp_amount: i32,
}

fn task_skill_from_row(row: &Row) -> rusqlite::Result<TaskSkill> {
    Ok(TaskSkill {
        task_id: row.get("task_id")?,
        skill_id: row.get("skill_id")?,
        xp_amount: row.get("xp_amount")?,
    })
}

fn now() -> String {
    chrono::Local::now().to_rfc3339()
}

fn gen_id() -> String {
    nanoid::nanoid!()
}

/// 6个默认技能的定义
const DEFAULT_SKILLS: &[(&str, &str, &str)] = &[
    ("focus", "专注力", "#3A8FB7"),
    ("vitality", "生命力", "#4B7F52"),
    ("empathy", "共情力", "#C83C3C"),
    ("creativity", "创造力", "#E8B959"),
    ("insight", "洞察力", "#B87353"),
    ("expression", "表现力", "#8A6DA7"),
];

/// 初始化6个默认技能（INSERT OR IGNORE，安全重复调用）
pub fn initialize_default_skills(conn: &Connection) -> Result<(), String> {
    let time = now();
    for (id, name, color) in DEFAULT_SKILLS {
        conn.execute(
            "INSERT OR IGNORE INTO skills (id, name, color, level, total_xp, is_unlocked, created_at, updated_at)
             VALUES (?1, ?2, ?3, 1, 0, 1, ?4, ?5)",
            params![id, name, color, time, time],
        )
        .map_err(|e| format!("Failed to initialize skill {}: {}", name, e))?;
    }
    log::info!("Default skills initialized");
    Ok(())
}

/// 获取所有技能（按固定顺序排列）
pub fn list_skills(conn: &Connection) -> Result<Vec<Skill>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM skills WHERE deleted_at IS NULL ORDER BY CASE id
               WHEN 'focus' THEN 0
               WHEN 'vitality' THEN 1
               WHEN 'empathy' THEN 2
               WHEN 'creativity' THEN 3
               WHEN 'insight' THEN 4
               WHEN 'expression' THEN 5
               ELSE 6
             END",
            SKILL_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare list_skills: {}", e))?;

    let skills = stmt
        .query_map([], skill_from_row)
        .map_err(|e| format!("Failed to query skills: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect skills: {}", e))?;

    Ok(skills)
}

/// 获取任务的所有技能XP分配
pub fn get_task_skills(conn: &Connection, task_id: &str) -> Result<Vec<TaskSkill>, String> {
    let mut stmt = conn
        .prepare("SELECT task_id, skill_id, xp_amount FROM task_skills WHERE task_id = ?1 AND deleted_at IS NULL")
        .map_err(|e| format!("Failed to prepare get_task_skills: {}", e))?;

    let skills = stmt
        .query_map(params![task_id], task_skill_from_row)
        .map_err(|e| format!("Failed to query task_skills: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect task_skills: {}", e))?;

    Ok(skills)
}

/// 设置任务的技能XP分配（先删后插，避免UNIQUE约束冲突）
pub fn set_task_skills(
    conn: &Connection,
    task_id: &str,
    skills: &[(String, i32)],
) -> Result<(), String> {
    // 硬删除该任务所有旧的技能分配（避免 UNIQUE(task_id, skill_id) 约束冲突）
    conn.execute(
        "DELETE FROM task_skills WHERE task_id = ?1",
        params![task_id],
    )
    .map_err(|e| format!("Failed to clear task_skills: {}", e))?;

    // 插入新的分配（跳过 xp_amount <= 0 的）
    for (skill_id, xp_amount) in skills {
        if *xp_amount <= 0 {
            continue;
        }
        let id = gen_id();
        conn.execute(
            "INSERT INTO task_skills (id, task_id, skill_id, xp_amount) VALUES (?1, ?2, ?3, ?4)",
            params![id, task_id, skill_id, xp_amount],
        )
        .map_err(|e| format!("Failed to insert task_skill: {}", e))?;
    }

    Ok(())
}

/// XP → 等级换算：累计 XP 达到 100 × N × (N-1) / 2 时升到 Lv.N
/// Lv.1=0, Lv.2=100, Lv.3=300, Lv.4=600, Lv.5=1000, ...
fn xp_to_level(total_xp: i32) -> i32 {
    let mut cumulative = 0i32;
    for n in 1i32.. {
        cumulative = cumulative.saturating_add(100 * n);
        if total_xp < cumulative {
            return n;
        }
    }
    1
}

/// 每日活跃记录
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DayActivity {
    pub day: String,
    pub total_xp: i32,
}

/// 获取最近 N 天每天的 XP 总量
pub fn get_skill_activity(conn: &Connection, days: i32) -> Result<Vec<DayActivity>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT date(created_at) as day, SUM(xp_amount) as total_xp
             FROM skill_events
             WHERE created_at >= date('now', '-{} days') AND deleted_at IS NULL
             GROUP BY date(created_at)
             ORDER BY day",
            days
        ))
        .map_err(|e| format!("Failed to prepare get_skill_activity: {}", e))?;

    let activities = stmt
        .query_map([], |row| {
            Ok(DayActivity {
                day: row.get("day")?,
                total_xp: row.get("total_xp")?,
            })
        })
        .map_err(|e| format!("Failed to query skill_activity: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect skill_activity: {}", e))?;

    Ok(activities)
}

/// 经验来源统计
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XpSource {
    pub source_type: String,
    pub total_xp: i32,
}

/// 按来源类型统计 XP 总量
pub fn get_xp_sources(conn: &Connection) -> Result<Vec<XpSource>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT source_type, SUM(xp_amount) as total_xp
             FROM skill_events
             WHERE deleted_at IS NULL
             GROUP BY source_type
             ORDER BY total_xp DESC",
        )
        .map_err(|e| format!("Failed to prepare get_xp_sources: {}", e))?;

    let sources = stmt
        .query_map([], |row| {
            Ok(XpSource {
                source_type: row.get("source_type")?,
                total_xp: row.get("total_xp")?,
            })
        })
        .map_err(|e| format!("Failed to query xp_sources: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect xp_sources: {}", e))?;

    Ok(sources)
}

/// 检查并升级技能等级（在 XP 增加后调用），升级时奖励拾光奖券
pub fn check_level_up(conn: &Connection, skill_id: &str) -> Result<(), String> {
    let (total_xp, current_level): (i32, i32) = conn
        .query_row(
            "SELECT total_xp, level FROM skills WHERE id = ?1 AND deleted_at IS NULL",
            params![skill_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("查询技能等级失败: {}", e))?;

    let new_level = xp_to_level(total_xp);
    if new_level > current_level {
        conn.execute(
            "UPDATE skills SET level = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_level, now(), skill_id],
        )
        .map_err(|e| format!("升级技能失败: {}", e))?;

        // 获取技能名称
        let skill_name: String = conn
            .query_row(
                "SELECT name FROM skills WHERE id = ?1 AND deleted_at IS NULL",
                params![skill_id],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "未知属性".to_string());

        // 升级奖励：拾光奖券 ×1
        conn.execute(
            "UPDATE glow_balances SET shimmer_tickets = shimmer_tickets + 1, updated_at = ?1 WHERE id = 'user'",
            params![now()],
        )
        .map_err(|e| format!("奖励拾光奖券失败: {}", e))?;

        // 记录萤火账本
        {
            let balance_after: i32 = conn
                .query_row("SELECT shimmer_tickets FROM glow_balances WHERE id = 'user'", [], |row| row.get(0))
                .unwrap_or(0);
            let ledger_id = nanoid::nanoid!();
            let time = now();
            let _ = conn.execute(
                "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
                 VALUES (?1, 'shimmer_ticket', 1, ?2, 'skill_level_up', ?3, ?4, ?5)",
                rusqlite::params![ledger_id, balance_after, format!("{} 升级到 Lv.{}", skill_name, new_level), skill_id, time],
            );
        }

        log::info!("{} 升级到 Lv.{}，奖励拾光奖券 ×1", skill_name, new_level);
    }
    Ok(())
}
