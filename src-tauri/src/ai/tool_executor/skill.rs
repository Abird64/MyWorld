use rusqlite::Connection;

use crate::db::repositories::skill_repo;

use super::shared::{classify_matches, scored_search, MatchResult, ToolQueryArgs};

pub fn execute_list_skills(conn: &Connection, _arguments: &str) -> Result<String, String> {
    let skills = skill_repo::list_skills(conn)?;

    if skills.is_empty() {
        return Ok("六维属性尚未初始化。".to_string());
    }

    let mut result = "六维属性面板：\n\n".to_string();
    for s in &skills {
        let xp_in_level = s.total_xp % 100;
        let progress_bar = if s.total_xp > 0 {
            let filled = (xp_in_level / 10) as usize;
            let bar_len = 10usize;
            let empty = bar_len.saturating_sub(filled);
            "\u{2588}".repeat(filled) + &"\u{2591}".repeat(empty)
        } else {
            "\u{2591}".repeat(10)
        };
        result.push_str(&format!(
            "**{}** Lv.{} | \u{603b}XP: {} | [{}/100]\n{}\n\n",
            s.name, s.level, s.total_xp, xp_in_level, progress_bar
        ));
    }
    result.push_str("\u{63d0}\u{793a}\u{ff1a}\u{5b8c}\u{6210}\u{4efb}\u{52a1}\u{53ef}\u{83b7}\u{5f97}\u{5404}\u{5c5e}\u{6027}\u{7ecf}\u{9a8c}\u{503c}\u{63d0}\u{5347}\u{3002}");
    Ok(result)
}

pub fn execute_get_task_skills(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolQueryArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("get_task_skills 参数解析失败: {}", e))?;

    let scored = scored_search(conn, &args.query, None, None, &[])?;

    let task = match classify_matches(&scored) {
        MatchResult::None => return Err(format!("没有找到匹配[{}]的任务", args.query)),
        MatchResult::Unique(idx) => &scored[idx].0,
        _ => {
            let names: Vec<String> = scored.iter().map(|(t, _)| t.title.clone()).collect();
            return Err(format!(
                "找到多个匹配任务：{}。请更具体地指定要查看哪个。",
                names.join("、")
            ));
        }
    };

    let task_skills = skill_repo::get_task_skills(conn, &task.id)?;

    if task_skills.is_empty() {
        return Ok(format!("任务[{}]尚未分配属性经验值。在任务详情中可为各属性设置XP加成。", task.title));
    }

    let skills = skill_repo::list_skills(conn)?;
    let mut result = format!("任务[{}]的属性加成：\n\n", task.title);
    for ts in &task_skills {
        let skill_name = skills.iter()
            .find(|s| s.id == ts.skill_id)
            .map(|s| s.name.as_str())
            .unwrap_or("未知");
        result.push_str(&format!("- {}：+{} XP\n", skill_name, ts.xp_amount));
    }
    Ok(result)
}
