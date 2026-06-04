use rusqlite::Connection;
use serde::Deserialize;

use crate::db::repositories::contact_repo;
use crate::db::repositories::contact_repo::ContactMethodInput;

use super::shared::{ToolQueryArgs, ToolQueryOrIdArgs};

// ── 参数 ──

#[derive(Debug, Deserialize)]
pub struct ToolContactMethod {
    pub method_type: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct ToolCreateContactArgs {
    pub name: String,
    #[serde(default)]
    pub nickname: Option<String>,
    #[serde(default)]
    pub group_name: Option<String>,
    #[serde(default)]
    pub birthday_calendar: Option<String>,
    #[serde(default)]
    pub birthday_year: Option<i32>,
    #[serde(default)]
    pub birthday_month: Option<i32>,
    #[serde(default)]
    pub birthday_day: Option<i32>,
    #[serde(default)]
    pub contact_methods: Option<Vec<ToolContactMethod>>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ToolUpdateContactArgs {
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub nickname: Option<String>,
    #[serde(default)]
    pub group_name: Option<String>,
    #[serde(default)]
    pub birthday_calendar: Option<String>,
    #[serde(default)]
    pub birthday_year: Option<i32>,
    #[serde(default)]
    pub birthday_month: Option<i32>,
    #[serde(default)]
    pub birthday_day: Option<i32>,
    #[serde(default)]
    pub contact_methods: Option<Vec<ToolContactMethod>>,
    #[serde(default)]
    pub notes: Option<String>,
}

// ── 执行函数 ──

pub fn execute_create_contact(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolCreateContactArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("create_contact 参数解析失败: {}", e))?;

    let methods: Vec<ContactMethodInput> = args.contact_methods
        .unwrap_or_default()
        .into_iter()
        .map(|m| ContactMethodInput { method_type: m.method_type, value: m.value })
        .collect();

    let contact = contact_repo::create_contact(
        conn, &args.name,
        args.nickname.as_deref(),
        args.group_name.as_deref(),
        None,
        args.birthday_calendar.as_deref(),
        args.birthday_year,
        args.birthday_month,
        args.birthday_day,
        &methods,
        args.notes.as_deref(),
    )?;

    let mut result = format!("联系人已创建：{}", contact.name);
    if let Some(ref g) = contact.group_name {
        result.push_str(&format!("，分组：{}", g));
    }
    if let (Some(m), Some(d)) = (contact.birthday_month, contact.birthday_day) {
        let cal = contact.birthday_calendar.as_deref().unwrap_or("solar");
        let cal_label = if cal == "lunar" { "农历" } else { "阳历" };
        if let Some(y) = contact.birthday_year {
            result.push_str(&format!("，生日：{}{}年{}月{}日", cal_label, y, m, d));
        } else {
            result.push_str(&format!("，生日：{}{}月{}日", cal_label, m, d));
        }
    }
    Ok(result)
}

pub fn execute_search_contacts(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolQueryArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("search_contacts 参数解析失败: {}", e))?;

    let contacts = contact_repo::search_contacts(conn, &args.query)?;

    if contacts.is_empty() {
        return Ok(format!("没有找到匹配[{}]的联系人。", args.query));
    }

    let mut result = format!("找到{}个匹配的联系人：\n\n", contacts.len());
    for c in &contacts {
        let group = c.group_name.as_deref().unwrap_or("未分组");
        let mut line = format!("- **{}** ({})", c.name, group);
        if !c.contact_methods.is_empty() {
            let methods: Vec<String> = c.contact_methods.iter()
                .map(|m| format!("[{}]{}", m.method_type, m.value))
                .collect();
            line.push_str(&format!("，联系方式：{}", methods.join(", ")));
        }
        if let Some(ref notes) = c.notes {
            line.push_str(&format!("，备注：{}", notes));
        }
        result.push_str(&format!("{}\n", line));
    }
    Ok(result)
}

pub fn execute_list_contacts(conn: &Connection, arguments: &str) -> Result<String, String> {
    #[derive(Debug, Deserialize)]
    struct ListContactArgs {
        #[serde(default)]
        group_name: Option<String>,
    }
    let args: ListContactArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("list_contacts 参数解析失败: {}", e))?;

    let contacts = contact_repo::list_contacts(conn, args.group_name.as_deref())?;

    if contacts.is_empty() {
        let hint = match &args.group_name {
            Some(g) => format!("[{}]分组下暂无联系人", g),
            None => "还没有任何联系人。试试说[记一个联系人]来添加吧！".to_string(),
        };
        return Ok(hint);
    }

    let mut result = format!("共有{}个联系人：\n\n", contacts.len());
    use std::collections::BTreeMap;
    let mut groups: BTreeMap<String, Vec<&contact_repo::Contact>> = BTreeMap::new();
    for c in &contacts {
        let g = c.group_name.clone().unwrap_or_else(|| "未分组".to_string());
        groups.entry(g).or_default().push(c);
    }
    for (group, members) in &groups {
        result.push_str(&format!("**{}** ({}人)\n", group, members.len()));
        for m in members {
            let birthday = match (m.birthday_month, m.birthday_day) {
                (Some(month), Some(day)) => {
                    let cal = m.birthday_calendar.as_deref().unwrap_or("solar");
                    let cal_label = if cal == "lunar" { "农历" } else { "" };
                    let year_str = m.birthday_year.map(|y| format!("{}年", y)).unwrap_or_default();
                    format!("，生日：{}{}{}月{}日", cal_label, year_str, month, day)
                }
                _ => String::new(),
            };
            result.push_str(&format!("  - {}{}\n", m.name, birthday));
        }
    }
    Ok(result)
}

pub fn execute_update_contact(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolUpdateContactArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("update_contact 参数解析失败: {}", e))?;

    let contact_id: String;

    if let Some(ref id) = args.id {
        if !id.is_empty() {
            contact_id = id.clone();
        } else {
            return Err("id 不能为空".to_string());
        }
    } else if let Some(ref query) = args.query {
        if query.is_empty() {
            return Err("请提供 query 或 id".to_string());
        }
        let contacts = contact_repo::search_contacts(conn, query)?;
        if contacts.is_empty() {
            return Err(format!("没有找到匹配[{}]的联系人", query));
        }
        if contacts.len() > 1 {
            let names: Vec<String> = contacts.iter().map(|c| {
                let group = c.group_name.as_deref().unwrap_or("未分组");
                format!("\n- {} (ID: {}, 分组: {})", c.name, c.id, group)
            }).collect();
            return Err(format!(
                "找到{}个匹配的联系人：{}\n\n请告诉用户是哪一个，然后用对应的 id 重新调用 update_contact。",
                contacts.len(), names.join("")
            ));
        }
        contact_id = contacts[0].id.clone();
    } else {
        return Err("请提供 query 或 id 来指定要修改的联系人".to_string());
    }

    let methods: Option<Vec<ContactMethodInput>> = args.contact_methods.map(|ms|
        ms.into_iter().map(|m| ContactMethodInput { method_type: m.method_type, value: m.value }).collect()
    );

    let updated = contact_repo::update_contact(
        conn, &contact_id,
        args.name.as_deref(),
        args.nickname.as_deref(),
        args.group_name.as_deref(),
        None,
        args.birthday_calendar.as_deref(),
        args.birthday_year,
        args.birthday_month,
        args.birthday_day,
        methods.as_deref(),
        args.notes.as_deref(),
    )?;

    Ok(format!("联系人已更新：{}", updated.name))
}

pub fn execute_delete_contact(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolQueryOrIdArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("delete_contact 参数解析失败: {}", e))?;

    if let Some(ref id) = args.id {
        if !id.is_empty() {
            let contact = contact_repo::get_contact(conn, id)?;
            let name = contact.name.clone();
            contact_repo::delete_contact(conn, id)?;
            return Ok(format!("联系人已删除：{}", name));
        }
    }

    let query = args.query.as_deref().unwrap_or("");
    if query.is_empty() {
        return Err("请提供 query 或 id 来指定要删除的联系人".to_string());
    }

    let contacts = contact_repo::search_contacts(conn, query)?;

    if contacts.is_empty() {
        return Err(format!("没有找到匹配[{}]的联系人", query));
    }

    if contacts.len() > 1 {
        let names: Vec<String> = contacts.iter().map(|c| {
            let group = c.group_name.as_deref().unwrap_or("未分组");
            format!("\n- {} (ID: {}, 分组: {})", c.name, c.id, group)
        }).collect();
        return Err(format!(
            "找到{}个匹配的联系人：{}\n\n请告诉用户是哪一个，然后用对应的 id 重新调用 delete_contact。",
            contacts.len(), names.join("")
        ));
    }

    let c = &contacts[0];
    let name = c.name.clone();
    contact_repo::delete_contact(conn, &c.id)?;
    Ok(format!("联系人已删除：{}", name))
}
