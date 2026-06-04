use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PomodoroSession {
    pub id: String,
    pub task_id: Option<String>,
    pub session_type: String,
    pub target_minutes: i32,
    pub actual_seconds: i32,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

const COLUMNS: &str = "id, task_id, session_type, target_minutes, actual_seconds, status, started_at, completed_at, created_at, updated_at";

fn row_to_session(row: &Row) -> rusqlite::Result<PomodoroSession> {
    Ok(PomodoroSession {
        id: row.get("id")?,
        task_id: row.get("task_id")?,
        session_type: row.get("session_type")?,
        target_minutes: row.get("target_minutes")?,
        actual_seconds: row.get("actual_seconds")?,
        status: row.get("status")?,
        started_at: row.get("started_at")?,
        completed_at: row.get("completed_at")?,
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

/// 创建新的番茄钟会话
pub fn create_session(
    conn: &Connection,
    task_id: Option<&str>,
    session_type: &str,
    target_minutes: i32,
) -> Result<PomodoroSession, String> {
    let id = gen_id();
    let time = now();

    conn.execute(
        "INSERT INTO pomodoro_sessions (id, task_id, session_type, target_minutes, status, started_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'running', ?5, ?5, ?5)",
        params![id, task_id, session_type, target_minutes, time],
    )
    .map_err(|e| format!("Failed to create pomodoro session: {}", e))?;

    conn.query_row(
        &format!("SELECT {} FROM pomodoro_sessions WHERE id = ?1", COLUMNS),
        params![id],
        row_to_session,
    )
    .map_err(|e| format!("Failed to read created session: {}", e))
}

/// 完成番茄钟会话（专注类型会 award XP 到 focus 技能）
pub fn complete_session(
    conn: &mut Connection,
    session_id: &str,
    actual_seconds: i32,
) -> Result<PomodoroSession, String> {
    let time = now();

    // 先获取会话信息
    let session: PomodoroSession = conn.query_row(
        &format!("SELECT {} FROM pomodoro_sessions WHERE id = ?1 AND deleted_at IS NULL", COLUMNS),
        params![session_id],
        row_to_session,
    )
    .map_err(|e| format!("Session not found: {}", e))?;

    if session.status != "running" {
        return Err("Session is not running".to_string());
    }

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // 更新会话状态
    tx.execute(
        "UPDATE pomodoro_sessions SET status = 'completed', actual_seconds = ?1, completed_at = ?2, updated_at = ?2 WHERE id = ?3",
        params![actual_seconds, time, session_id],
    )
    .map_err(|e| format!("Failed to complete session: {}", e))?;

    // 如果是专注类型，给 focus 技能 award XP 和萤火
    if session.session_type == "focus" {
        let xp = session.target_minutes; // 25分钟 = 25 XP

        // 更新 focus 技能的 total_xp
        tx.execute(
            "UPDATE skills SET total_xp = total_xp + ?1, updated_at = ?2 WHERE id = 'focus' AND deleted_at IS NULL",
            params![xp, time],
        )
        .map_err(|e| format!("Failed to update focus skill xp: {}", e))?;

        // 记录 XP 流水
        let event_id = gen_id();
        let note = if session.task_id.is_some() {
            "番茄钟专注（绑定任务）"
        } else {
            "番茄钟专注"
        };
        tx.execute(
            "INSERT INTO skill_events (id, skill_id, xp_amount, source_type, source_id, note, created_at, updated_at)
             VALUES (?1, 'focus', ?2, 'pomodoro', ?3, ?4, ?5, ?5)",
            params![event_id, xp, session_id, note, time],
        )
        .map_err(|e| format!("Failed to create skill event: {}", e))?;

        // 奖励萤火：每分钟 = 1 萤火，最少 5 萤火
        let glow_reward = (session.target_minutes as i32).max(5);
        tx.execute(
            "UPDATE glow_balances SET glow_amount = glow_amount + ?1, updated_at = ?2 WHERE id = 'user'",
            params![glow_reward, time],
        )
        .map_err(|e| format!("Failed to add pomodoro glow reward: {}", e))?;

        // 记录萤火账本
        let balance_after: i32 = tx
            .query_row("SELECT glow_amount FROM glow_balances WHERE id = 'user'", [], |row| row.get(0))
            .unwrap_or(0);
        let ledger_id = gen_id();
        let note = if session.task_id.is_some() {
            "番茄钟专注（绑定任务）".to_string()
        } else {
            format!("番茄钟专注 {} 分钟", session.target_minutes)
        };
        let _ = tx.execute(
            "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
             VALUES (?1, 'glow', ?2, ?3, 'pomodoro_focus', ?4, ?5, ?6)",
            params![ledger_id, glow_reward, balance_after, note, session_id, time],
        );
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    // 升级检查
    super::skill_repo::check_level_up(conn, "focus")?;

    // 返回更新后的会话
    conn.query_row(
        &format!("SELECT {} FROM pomodoro_sessions WHERE id = ?1", COLUMNS),
        params![session_id],
        row_to_session,
    )
    .map_err(|e| format!("Failed to read completed session: {}", e))
}

/// 取消番茄钟会话
pub fn cancel_session(conn: &Connection, session_id: &str) -> Result<PomodoroSession, String> {
    let time = now();

    conn.execute(
        "UPDATE pomodoro_sessions SET status = 'cancelled', completed_at = ?1, updated_at = ?1 WHERE id = ?2 AND status = 'running'",
        params![time, session_id],
    )
    .map_err(|e| format!("Failed to cancel session: {}", e))?;

    conn.query_row(
        &format!("SELECT {} FROM pomodoro_sessions WHERE id = ?1", COLUMNS),
        params![session_id],
        row_to_session,
    )
    .map_err(|e| format!("Failed to read cancelled session: {}", e))
}

/// 获取当前运行中的会话
pub fn get_active_session(conn: &Connection) -> Result<Option<PomodoroSession>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM pomodoro_sessions WHERE status = 'running' AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 1",
            COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare get_active_session: {}", e))?;

    let mut rows = stmt
        .query_map([], row_to_session)
        .map_err(|e| format!("Failed to query active session: {}", e))?;

    match rows.next() {
        Some(row) => Ok(Some(row.map_err(|e| format!("Failed to read session: {}", e))?)),
        None => Ok(None),
    }
}

/// 获取今日番茄钟统计
pub fn get_today_stats(conn: &Connection) -> Result<TodayStats, String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let mut stmt = conn
        .prepare(
            "SELECT session_type, COUNT(*) as cnt, COALESCE(SUM(actual_seconds), 0) as total_secs
             FROM pomodoro_sessions
             WHERE status = 'completed' AND deleted_at IS NULL AND date(started_at) = ?1
             GROUP BY session_type",
        )
        .map_err(|e| format!("Failed to prepare get_today_stats: {}", e))?;

    let mut focus_count = 0i32;
    let mut focus_seconds = 0i32;
    let mut break_count = 0i32;

    let rows = stmt
        .query_map(params![today], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i32>(1)?,
                row.get::<_, i32>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to query today stats: {}", e))?;

    for row in rows {
        let (stype, cnt, secs) = row.map_err(|e| format!("Failed to read stat: {}", e))?;
        if stype == "focus" {
            focus_count = cnt;
            focus_seconds = secs;
        } else {
            break_count = cnt;
        }
    }

    Ok(TodayStats {
        focus_count,
        focus_seconds,
        break_count,
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TodayStats {
    pub focus_count: i32,
    pub focus_seconds: i32,
    pub break_count: i32,
}
