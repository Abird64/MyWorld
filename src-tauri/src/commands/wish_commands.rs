use chrono::Utc;
use nanoid::nanoid;
use serde::Deserialize;
use tauri::State;

use crate::db::connection::DbState;
use crate::db::repositories::wish_repo::{Wish, WishDraw, GlowBalance, WishRepository};

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
        .ok_or_else(|| "Wish not found".to_string())?;

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

/// Draw with pity system
/// Micro: 30 draws pity, Shimmer: 80 draws pity
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

    // Check and consume ticket
    if !repo.consume_ticket(&ticket_type).map_err(|e| e.to_string())? {
        return Err("Insufficient tickets".to_string());
    }

    // Get available wishes based on ticket type
    let levels: Vec<i32> = if ticket_type == "micro" {
        vec![1, 2] // Lv.1 即刻轻享, Lv.2 生活犒赏
    } else {
        vec![3, 4] // Lv.3 进阶装备, Lv.4 梦想实现
    };

    let pity_threshold = if ticket_type == "micro" { 30 } else { 80 };

    // Get current pity count
    let pity_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM wish_draws WHERE ticket_type = ?1 AND result_type != 'pity' AND created_at > datetime('now', '-30 days')",
            [&ticket_type],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let mut all_wishes: Vec<Wish> = Vec::new();
    for level in &levels {
        let wishes = repo.get_wishes_by_level(*level)
            .map_err(|e| e.to_string())?;
        all_wishes.extend(wishes);
    }

    // Draw logic with pity
    let (selected, is_pity) = if all_wishes.is_empty() {
        (None, false)
    } else if pity_count >= pity_threshold - 1 {
        // Trigger pity: guarantee a wish
        let mut rng = thread_rng();
        (all_wishes.choose(&mut rng).cloned(), true)
    } else {
        // Normal draw: 80% chance
        let mut rng = thread_rng();
        let roll: f64 = rng.gen();
        if roll < 0.8 {
            (all_wishes.choose(&mut rng).cloned(), false)
        } else {
            (None, false)
        }
    };

    let has_wish = selected.is_some();

    // Record the draw
    let draw = WishDraw {
        id: nanoid!(),
        draw_type: ticket_type.clone(),
        ticket_type: ticket_type.clone(),
        cost: 1,
        result_wish_id: selected.as_ref().map(|w| w.id.clone()),
        result_type: if is_pity { "pity".to_string() } else if has_wish { "wish".to_string() } else { "none".to_string() },
        pity_count: pity_count + 1,
        created_at: Utc::now().to_rfc3339(),
    };
    repo.create_draw(&draw).map_err(|e| e.to_string())?;

    let result = WishDrawResult {
        success: has_wish,
        wish: selected,
        is_pity,
        pity_count: pity_count + 1,
        message: if is_pity {
            format!("保底触发！恭喜你抽中了一个心愿！（{}抽）", pity_count + 1)
        } else if has_wish {
            "恭喜你抽中了一个心愿！".to_string()
        } else {
            "这次没有抽中，再接再厉！".to_string()
        },
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

    // Get current pity count
    let pity_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM wish_draws WHERE ticket_type = ?1 AND result_type != 'pity' AND created_at > datetime('now', '-30 days')",
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
        [count.to_string(), now],
    )
    .map_err(|e| e.to_string())?;

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
            .ok_or_else(|| "Wish not found".to_string())?;
        let available = repo.check_wish_available(&wish_id)
            .map_err(|e| e.to_string())?;
        (wish.cost_glow, available)
    };

    if !available {
        return Err("该心愿已无库存".to_string());
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 扣除萤火（如果 cost_glow > 0）
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
            [cost_glow.to_string(), now],
        )
        .map_err(|e| e.to_string())?;
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
        .ok_or_else(|| "Wish not found after update".to_string())
}
