use rusqlite::Connection;
use serde::Deserialize;

use crate::db::repositories::habit_repo;

use super::shared::find_habit_by_query;

#[derive(Debug, Deserialize)]
pub struct ToolCreateHabitArgs {
    pub name: String,
    #[serde(default)]
    pub frequency_type: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ToolCheckHabitArgs {
    #[serde(default)]
    pub habit_id: Option<String>,
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
}

pub fn execute_list_habits(conn: &Connection) -> Result<String, String> {
    let habits = habit_repo::get_all_streaks(conn)?;

    if habits.is_empty() {
        return Ok("暂无习惯。告诉用户可以创建一个习惯开始打卡。".to_string());
    }

    let mut result = format!("共有{}个习惯：\n\n", habits.len());

    for (i, hws) in habits.iter().enumerate() {
        let habit = &hws.habit;
        let icon = habit.icon.as_deref().unwrap_or("");
        let freq = match habit.frequency_type.as_str() {
            "daily" => "每天",
            "weekly" => "每周",
            _ => "自定义",
        };
        let checked = if hws.checked_today { "✅ 今日已打卡" } else { "⬜ 今日未打卡" };
        let streak_info = if hws.streak > 0 {
            format!("连续{}天", hws.streak)
        } else {
            "暂无连续".to_string()
        };

        result.push_str(&format!("{}. {}{} — {}，{}，{}\n", i + 1, icon, habit.name, freq, streak_info, checked));
    }

    Ok(result)
}

pub fn execute_create_habit(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolCreateHabitArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("create_habit 参数解析失败: {}", e))?;

    let freq_type = args.frequency_type.as_deref().unwrap_or("daily");

    let habit = habit_repo::create_habit(
        conn,
        &args.name,
        args.icon.as_deref(),
        args.color.as_deref(),
        freq_type,
        None,
        None,
        None,
        5,
    )?;

    let mut result = format!("习惯已创建：{}", habit.name);
    if let Some(ref icon) = habit.icon {
        result.push_str(&format!(" {}", icon));
    }
    let freq = match habit.frequency_type.as_str() {
        "daily" => "每天",
        "weekly" => "每周",
        _ => "自定义",
    };
    result.push_str(&format!("，频率：{}", freq));

    Ok(result)
}

pub fn execute_check_habit(conn: &mut Connection, arguments: &str) -> Result<String, String> {
    let args: ToolCheckHabitArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("check_habit 参数解析失败: {}", e))?;

    let habit = find_habit_by_query(conn, &args.habit_id, &args.query)?;
    let date_str = args.date.as_deref();

    habit_repo::check_habit(conn, &habit.id, date_str, args.note.as_deref())?;

    let icon = habit.icon.as_deref().unwrap_or("");
    let date_display = date_str.unwrap_or("今天");
    Ok(format!("打卡成功：{}{} (日期：{})", icon, habit.name, date_display))
}

pub fn execute_uncheck_habit(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolCheckHabitArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("uncheck_habit 参数解析失败: {}", e))?;

    let habit = find_habit_by_query(conn, &args.habit_id, &args.query)?;
    let date_str = args.date.as_deref();

    let affected = habit_repo::uncheck_habit(conn, &habit.id, date_str)?;

    if affected > 0 {
        let date_display = date_str.unwrap_or("今天");
        Ok(format!("已取消打卡：{} (日期：{})", habit.name, date_display))
    } else {
        Err(format!("{}在指定日期没有打卡记录", habit.name))
    }
}

#[derive(Debug, Deserialize)]
pub struct ToolUpdateHabitArgs {
    #[serde(default)]
    pub habit_id: Option<String>,
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub frequency_type: Option<String>,
    #[serde(default)]
    pub xp_per_check: Option<i32>,
}

pub fn execute_update_habit(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolUpdateHabitArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("update_habit 参数解析失败: {}", e))?;

    let habit = find_habit_by_query(conn, &args.habit_id, &args.query)?;

    let updated = habit_repo::update_habit(
        conn,
        &habit.id,
        args.name.as_deref(),
        args.icon.as_deref(),
        args.color.as_deref(),
        args.frequency_type.as_deref(),
        None, // frequency_value
        None, // target_minutes
        None, // skill_id
        args.xp_per_check,
    )?;

    let mut changes = Vec::new();
    if args.name.is_some() { changes.push("名称"); }
    if args.icon.is_some() { changes.push("图标"); }
    if args.color.is_some() { changes.push("颜色"); }
    if args.frequency_type.is_some() { changes.push("频率"); }
    if args.xp_per_check.is_some() { changes.push("经验值"); }

    let change_desc = if changes.is_empty() {
        "已更新".to_string()
    } else {
        format!("已更新{}", changes.join("、"))
    };

    let icon = updated.icon.as_deref().unwrap_or("");
    Ok(format!("{}：{}{}（每次打卡 +{}XP）", change_desc, icon, updated.name, updated.xp_per_check))
}

#[derive(Debug, Deserialize)]
pub struct ToolDeleteHabitArgs {
    #[serde(default)]
    pub habit_id: Option<String>,
    #[serde(default)]
    pub query: Option<String>,
}

pub fn execute_delete_habit(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolDeleteHabitArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("delete_habit 参数解析失败: {}", e))?;

    let habit = find_habit_by_query(conn, &args.habit_id, &args.query)?;

    habit_repo::delete_habit(conn, &habit.id)?;

    let icon = habit.icon.as_deref().unwrap_or("");
    Ok(format!("已删除习惯：{}{}", icon, habit.name))
}
