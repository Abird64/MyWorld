use chrono::Datelike;
use lunardate::LunarDate;
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContactMethod {
    pub id: String,
    pub contact_id: String,
    pub method_type: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Contact {
    pub id: String,
    pub name: String,
    pub nickname: Option<String>,
    pub group_name: Option<String>,
    pub avatar_path: Option<String>,
    pub birthday_calendar: Option<String>,
    pub birthday_year: Option<i32>,
    pub birthday_month: Option<i32>,
    pub birthday_day: Option<i32>,
    pub contact_methods: Vec<ContactMethod>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

const CONTACT_COLUMNS: &str = "id, name, nickname, group_name, avatar_path, birthday_calendar, birthday_year, birthday_month, birthday_day, notes, created_at, updated_at";

fn contact_from_row(row: &Row) -> rusqlite::Result<Contact> {
    Ok(Contact {
        id: row.get("id")?,
        name: row.get("name")?,
        nickname: row.get("nickname")?,
        group_name: row.get("group_name")?,
        avatar_path: row.get("avatar_path")?,
        birthday_calendar: row.get("birthday_calendar")?,
        birthday_year: row.get("birthday_year")?,
        birthday_month: row.get("birthday_month")?,
        birthday_day: row.get("birthday_day")?,
        contact_methods: Vec::new(),
        notes: row.get("notes")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

/// 加载某个联系人的所有联系方式
fn load_methods(conn: &Connection, contact_id: &str) -> Result<Vec<ContactMethod>, String> {
    let mut stmt = conn
        .prepare("SELECT id, contact_id, method_type, value FROM contact_methods WHERE contact_id = ?1 ORDER BY created_at ASC")
        .map_err(|e| format!("Failed to load methods: {}", e))?;
    let rows = stmt.query_map(params![contact_id], |row| {
        Ok(ContactMethod {
            id: row.get(0)?,
            contact_id: row.get(1)?,
            method_type: row.get(2)?,
            value: row.get(3)?,
        })
    })
    .map_err(|e| format!("Failed to load methods: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect methods: {}", e));
    rows
}

/// 填充 contact 的 contact_methods 字段
fn fill_methods(conn: &Connection, contacts: &mut [Contact]) -> Result<(), String> {
    // 收集所有 contact ID
    let ids: Vec<String> = contacts.iter().map(|c| c.id.clone()).collect();
    if ids.is_empty() {
        return Ok(());
    }

    // 一次性查询所有相关 methods
    let placeholders: Vec<String> = ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let sql = format!(
        "SELECT id, contact_id, method_type, value FROM contact_methods WHERE contact_id IN ({}) ORDER BY created_at ASC",
        placeholders.join(", ")
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Failed to load methods: {}", e))?;

    let params_refs: Vec<&dyn rusqlite::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();

    let methods: Vec<ContactMethod> = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(ContactMethod {
                id: row.get(0)?,
                contact_id: row.get(1)?,
                method_type: row.get(2)?,
                value: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to load methods: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect methods: {}", e))?;

    // 分配到各个 contact
    for contact in contacts.iter_mut() {
        contact.contact_methods = methods
            .iter()
            .filter(|m| m.contact_id == contact.id)
            .cloned()
            .collect();
    }

    Ok(())
}

/// 替换联系人的所有联系方式（先删后插）
fn replace_methods(conn: &Connection, contact_id: &str, methods: &[ContactMethodInput]) -> Result<(), String> {
    conn.execute("DELETE FROM contact_methods WHERE contact_id = ?1", params![contact_id])
        .map_err(|e| format!("Failed to clear methods: {}", e))?;

    for m in methods {
        let id = gen_id();
        conn.execute(
            "INSERT INTO contact_methods (id, contact_id, method_type, value, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, contact_id, m.method_type, m.value, now()],
        )
        .map_err(|e| format!("Failed to insert method: {}", e))?;
    }

    Ok(())
}

fn now() -> String {
    chrono::Local::now().to_rfc3339()
}

fn gen_id() -> String {
    nanoid::nanoid!()
}

#[derive(Debug, Clone)]
pub struct ContactMethodInput {
    pub method_type: String,
    pub value: String,
}

/// 创建联系人
pub fn create_contact(
    conn: &Connection,
    name: &str,
    nickname: Option<&str>,
    group_name: Option<&str>,
    avatar_path: Option<&str>,
    birthday_calendar: Option<&str>,
    birthday_year: Option<i32>,
    birthday_month: Option<i32>,
    birthday_day: Option<i32>,
    contact_methods: &[ContactMethodInput],
    notes: Option<&str>,
) -> Result<Contact, String> {
    let id = gen_id();
    let time = now();

    conn.execute(
        "INSERT INTO contacts (id, name, nickname, group_name, avatar_path, birthday_calendar, birthday_year, birthday_month, birthday_day, notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![id, name, nickname, group_name, avatar_path, birthday_calendar, birthday_year, birthday_month, birthday_day, notes, time, time],
    )
    .map_err(|e| format!("Failed to create contact: {}", e))?;

    for m in contact_methods {
        let mid = gen_id();
        conn.execute(
            "INSERT INTO contact_methods (id, contact_id, method_type, value, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![mid, id, m.method_type, m.value, time],
        )
        .map_err(|e| format!("Failed to insert method: {}", e))?;
    }

    get_contact(conn, &id)
}

/// 获取单个联系人
pub fn get_contact(conn: &Connection, id: &str) -> Result<Contact, String> {
    let mut contact = conn.query_row(
        &format!("SELECT {} FROM contacts WHERE id = ?1", CONTACT_COLUMNS),
        params![id],
        contact_from_row,
    )
    .map_err(|e| format!("Contact not found: {}", e))?;
    contact.contact_methods = load_methods(conn, id)?;
    Ok(contact)
}

/// 获取联系人列表（可按分组筛选）
pub fn list_contacts(
    conn: &Connection,
    group_name: Option<&str>,
) -> Result<Vec<Contact>, String> {
    let mut sql = format!("SELECT {} FROM contacts WHERE 1=1", CONTACT_COLUMNS);
    let mut params_vec: Vec<String> = Vec::new();

    if let Some(g) = group_name {
        sql.push_str(" AND group_name = ?");
        params_vec.push(g.to_string());
    }

    sql.push_str(" ORDER BY created_at DESC");

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let mut contacts = stmt
        .query_map(param_refs.as_slice(), contact_from_row)
        .map_err(|e| format!("Failed to query contacts: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect contacts: {}", e))?;

    fill_methods(conn, &mut contacts)?;
    Ok(contacts)
}

/// 更新联系人
pub fn update_contact(
    conn: &Connection,
    id: &str,
    name: Option<&str>,
    nickname: Option<&str>,
    group_name: Option<&str>,
    avatar_path: Option<&str>,
    birthday_calendar: Option<&str>,
    birthday_year: Option<i32>,
    birthday_month: Option<i32>,
    birthday_day: Option<i32>,
    contact_methods: Option<&[ContactMethodInput]>,
    notes: Option<&str>,
) -> Result<Contact, String> {
    let time = now();

    let mut sets: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(v) = name {
        sets.push("name = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = nickname {
        sets.push("nickname = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = group_name {
        sets.push("group_name = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = avatar_path {
        sets.push("avatar_path = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = birthday_calendar {
        sets.push("birthday_calendar = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }
    if let Some(v) = birthday_year {
        sets.push("birthday_year = ?".to_string());
        param_values.push(Box::new(v));
    }
    if let Some(v) = birthday_month {
        sets.push("birthday_month = ?".to_string());
        param_values.push(Box::new(v));
    }
    if let Some(v) = birthday_day {
        sets.push("birthday_day = ?".to_string());
        param_values.push(Box::new(v));
    }
    if let Some(v) = notes {
        sets.push("notes = ?".to_string());
        param_values.push(Box::new(v.to_string()));
    }

    if !sets.is_empty() {
        sets.push("updated_at = ?".to_string());
        param_values.push(Box::new(time));

        let sql = format!(
            "UPDATE contacts SET {} WHERE id = ?",
            sets.join(", ")
        );
        param_values.push(Box::new(id.to_string()));

        let param_refs: Vec<&dyn rusqlite::ToSql> = param_values
            .iter()
            .map(|v| v.as_ref() as &dyn rusqlite::ToSql)
            .collect();

        conn.execute(&sql, param_refs.as_slice())
            .map_err(|e| format!("Failed to update contact: {}", e))?;
    }

    // 如果传入了 contact_methods，则替换
    if let Some(methods) = contact_methods {
        replace_methods(conn, id, methods)?;
    }

    get_contact(conn, id)
}

/// 删除联系人
pub fn delete_contact(conn: &Connection, id: &str) -> Result<u64, String> {
    let affected = conn.execute("DELETE FROM contacts WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete contact: {}", e))?;

    Ok(affected as u64)
}

/// 搜索联系人（按 name / nickname / notes）
pub fn search_contacts(conn: &Connection, query: &str) -> Result<Vec<Contact>, String> {
    let pattern = format!("%{}%", query);
    let sql = format!(
        "SELECT {} FROM contacts WHERE name LIKE ?1 OR nickname LIKE ?1 OR notes LIKE ?1 ORDER BY created_at DESC",
        CONTACT_COLUMNS
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare search: {}", e))?;

    let mut contacts = stmt
        .query_map(params![pattern], contact_from_row)
        .map_err(|e| format!("Failed to search contacts: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect search results: {}", e))?;

    fill_methods(conn, &mut contacts)?;
    Ok(contacts)
}

#[derive(Debug, Serialize)]
pub struct BirthdayInfo {
    pub contact_id: String,
    pub name: String,
    pub birthday_year: Option<i32>,
    pub birthday_month: i32,
    pub birthday_day: i32,
    pub birthday_calendar: String,
    pub upcoming_date: String,
    pub upcoming_month: i32,
    pub upcoming_day: i32,
    pub upcoming_age: Option<i32>,
    pub days_remaining: i32,
}

/// 列出所有有生日信息的联系人
pub fn list_all_birthdays(conn: &Connection) -> Result<Vec<BirthdayInfo>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, birthday_year, birthday_month, birthday_day, birthday_calendar
             FROM contacts
             WHERE birthday_month IS NOT NULL AND birthday_day IS NOT NULL
             ORDER BY birthday_month ASC, birthday_day ASC",
        )
        .map_err(|e| format!("Failed to prepare list_all_birthdays: {}", e))?;

    let today = chrono::Local::now().date_naive();
    let current_year = today.year();

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let year: Option<i32> = row.get(2)?;
            let month: i32 = row.get(3)?;
            let day: i32 = row.get(4)?;
            let cal: Option<String> = row.get(5)?;
            Ok((id, name, year, month, day, cal))
        })
        .map_err(|e| format!("Failed to query birthdays: {}", e))?;

    let mut results = Vec::new();
    for row in rows {
        let (id, name, year, month, day, cal) = row.map_err(|e| format!("Failed to read row: {}", e))?;
        let calendar = cal.as_deref().unwrap_or("solar").to_string();
        let is_lunar = calendar == "lunar";

        // 计算即将到来的生日（公历日期）
        let solar_this = if is_lunar {
            LunarDate::new(current_year, month as u32, day as u32, false)
                .to_solar_date().ok()
        } else {
            chrono::NaiveDate::from_ymd_opt(current_year, month as u32, day as u32)
        };

        let solar_next = if is_lunar {
            LunarDate::new(current_year + 1, month as u32, day as u32, false)
                .to_solar_date().ok()
        } else {
            chrono::NaiveDate::from_ymd_opt(current_year + 1, month as u32, day as u32)
        };

        let upcoming = match (solar_this, solar_next) {
            (Some(d), _) if d >= today => d,
            (_, Some(d)) => d,
            (Some(d), None) => d,
            (None, None) => continue,
        };

        let days_remaining = (upcoming - today).num_days() as i32;
        let upcoming_age = year.map(|y| upcoming.year() - y);

        results.push(BirthdayInfo {
            contact_id: id,
            name,
            birthday_year: year,
            birthday_month: month,
            birthday_day: day,
            birthday_calendar: calendar,
            upcoming_date: upcoming.to_string(),
            upcoming_month: upcoming.month() as i32,
            upcoming_day: upcoming.day() as i32,
            upcoming_age,
            days_remaining,
        });
    }

    results.sort_by(|a, b| a.days_remaining.cmp(&b.days_remaining));
    Ok(results)
}

/// 获取未来 N 天内过生日的联系人
pub fn list_upcoming_birthdays(conn: &Connection, days_ahead: i32) -> Result<Vec<BirthdayInfo>, String> {
    let all = list_all_birthdays(conn)?;
    Ok(all.into_iter().filter(|b| b.days_remaining <= days_ahead).collect())
}
