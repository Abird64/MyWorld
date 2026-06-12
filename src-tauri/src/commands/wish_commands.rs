use chrono::Utc;
use nanoid::nanoid;
use serde::Deserialize;
use tauri::State;

use crate::db::connection::DbState;
use crate::db::repositories::wish_repo::{Wish, WishDraw, GlowBalance, InventoryItem, WishRepository};

// === Wish Commands ===

#[tauri::command]
pub fn list_wishes(
    state: State<'_, DbState>,
    status: Option<String>,
) -> Result<Vec<Wish>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);
    repo.list_wishes(status.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_wish(
    state: State<'_, DbState>,
    id: String,
) -> Result<Option<Wish>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);
    repo.get_wish(&id)
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct CreateWishInput {
    pub title: String,
    pub description: Option<String>,
    pub level: i32,
    #[serde(default)]
    pub cost_glow: i32,
    pub quantity: Option<i32>,  // -1 表示无限，默认为1
}

#[tauri::command]
pub fn create_wish(
    state: State<'_, DbState>,
    input: CreateWishInput,
) -> Result<Wish, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);

    let now = Utc::now().to_rfc3339();
    let wish = Wish {
        id: nanoid!(),
        title: input.title,
        description: input.description,
        level: input.level,
        cost_glow: input.cost_glow,
        quantity: input.quantity.unwrap_or(1),
        achieved_count: 0,
        status: "active".to_string(),
        achieved_at: None,
        sort_order: 0,
        created_at: now.clone(),
        updated_at: now,
    };

    repo.create_wish(&wish)
        .map_err(|e| e.to_string())?;

    Ok(wish)
}

#[derive(Deserialize)]
pub struct UpdateWishInput {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub level: i32,
    #[serde(default)]
    pub cost_glow: i32,
    pub quantity: Option<i32>,
}

#[tauri::command]
pub fn update_wish(
    state: State<'_, DbState>,
    input: UpdateWishInput,
) -> Result<Wish, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);

    let existing = repo.get_wish(&input.id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "心愿不存在".to_string())?;

    let updated = Wish {
        id: input.id,
        title: input.title,
        description: input.description,
        level: input.level,
        cost_glow: input.cost_glow,
        quantity: input.quantity.unwrap_or(existing.quantity),
        achieved_count: existing.achieved_count,
        status: existing.status,
        achieved_at: existing.achieved_at,
        sort_order: existing.sort_order,
        created_at: existing.created_at,
        updated_at: Utc::now().to_rfc3339(),
    };

    repo.update_wish(&updated)
        .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
pub fn delete_wish(
    state: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);
    repo.delete_wish(&id)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn mark_wish_achieved(
    state: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);
    repo.mark_wish_achieved(&id)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// === Balance Commands ===

#[tauri::command]
pub fn get_glow_balance(
    state: State<'_, DbState>,
) -> Result<GlowBalance, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);
    repo.get_balance()
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct AddGlowInput {
    pub amount: i32,
    pub source: String, // 'task', 'journal', 'pomodoro', 'level_up', etc.
}

#[tauri::command]
pub fn add_glow(
    state: State<'_, DbState>,
    input: AddGlowInput,
) -> Result<GlowBalance, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);

    repo.update_glow(input.amount)
        .map_err(|e| e.to_string())?;

    // 记录萤火账本
    {
        let balance_after: i32 = conn
            .query_row("SELECT glow_amount FROM glow_balances WHERE id = 'user'", [], |row| row.get(0))
            .unwrap_or(0);
        let ledger_id = nanoid!();
        let now = Utc::now().to_rfc3339();
        let source_desc = format!("手动添加萤火 ({})", input.source);
        let _ = conn.execute(
            "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
             VALUES (?1, 'glow', ?2, ?3, 'manual_add', ?4, '', ?5)",
            rusqlite::params![ledger_id, input.amount, balance_after, source_desc, now],
        );
    }

    repo.get_balance()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_tickets(
    state: State<'_, DbState>,
    micro: i32,
    shimmer: i32,
) -> Result<GlowBalance, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);

    repo.update_tickets(micro, shimmer)
        .map_err(|e| e.to_string())?;

    // 记录萤火账本
    let now = Utc::now().to_rfc3339();
    if micro > 0 {
        let balance_after: i32 = conn
            .query_row("SELECT micro_tickets FROM glow_balances WHERE id = 'user'", [], |row| row.get(0))
            .unwrap_or(0);
        let ledger_id = nanoid!();
        let _ = conn.execute(
            "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
             VALUES (?1, 'micro_ticket', ?2, ?3, 'manual_add', '手动添加微光奖券', '', ?4)",
            rusqlite::params![ledger_id, micro, balance_after, now],
        );
    }
    if shimmer > 0 {
        let balance_after: i32 = conn
            .query_row("SELECT shimmer_tickets FROM glow_balances WHERE id = 'user'", [], |row| row.get(0))
            .unwrap_or(0);
        let ledger_id = nanoid!();
        let _ = conn.execute(
            "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
             VALUES (?1, 'shimmer_ticket', ?2, ?3, 'manual_add', '手动添加拾光奖券', '', ?4)",
            rusqlite::params![ledger_id, shimmer, balance_after, now],
        );
    }

    repo.get_balance()
        .map_err(|e| e.to_string())
}

// === Draw Commands ===

#[tauri::command]
pub fn list_draws(
    state: State<'_, DbState>,
    limit: Option<i32>,
) -> Result<Vec<WishDraw>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);
    repo.list_draws(limit.unwrap_or(20))
        .map_err(|e| e.to_string())
}

/// Draw with level-based probability + pity progress
/// Micro: L1 80% / L2 20%, pity at 30
/// Shimmer: L3 90% / L4 10%, pity at 80
/// Pity is now self-select (not auto-trigger)
#[tauri::command]
pub fn draw_wish(
    state: State<'_, DbState>,
    ticket_type: String, // 'micro' or 'shimmer'
) -> Result<WishDrawResult, String> {
    use rand::seq::SliceRandom;
    use rand::thread_rng;
    use rand::Rng;

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);

    // Level probability
    let (level_weights, pity_threshold): (Vec<(i32, f64)>, i32) = if ticket_type == "micro" {
        (vec![(1, 0.6), (2, 0.4)], 30)
    } else {
        (vec![(3, 0.8), (4, 0.2)], 80)
    };

    // 先检查心愿池是否有可用心愿，再扣奖券
    let mut has_any_wish = false;
    for (level, _) in &level_weights {
        if !repo.get_wishes_by_level(*level).map_err(|e| e.to_string())?.is_empty() {
            has_any_wish = true;
            break;
        }
    }
    if !has_any_wish {
        return Err("心愿池为空，请先添加心愿".to_string());
    }

    // Check and consume ticket
    if !repo.consume_ticket(&ticket_type).map_err(|e| e.to_string())? {
        return Err("奖券不足，请先购买或获取奖券".to_string());
    }

    // 记录奖券消耗账本
    {
        let asset_type = if ticket_type == "micro" { "micro_ticket" } else { "shimmer_ticket" };
        let column = if ticket_type == "micro" { "micro_tickets" } else { "shimmer_tickets" };
        let balance_after: i32 = conn
            .query_row(&format!("SELECT {} FROM glow_balances WHERE id = 'user'", column), [], |row| row.get(0))
            .unwrap_or(0);
        let ledger_id = nanoid!();
        let now = Utc::now().to_rfc3339();
        let ticket_label = if ticket_type == "micro" { "微光奖券" } else { "拾光奖券" };
        let _ = conn.execute(
            "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
             VALUES (?1, ?2, -1, ?3, 'draw_consume', ?4, '', ?5)",
            rusqlite::params![ledger_id, asset_type, balance_after, format!("消耗{}抽奖", ticket_label), now],
        );
    }

    // Get current pity count
    let pity_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM wish_draws WHERE ticket_type = ?1 AND result_type != 'pity' AND created_at > datetime('now', '-30 days')",
            [&ticket_type],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Roll for level, then pick random wish from that level
    let mut rng = thread_rng();
    let level_roll: f64 = rng.gen();
    let mut cumulative = 0.0;
    let mut target_level = level_weights[0].0;
    for (level, prob) in &level_weights {
        cumulative += prob;
        if level_roll < cumulative {
            target_level = *level;
            break;
        }
    }

    let wishes = repo.get_wishes_by_level(target_level)
        .map_err(|e| e.to_string())?;

    // If target level is empty, fallback to any level in the pool
    let selected = if wishes.is_empty() {
        let mut all_wishes = Vec::new();
        for (level, _) in &level_weights {
            all_wishes.extend(
                repo.get_wishes_by_level(*level).map_err(|e| e.to_string())?
            );
        }
        all_wishes.choose(&mut rng).cloned()
    } else {
        wishes.choose(&mut rng).cloned()
    };

    let has_wish = selected.is_some();

    // Record the draw
    let draw = WishDraw {
        id: nanoid!(),
        draw_type: ticket_type.clone(),
        ticket_type: ticket_type.clone(),
        cost: 1,
        result_wish_id: selected.as_ref().map(|w| w.id.clone()),
        result_type: if has_wish { "wish".to_string() } else { "none".to_string() },
        pity_count: pity_count + 1,
        redeemed_at: None,
        created_at: Utc::now().to_rfc3339(),
    };
    repo.create_draw(&draw).map_err(|e| e.to_string())?;

    // 抽中后立即增加 achieved_count（减少可抽数量），但不标记为已核销
    // 核销时不再重复增加
    if let Some(ref wish) = selected {
        drop(repo);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE wishes SET achieved_count = achieved_count + 1, updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now, wish.id],
        ).map_err(|e| e.to_string())?;
    }

    let new_pity = pity_count + 1;
    let pity_available = new_pity >= pity_threshold;

    let message = if let Some(ref w) = selected {
        format!("抽中了「{}」！", w.title)
    } else {
        "心愿池为空，请先添加心愿".to_string()
    };

    let result = WishDrawResult {
        success: has_wish,
        wish: selected,
        is_pity: false,
        pity_count: new_pity,
        pity_threshold,
        pity_available,
        message,
    };

    Ok(result)
}

/// 保底自选：抽满保底次数后免费任选一个心愿
#[tauri::command]
pub fn claim_pity_wish(
    state: State<'_, DbState>,
    ticket_type: String,
    wish_id: String,
) -> Result<WishDrawResult, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let pity_threshold = if ticket_type == "micro" { 30 } else { 80 };

    // Check pity progress — 只计最近一次保底之后的抽奖
    let pity_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM wish_draws WHERE ticket_type = ?1 AND result_type != 'pity' AND created_at > COALESCE(
                (SELECT created_at FROM wish_draws WHERE ticket_type = ?1 AND result_type = 'pity' ORDER BY created_at DESC LIMIT 1),
                '1970-01-01'
            )",
            [&ticket_type],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if pity_count < pity_threshold {
        return Err(format!("保底条件尚未满足（{}/{}）", pity_count, pity_threshold));
    }

    // Verify wish exists and is active
    let repo = WishRepository::new(&conn);  // immutable ref is fine
    let wish = repo.get_wish(&wish_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "心愿不存在".to_string())?;

    if wish.status != "active" {
        return Err("该心愿不可选".to_string());
    }

    // Verify wish level matches ticket type pool
    if ticket_type == "micro" && (wish.level != 1 && wish.level != 2) {
        return Err("微光保底仅可选 Lv.1-2 心愿".to_string());
    }
    if ticket_type == "shimmer" && (wish.level != 3 && wish.level != 4) {
        return Err("拾光保底仅可选 Lv.3-4 心愿".to_string());
    }

    drop(repo);  // release immutable borrow

    // 保底抽中后增加 achieved_count（减少可抽数量），放入仓库等待核销
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE wishes SET achieved_count = achieved_count + 1, updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, wish_id],
    ).map_err(|e| e.to_string())?;

    // Record the pity draw (resets counter)
    let repo = WishRepository::new(&conn);
    let draw = WishDraw {
        id: nanoid!(),
        draw_type: ticket_type.clone(),
        ticket_type: ticket_type.clone(),
        cost: 0,  // free — pity reward
        result_wish_id: Some(wish_id.clone()),
        result_type: "pity".to_string(),
        pity_count: pity_count + 1,
        redeemed_at: None,
        created_at: now,
    };
    repo.create_draw(&draw).map_err(|e| e.to_string())?;

    let result = WishDrawResult {
        success: true,
        wish: Some(wish),
        is_pity: true,
        pity_count: 0,  // reset after claim
        pity_threshold,
        pity_available: false,
        message: "保底自选成功！".to_string(),
    };

    Ok(result)
}

/// 获取保底进度
#[tauri::command]
pub fn get_pity_progress(
    state: State<'_, DbState>,
    ticket_type: String,
) -> Result<PityProgress, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let pity_threshold = if ticket_type == "micro" { 30 } else { 80 };

    // Get current pity count — 只计最近一次保底之后的抽奖
    let pity_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM wish_draws WHERE ticket_type = ?1 AND result_type != 'pity' AND created_at > COALESCE(
                (SELECT created_at FROM wish_draws WHERE ticket_type = ?1 AND result_type = 'pity' ORDER BY created_at DESC LIMIT 1),
                '1970-01-01'
            )",
            [&ticket_type],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(PityProgress {
        current: pity_count,
        threshold: pity_threshold,
    })
}

#[derive(serde::Serialize)]
pub struct PityProgress {
    pub current: i32,
    pub threshold: i32,
}

/// 购买奖券
#[tauri::command]
pub fn buy_tickets(
    state: State<'_, DbState>,
    ticket_type: String,
    count: i32,
) -> Result<GlowBalance, String> {
    use crate::db::repositories::wish_repo::WishRepository;

    if count <= 0 {
        return Err("购买数量必须大于0".to_string());
    }

    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 奖券价格
    let price_per_ticket = if ticket_type == "micro" { 100 } else { 500 };
    let total_cost = price_per_ticket * count;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 检查余额
    let current_glow: i32 = tx
        .query_row(
            "SELECT glow_amount FROM glow_balances WHERE id = 'user'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if current_glow < total_cost {
        return Err(format!("萤火不足，需要 {} 萤火", total_cost));
    }

    // 扣除萤火
    let now = Utc::now().to_rfc3339();
    tx.execute(
        "UPDATE glow_balances SET glow_amount = glow_amount - ?1, updated_at = ?2 WHERE id = 'user'",
        [total_cost.to_string(), now.clone()],
    )
    .map_err(|e| e.to_string())?;

    // 增加奖券
    let column = if ticket_type == "micro" { "micro_tickets" } else { "shimmer_tickets" };
    tx.execute(
        &format!("UPDATE glow_balances SET {} = {} + ?1, updated_at = ?2 WHERE id = 'user'", column, column),
        [count.to_string(), now.clone()],
    )
    .map_err(|e| e.to_string())?;

    // 记录萤火账本：萤火支出
    {
        let glow_after: i32 = tx
            .query_row("SELECT glow_amount FROM glow_balances WHERE id = 'user'", [], |row| row.get(0))
            .unwrap_or(0);
        let ledger_id = nanoid!();
        let ticket_label = if ticket_type == "micro" { "微光奖券" } else { "拾光奖券" };
        let _ = tx.execute(
            "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
             VALUES (?1, 'glow', ?2, ?3, 'buy_ticket', ?4, '', ?5)",
            rusqlite::params![ledger_id, -total_cost, glow_after, format!("购买 {} 张{}", count, ticket_label), now],
        );
    }
    // 记录萤火账本：奖券收入
    {
        let ticket_after: i32 = tx
            .query_row(&format!("SELECT {} FROM glow_balances WHERE id = 'user'", column), [], |row| row.get(0))
            .unwrap_or(0);
        let ledger_id = nanoid!();
        let ticket_label = if ticket_type == "micro" { "微光奖券" } else { "拾光奖券" };
        let asset_type = if ticket_type == "micro" { "micro_ticket" } else { "shimmer_ticket" };
        let _ = tx.execute(
            "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
             VALUES (?1, ?2, ?3, ?4, 'buy_ticket', ?5, '', ?6)",
            rusqlite::params![ledger_id, asset_type, count, ticket_after, format!("购买 {} 张{}", count, ticket_label), now],
        );
    }

    tx.commit().map_err(|e| e.to_string())?;

    // 返回新余额
    let repo = WishRepository::new(&conn);
    repo.get_balance().map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct WishDrawResult {
    pub success: bool,
    pub wish: Option<Wish>,
    pub is_pity: bool,
    pub pity_count: i32,
    pub pity_threshold: i32,
    pub pity_available: bool,
    pub message: String,
}

/// 兑换心愿（抽到后用萤火购买或标记达成）
#[tauri::command]
pub fn redeem_wish(
    state: State<'_, DbState>,
    wish_id: String,
) -> Result<Wish, String> {
    use crate::db::repositories::wish_repo::WishRepository;

    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 先获取心愿信息和检查库存
    let (cost_glow, available): (i32, bool) = {
        let repo = WishRepository::new(&conn);
        let wish = repo.get_wish(&wish_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "心愿不存在".to_string())?;
        let available = repo.check_wish_available(&wish_id)
            .map_err(|e| e.to_string())?;
        (wish.cost_glow, available)
    };

    if !available {
        return Err("该心愿已无库存".to_string());
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 扣除萤火（如果 cost_glow > 0）
    let wish_title: String = tx
        .query_row("SELECT title FROM wishes WHERE id = ?1", [&wish_id], |row| row.get(0))
        .unwrap_or_default();

    if cost_glow > 0 {
        let current_glow: i32 = tx
            .query_row(
                "SELECT glow_amount FROM glow_balances WHERE id = 'user'",
                [],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if current_glow < cost_glow {
            return Err(format!("萤火不足，需要 {} 萤火", cost_glow));
        }

        let now = Utc::now().to_rfc3339();
        tx.execute(
            "UPDATE glow_balances SET glow_amount = glow_amount - ?1, updated_at = ?2 WHERE id = 'user'",
            [cost_glow.to_string(), now.clone()],
        )
        .map_err(|e| e.to_string())?;

        // 记录萤火账本：兑换消耗
        let glow_after: i32 = tx
            .query_row("SELECT glow_amount FROM glow_balances WHERE id = 'user'", [], |row| row.get(0))
            .unwrap_or(0);
        let ledger_id = nanoid!();
        let _ = tx.execute(
            "INSERT INTO glow_ledger (id, asset_type, change_amount, balance_after, reason, source_desc, related_id, created_at)
             VALUES (?1, 'glow', ?2, ?3, 'redeem_wish', ?4, ?5, ?6)",
            rusqlite::params![ledger_id, -(cost_glow), glow_after, format!("兑换心愿「{}」", wish_title), wish_id, now],
        );
    }

    // 增加 achieved_count
    let now = Utc::now().to_rfc3339();
    tx.execute(
        "UPDATE wishes SET achieved_count = achieved_count + 1, updated_at = ?1 WHERE id = ?2",
        [&now, &wish_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    // 返回更新后的心愿
    let repo = WishRepository::new(&conn);
    repo.get_wish(&wish_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "兑换失败，请重试".to_string())
}

// === 仓库 Commands ===

/// 查询仓库：未核销的中奖记录
#[tauri::command]
pub fn list_inventory(
    state: State<'_, DbState>,
) -> Result<Vec<InventoryItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);
    repo.list_inventory().map_err(|e| e.to_string())
}

/// 核销仓库物品：标记为已核销
/// achieved_count 在抽奖时已增加，核销不再重复
#[tauri::command]
pub fn redeem_draw(
    state: State<'_, DbState>,
    draw_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);
    repo.redeem_draw(&draw_id).map_err(|e| e.to_string())
}

/// 获取待核销数量
#[tauri::command]
pub fn get_inventory_count(
    state: State<'_, DbState>,
) -> Result<i32, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);
    repo.get_inventory_count().map_err(|e| e.to_string())
}

/// 调整心愿剩余库存（通过 achieved_count 实现）
/// delta: +1 = 减少剩余（achieved_count+1），-1 = 增加剩余（achieved_count-1）
#[tauri::command]
pub fn adjust_wish_stock(
    state: State<'_, DbState>,
    wish_id: String,
    delta: i32,
) -> Result<Wish, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let repo = WishRepository::new(&conn);

    let existing = repo.get_wish(&wish_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "心愿不存在".to_string())?;

    // 无限数量不能调整
    if existing.quantity == -1 {
        return Err("无限数量的心愿无需调整库存".to_string());
    }

    // achieved_count 范围: 0 ~ quantity
    let new_achieved = (existing.achieved_count + delta).max(0).min(existing.quantity);
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE wishes SET achieved_count = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![new_achieved, now, wish_id],
    ).map_err(|e| e.to_string())?;

    repo.get_wish(&wish_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "更新失败".to_string())
}
