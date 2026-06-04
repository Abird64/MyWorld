use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlowLedgerEntry {
    pub id: String,
    pub asset_type: String,     // 'glow' | 'micro_ticket' | 'shimmer_ticket'
    pub change_amount: i32,     // 正数=收入，负数=支出
    pub balance_after: i32,
    pub reason: String,
    pub source_desc: String,
    pub related_id: String,
    pub created_at: String,
}

/// Record a ledger entry. Must be called AFTER the balance update.
pub fn record_entry(
    conn: &Connection,
    asset_type: &str,
    change_amount: i32,
    balance_after: i32,
    reason: &str,
    source_desc: &str,
    related_id: &str,
) -> Result<(), String> {
    let id = nanoid::nanoid!();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, asset_type, change_amount, balance_after, reason, source_desc, related_id, now],
    )
    .map_err(|e| format!("Failed to record glow ledger: {}", e))?;
    Ok(())
}

/// Query ledger entries with optional filters
pub fn list_entries(
    conn: &Connection,
    asset_type: Option<&str>,
    reason: Option<&str>,
    limit: i32,
    offset: i32,
) -> Result<(Vec<GlowLedgerEntry>, i32), String> {
    let mut where_clauses = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(at) = asset_type {
        where_clauses.push("asset_type = ?".to_string());
        param_values.push(Box::new(at.to_string()));
    }
    if let Some(r) = reason {
        where_clauses.push("reason = ?".to_string());
        param_values.push(Box::new(r.to_string()));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // Count total
    let count_sql = format!("SELECT COUNT(*) FROM glow_ledger {}", where_sql);
    let mut count_stmt = conn.prepare(&count_sql)
        .map_err(|e| format!("Failed to prepare count: {}", e))?;

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let total: i32 = count_stmt.query_row(params_refs.as_slice(), |row| row.get(0))
        .map_err(|e| format!("Failed to count ledger: {}", e))?;

    // Query entries
    let query_sql = format!(
        "SELECT id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at
         FROM glow_ledger {} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );
    let mut query_stmt = conn.prepare(&query_sql)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut all_params: Vec<Box<dyn rusqlite::types::ToSql>> = param_values;
    all_params.push(Box::new(limit));
    all_params.push(Box::new(offset));

    let all_refs: Vec<&dyn rusqlite::types::ToSql> = all_params.iter().map(|p| p.as_ref()).collect();
    let entries = query_stmt.query_map(all_refs.as_slice(), |row| {
        Ok(GlowLedgerEntry {
            id: row.get(0)?,
            asset_type: row.get(1)?,
            change_amount: row.get(2)?,
            balance_after: row.get(3)?,
            reason: row.get(4)?,
            source_desc: row.get(5)?,
            related_id: row.get(6)?,
            created_at: row.get(7)?,
        })
    })
    .map_err(|e| format!("Failed to query ledger: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect ledger: {}", e))?;

    Ok((entries, total))
}
