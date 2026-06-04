use chrono::{Datelike, Duration, NaiveDate, Weekday};

// ========== 日期解析 ==========

const WEEKDAY_NAMES: &[(&str, Weekday)] = &[
    ("周一", Weekday::Mon), ("星期一", Weekday::Mon),
    ("周二", Weekday::Tue), ("星期二", Weekday::Tue),
    ("周三", Weekday::Wed), ("星期三", Weekday::Wed),
    ("周四", Weekday::Thu), ("星期四", Weekday::Thu),
    ("周五", Weekday::Fri), ("星期五", Weekday::Fri),
    ("周六", Weekday::Sat), ("星期六", Weekday::Sat),
    ("周日", Weekday::Sun), ("星期天", Weekday::Sun), ("星期日", Weekday::Sun),
];

pub fn resolve_date_expression(expr: &str, today: NaiveDate) -> Result<(String, String), String> {
    let cleaned = expr.trim();

    match cleaned {
        "今天" => {
            let s = today.format("%Y-%m-%d").to_string();
            return Ok((s, format!("今天 = {}", fmt_date_cn(today))));
        }
        "明天" => {
            let d = today.succ_opt().ok_or("日期溢出")?;
            let s = d.format("%Y-%m-%d").to_string();
            return Ok((s, format!("明天 = {}", fmt_date_cn(d))));
        }
        "后天" => {
            let d = today
                .succ_opt()
                .and_then(|d| d.succ_opt())
                .ok_or("日期溢出")?;
            let s = d.format("%Y-%m-%d").to_string();
            return Ok((s, format!("后天 = {}", fmt_date_cn(d))));
        }
        "大后天" => {
            let d = today
                .succ_opt()
                .and_then(|d| d.succ_opt())
                .and_then(|d| d.succ_opt())
                .ok_or("日期溢出")?;
            let s = d.format("%Y-%m-%d").to_string();
            return Ok((s, format!("大后天 = {}", fmt_date_cn(d))));
        }
        "昨天" => {
            let d = today.pred_opt().ok_or("日期溢出")?;
            let s = d.format("%Y-%m-%d").to_string();
            return Ok((s, format!("昨天 = {}", fmt_date_cn(d))));
        }
        "前天" => {
            let d = today
                .pred_opt()
                .and_then(|d| d.pred_opt())
                .ok_or("日期溢出")?;
            let s = d.format("%Y-%m-%d").to_string();
            return Ok((s, format!("前天 = {}", fmt_date_cn(d))));
        }
        "周末" | "这周末" | "本周周末" => {
            let (sat, sun) = weekend_of_week(today)?;
            let s = format!("{}~{}", sat.format("%Y-%m-%d"), sun.format("%Y-%m-%d"));
            return Ok((s, format!("本周末 = {} 至 {}", fmt_date_cn(sat), fmt_date_cn(sun))));
        }
        "下周末" | "下个周末" => {
            let next = today + Duration::days(7);
            let (sat, sun) = weekend_of_week(next)?;
            let s = format!("{}~{}", sat.format("%Y-%m-%d"), sun.format("%Y-%m-%d"));
            return Ok((s, format!("下周末 = {} 至 {}", fmt_date_cn(sat), fmt_date_cn(sun))));
        }
        _ => {}
    }

    if let Some(result) = try_parse_weekday(cleaned, today) {
        return result;
    }

    if let Some(result) = try_parse_offset(cleaned, today) {
        return result;
    }

    if let Some(result) = try_parse_month_day(cleaned, today) {
        return result;
    }

    if let Some(result) = try_parse_month_edge(cleaned, today) {
        return result;
    }

    if let Ok(d) = NaiveDate::parse_from_str(cleaned, "%Y-%m-%d") {
        let s = d.format("%Y-%m-%d").to_string();
        return Ok((s, format!("日期: {}", fmt_date_cn(d))));
    }

    Err(format!(
        "无法解析日期表达式[{}]。请直接提供 YYYY-MM-DD 格式的日期。",
        cleaned
    ))
}

// ── 星期解析 ──

fn try_parse_weekday(expr: &str, today: NaiveDate) -> Option<Result<(String, String), String>> {
    let (prefix, offset_weeks) = if expr.starts_with("下下周") {
        ("下下周", 2)
    } else if expr.starts_with("这周") || expr.starts_with("本周") {
        ("这周", 0)
    } else if expr.starts_with("下周") || expr.starts_with("下个星期") {
        ("下周", 1)
    } else if expr.starts_with("上周") || expr.starts_with("上个星期") {
        ("上周", -1)
    } else {
        ("", -999)
    };

    let day_part = if prefix.is_empty() {
        expr
    } else {
        expr.strip_prefix(prefix).unwrap_or(expr)
    };

    let Some(target_wd) = WEEKDAY_NAMES.iter().find(|(name, _)| day_part == *name) else {
        return None;
    };
    let target_wd = target_wd.1;

    let date = if offset_weeks == -999 {
        match next_weekday(today, target_wd) {
            Ok((d, _)) => d,
            Err(_) => return None,
        }
    } else {
        let monday = monday_of_week(today);
        let d = monday + Duration::days(offset_weeks as i64 * 7);
        match next_weekday_from(d, target_wd) {
            Ok((date, _)) => date,
            Err(_) => return None,
        }
    };

    let s = date.format("%Y-%m-%d").to_string();
    Some(Ok((s, format!("{} = {}", expr, fmt_date_cn(date)))))
}

// ── 偏移量解析 ──

fn try_parse_offset(expr: &str, today: NaiveDate) -> Option<Result<(String, String), String>> {
    let re_days = regex_lite_match(expr);
    let re_weeks = regex_lite_match(expr);
    let re_months = regex_lite_match(expr);

    if let Some(n_str) = re_days {
        let n: i64 = n_str.parse().ok()?;
        let d = today + Duration::days(n);
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{} = {}天后 = {}", expr, n, fmt_date_cn(d)))));
    }
    if let Some(n_str) = re_weeks {
        let n: i64 = n_str.parse().ok()?;
        let d = today + Duration::days(n * 7);
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{} = {}周后 = {}", expr, n, fmt_date_cn(d)))));
    }
    if let Some(n_str) = re_months {
        let n: u32 = n_str.parse().ok()?;
        let d = add_months(today, n)?;
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{} = {}个月后 = {}", expr, n, fmt_date_cn(d)))));
    }
    None
}

// ── 月日解析 ──

fn try_parse_month_day(expr: &str, today: NaiveDate) -> Option<Result<(String, String), String>> {
    let re_full = regex_lite_captures_full_date(expr);
    if let Some((m_str, d_str)) = re_full {
        let month: u32 = m_str.parse().ok()?;
        let day: u32 = d_str.parse().ok()?;
        let year = today.year();
        let d = NaiveDate::from_ymd_opt(year, month, day)?;
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{} = {}", expr, fmt_date_cn(d)))));
    }

    let re_rel = regex_lite_captures_rel_month(expr);
    if let Some((prefix, day_str)) = re_rel {
        let day: u32 = day_str.parse().ok()?;
        let (year, month) = match prefix.as_str() {
            "这个月" => (today.year(), today.month()),
            "下个月" | "下月" => {
                if today.month() == 12 {
                    (today.year() + 1, 1)
                } else {
                    (today.year(), today.month() + 1)
                }
            }
            _ => return None,
        };
        let d = NaiveDate::from_ymd_opt(year, month, day)?;
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{} = {}", expr, fmt_date_cn(d)))));
    }

    let re_day = regex_lite_captures_day(expr);
    if let Some(day_str) = re_day {
        let day: u32 = day_str.parse().ok()?;
        let d = NaiveDate::from_ymd_opt(today.year(), today.month(), day)?;
        let s = d.format("%Y-%m-%d").to_string();
        return Some(Ok((s, format!("{}号 = {}", day, fmt_date_cn(d)))));
    }

    None
}

// ── 月边界 ──

fn try_parse_month_edge(expr: &str, today: NaiveDate) -> Option<Result<(String, String), String>> {
    let (offset, edge) = match expr {
        "月底" | "月末" | "这个月底" | "这个月末" => (0, "end"),
        "月初" | "这个月初" => (0, "start"),
        "下个月底" | "下个月末" | "下月底" | "下月末" => (1, "end"),
        "下个月初" | "下月初" => (1, "start"),
        _ => return None,
    };

    let (year, month) = if today.month() == 12 {
        (today.year() + offset, if offset > 0 { 1 } else { 12 })
    } else {
        (today.year(), today.month() + offset as u32)
    };

    let d = match edge {
        "end" => last_day_of_month(year, month)?,
        "start" => NaiveDate::from_ymd_opt(year, month, 1)?,
        _ => return None,
    };

    let label = match edge { "end" => "最后一天", "start" => "第一天", _ => "" };
    let s = d.format("%Y-%m-%d").to_string();
    Some(Ok((s, format!("{} = {} {}", expr, format!("{}年{}月", year, month), label))))
}

// ── 日期计算辅助 ──

fn monday_of_week(date: NaiveDate) -> NaiveDate {
    let num = date.weekday().num_days_from_monday();
    date - Duration::days(num as i64)
}

fn next_weekday(today: NaiveDate, target: Weekday) -> Result<(NaiveDate, Option<String>), String> {
    let today_wd = today.weekday();
    let days_ahead = (target.num_days_from_monday() as i32 - today_wd.num_days_from_monday() as i32 + 7) % 7;
    let d = if days_ahead == 0 {
        today
    } else {
        today + Duration::days(days_ahead as i64)
    };
    Ok((d, None))
}

fn next_weekday_from(from: NaiveDate, target: Weekday) -> Result<(NaiveDate, Option<String>), String> {
    let from_wd = from.weekday();
    let days_ahead = (target.num_days_from_monday() as i32 - from_wd.num_days_from_monday() as i32 + 7) % 7;
    let d = from + Duration::days(days_ahead as i64);
    Ok((d, None))
}

fn weekend_of_week(date: NaiveDate) -> Result<(NaiveDate, NaiveDate), String> {
    let monday = monday_of_week(date);
    let sat = monday + Duration::days(5);
    let sun = monday + Duration::days(6);
    Ok((sat, sun))
}

fn add_months(date: NaiveDate, n: u32) -> Option<NaiveDate> {
    let total_months = date.month() + n;
    let year_offset: i32 = ((total_months - 1) / 12) as i32;
    let new_month = (total_months - 1) % 12 + 1;
    let max_day = days_in_month(date.year() + year_offset, new_month);
    let day = date.day().min(max_day);
    NaiveDate::from_ymd_opt(date.year() + year_offset, new_month, day)
}

fn last_day_of_month(year: i32, month: u32) -> Option<NaiveDate> {
    let day = days_in_month(year, month);
    NaiveDate::from_ymd_opt(year, month, day)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

pub fn fmt_date_cn(date: NaiveDate) -> String {
    let weekdays_cn = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    format!(
        "{}年{}月{}日 {}",
        date.year(),
        date.month(),
        date.day(),
        weekdays_cn[date.weekday().num_days_from_monday() as usize]
    )
}

// ── 简单的正则辅助 ──

fn regex_lite_match(text: &str) -> Option<String> {
    let mut num_str = String::new();
    let mut in_num = false;
    for c in text.chars() {
        if c.is_ascii_digit() {
            num_str.push(c);
            in_num = true;
        } else if in_num {
            break;
        }
    }
    if num_str.is_empty() {
        return None;
    }
    Some(num_str)
}

fn regex_lite_captures_full_date(text: &str) -> Option<(String, String)> {
    let chars: Vec<char> = text.chars().collect();
    let mut nums: Vec<String> = Vec::new();
    let mut current = String::new();
    for &c in &chars {
        if c.is_ascii_digit() {
            current.push(c);
        } else {
            if !current.is_empty() {
                nums.push(current.clone());
                current.clear();
            }
        }
    }
    if !current.is_empty() {
        nums.push(current);
    }

    if text.contains('月') && (text.contains('号') || text.contains('日')) {
        if nums.len() >= 2 {
            return Some((nums[0].clone(), nums[1].clone()));
        }
    }
    None
}

fn regex_lite_captures_rel_month(text: &str) -> Option<(String, String)> {
    let chars: Vec<char> = text.chars().collect();
    let mut nums: Vec<String> = Vec::new();
    let mut current = String::new();
    for &c in &chars {
        if c.is_ascii_digit() {
            current.push(c);
        } else {
            if !current.is_empty() {
                nums.push(current.clone());
                current.clear();
            }
        }
    }
    if !current.is_empty() {
        nums.push(current);
    }

    if nums.len() >= 1 {
        let prefix = if text.contains("这个月") {
            "这个月".to_string()
        } else if text.contains("下个月") {
            "下个月".to_string()
        } else if text.contains("下月") {
            "下月".to_string()
        } else {
            return None;
        };
        return Some((prefix, nums[0].clone()));
    }

    None
}

fn regex_lite_captures_day(text: &str) -> Option<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut nums: Vec<String> = Vec::new();
    let mut current = String::new();
    for &c in &chars {
        if c.is_ascii_digit() {
            current.push(c);
        } else {
            if !current.is_empty() {
                nums.push(current.clone());
                current.clear();
            }
        }
    }
    if !current.is_empty() {
        nums.push(current);
    }

    if nums.len() == 1 && (text.contains('号') || text.contains('日')) {
        return Some(nums[0].clone());
    }
    None
}
