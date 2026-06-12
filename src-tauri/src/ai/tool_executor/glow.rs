use rusqlite::Connection;
use serde::Deserialize;

use crate::db::repositories::wish_repo;

#[derive(Debug, Deserialize)]
struct ToolRewardGlowArgs {
    amount: i32,
    reason: String,
    category: String,
}

pub fn execute_reward_glow(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolRewardGlowArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("reward_glow 参数解析失败: {}", e))?;

    if args.amount < 5 || args.amount > 50 {
        return Err(format!("萤火奖励数量需在5-50之间，收到{}", args.amount));
    }

    let valid_categories = ["克制", "坚持", "成长", "善意", "突破", "其他"];
    if !valid_categories.contains(&args.category.as_str()) {
        return Err(format!("无效的奖励类别: {}。有效类别: {}", args.category, valid_categories.join("、")));
    }

    let repo = wish_repo::WishRepository::new(conn);
    repo.update_glow(args.amount)
        .map_err(|e| format!("奖励萤火失败: {}", e))?;

    // 记录萤火账本
    {
        use crate::db::repositories::glow_ledger_repo;
        let balance_after: i32 = conn
            .query_row("SELECT glow_amount FROM glow_balances WHERE id = 'user'", [], |row| row.get(0))
            .unwrap_or(0);
        let _ = glow_ledger_repo::record_entry(
            conn,
            "glow",
            args.amount,
            balance_after,
            "ai_reward",
            &format!("{}: {}", args.category, args.reason),
            "",
        );
    }

    let balance = repo.get_balance()
        .map_err(|e| format!("查询余额失败: {}", e))?;

    let category_emoji = match args.category.as_str() {
        "克制" => "🧘",
        "坚持" => "🔥",
        "成长" => "🌱",
        "善意" => "💛",
        "突破" => "🚀",
        _ => "✨",
    };

    Ok(format!(
        "{} 萤火+{} | {}\n\n「{}」\n\n当前萤火余额：{}",
        category_emoji, args.amount, args.category, args.reason, balance.glow_amount
    ))
}

pub fn execute_get_glow_balance(conn: &Connection) -> Result<String, String> {
    let repo = wish_repo::WishRepository::new(conn);
    let balance = repo.get_balance()
        .map_err(|e| format!("查询萤火余额失败: {}", e))?;

    let mut result = format!(
        "萤火余额：{} | 微光券：{} | 闪光券：{}\n\n",
        balance.glow_amount, balance.micro_tickets, balance.shimmer_tickets
    );

    let wishes = repo.list_wishes(Some("active"))
        .unwrap_or_default();
    let affordable: Vec<_> = wishes.iter()
        .filter(|w| w.cost_glow <= balance.glow_amount)
        .collect();

    if !wishes.is_empty() {
        result.push_str(&format!("心愿清单共{}个心愿：\n", wishes.len()));
        for w in wishes.iter().take(10) {
            let affordable_mark = if w.cost_glow <= balance.glow_amount { "✅" } else { "🔒" };
            let qty_info = if w.quantity == -1 {
                "无限".to_string()
            } else {
                format!("{}/{}", w.achieved_count, w.quantity)
            };
            result.push_str(&format!(
                "  {} Lv.{} {} — {}萤火（库存: {}）\n",
                affordable_mark, w.level, w.title, w.cost_glow, qty_info
            ));
        }
        if !affordable.is_empty() {
            result.push_str(&format!("\n你有足够萤火兑换其中{}个心愿", affordable.len()));
        }
    } else {
        result.push_str("心愿清单还是空的，去许个愿吧");
    }

    Ok(result)
}

pub fn execute_list_wishes(conn: &Connection, arguments: &str) -> Result<String, String> {
    #[derive(Debug, Deserialize)]
    struct ListWishesArgs {
        #[serde(default)]
        status: Option<String>,
    }

    let args: ListWishesArgs = serde_json::from_str(arguments)
        .unwrap_or(ListWishesArgs { status: None });

    let repo = wish_repo::WishRepository::new(conn);
    let wishes = repo.list_wishes(args.status.as_deref())
        .map_err(|e| format!("查询心愿清单失败: {}", e))?;

    if wishes.is_empty() {
        let hint = match args.status.as_deref() {
            Some("achieved") => "还没有达成过心愿。继续努力攒萤火吧！",
            _ => "心愿清单还是空的。你可以告诉用户去许愿池添加心愿——用萤火兑换生活中的小奖励。",
        };
        return Ok(hint.to_string());
    }

    let status_label = args.status.as_deref().unwrap_or("全部");
    let mut result = format!("心愿清单（{}），共{}个：\n\n", status_label, wishes.len());

    for w in &wishes {
        let status_icon = if w.status == "achieved" { "🏆" } else { "✨" };
        let qty_info = if w.quantity == -1 {
            "无限".to_string()
        } else {
            format!("{}/{}", w.achieved_count, w.quantity)
        };
        let desc = w.description.as_deref().unwrap_or("");
        let desc_line = if desc.is_empty() { String::new() } else { format!(" — {}", desc) };

        result.push_str(&format!(
            "{} Lv.{} {}（{}萤火）{}\n  库存: {}\n",
            status_icon, w.level, w.title, w.cost_glow, desc_line, qty_info
        ));
    }

    result.push_str("\n提示：用户可以用萤火直接兑换心愿(redeem_wish)，也可以用奖券在心愿池抽奖(draw_wish)。抽奖记录用 list_draws 查看，萤火收支用 list_glow_ledger 查看。");
    Ok(result)
}

// ====================================================================
// 心愿系统执行器（扩展）
// ====================================================================

use nanoid::nanoid;

#[derive(Debug, Deserialize)]
struct ToolCreateWishArgs {
    title: String,
    description: Option<String>,
    level: i32,
    cost_glow: i32,
    #[serde(default = "default_quantity")]
    quantity: i32,
}

fn default_quantity() -> i32 { 1 }

pub fn execute_create_wish(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolCreateWishArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("create_wish 参数解析失败: {}", e))?;

    if args.title.trim().is_empty() {
        return Err("心愿名称不能为空".to_string());
    }
    if args.level < 1 || args.level > 4 {
        return Err("心愿等级需在1-4之间".to_string());
    }
    if args.cost_glow < 1 {
        return Err("兑换所需萤火数至少为1".to_string());
    }

    let now = chrono::Utc::now().to_rfc3339();
    let wish = wish_repo::Wish {
        id: nanoid!(),
        title: args.title,
        description: args.description,
        level: args.level,
        cost_glow: args.cost_glow,
        quantity: args.quantity,
        achieved_count: 0,
        status: "active".to_string(),
        achieved_at: None,
        sort_order: 0,
        created_at: now.clone(),
        updated_at: now,
    };

    let repo = wish_repo::WishRepository::new(conn);
    repo.create_wish(&wish)
        .map_err(|e| format!("创建心愿失败: {}", e))?;

    let level_names = ["", "微小心愿", "光影心愿", "流光心愿", "极光心愿"];
    let level_name = level_names.get(args.level as usize).unwrap_or(&"心愿");
    Ok(format!("心愿已创建：{}（{}·Lv.{}，{}萤火兑换）", wish.title, level_name, wish.level, wish.cost_glow))
}

#[derive(Debug, Deserialize)]
struct ToolUpdateWishArgs {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    level: Option<i32>,
    #[serde(default)]
    cost_glow: Option<i32>,
    #[serde(default)]
    quantity: Option<i32>,
}

pub fn execute_update_wish(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolUpdateWishArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("update_wish 参数解析失败: {}", e))?;

    let repo = wish_repo::WishRepository::new(conn);

    // Find the wish
    let wish = if let Some(ref id) = args.id {
        repo.get_wish(id)
            .map_err(|e| format!("查询心愿失败: {}", e))?
            .ok_or_else(|| "未找到指定心愿".to_string())?
    } else if let Some(ref query) = args.query {
        let wishes = repo.list_wishes(None)
            .map_err(|e| format!("查询心愿清单失败: {}", e))?;
        let q = query.to_lowercase();
        wishes.into_iter()
            .find(|w| w.title.to_lowercase().contains(&q))
            .ok_or_else(|| format!("未找到包含「{}」的心愿", query))?
    } else {
        return Err("请提供心愿ID(id)或名称关键词(query)来指定要修改的心愿".to_string());
    };

    let updated = wish_repo::Wish {
        id: wish.id.clone(),
        title: args.title.unwrap_or(wish.title),
        description: args.description.or(wish.description),
        level: args.level.unwrap_or(wish.level),
        cost_glow: args.cost_glow.unwrap_or(wish.cost_glow),
        quantity: args.quantity.unwrap_or(wish.quantity),
        achieved_count: wish.achieved_count,
        status: wish.status,
        achieved_at: wish.achieved_at,
        sort_order: wish.sort_order,
        created_at: wish.created_at,
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    repo.update_wish(&updated)
        .map_err(|e| format!("更新心愿失败: {}", e))?;

    Ok(format!("心愿已更新：{}（Lv.{}，{}萤火）", updated.title, updated.level, updated.cost_glow))
}

#[derive(Debug, Deserialize)]
struct ToolDeleteWishArgs {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    query: Option<String>,
}

pub fn execute_delete_wish(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolDeleteWishArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("delete_wish 参数解析失败: {}", e))?;

    let repo = wish_repo::WishRepository::new(conn);

    let wish = if let Some(ref id) = args.id {
        repo.get_wish(id)
            .map_err(|e| format!("查询心愿失败: {}", e))?
            .ok_or_else(|| "未找到指定心愿".to_string())?
    } else if let Some(ref query) = args.query {
        let wishes = repo.list_wishes(None)
            .map_err(|e| format!("查询心愿清单失败: {}", e))?;
        let q = query.to_lowercase();
        wishes.into_iter()
            .find(|w| w.title.to_lowercase().contains(&q))
            .ok_or_else(|| format!("未找到包含「{}」的心愿", query))?
    } else {
        return Err("请提供心愿ID(id)或名称关键词(query)来指定要删除的心愿".to_string());
    };

    repo.delete_wish(&wish.id)
        .map_err(|e| format!("删除心愿失败: {}", e))?;

    Ok(format!("已删除心愿：{}", wish.title))
}

#[derive(Debug, Deserialize)]
struct ToolBuyTicketsArgs {
    ticket_type: String,
    count: i32,
}

pub fn execute_buy_tickets(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolBuyTicketsArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("buy_tickets 参数解析失败: {}", e))?;

    if args.count <= 0 {
        return Err("购买数量必须大于0".to_string());
    }
    if args.ticket_type != "micro" && args.ticket_type != "shimmer" {
        return Err("奖券类型必须是 micro 或 shimmer".to_string());
    }

    let ticket_label = if args.ticket_type == "micro" { "微光券" } else { "拾光券" };
    let price_per = if args.ticket_type == "micro" { 100 } else { 500 };
    let total_cost = price_per * args.count;

    let repo = wish_repo::WishRepository::new(conn);
    let balance = repo.get_balance()
        .map_err(|e| format!("查询余额失败: {}", e))?;

    if balance.glow_amount < total_cost {
        return Err(format!("萤火不足：需要{}萤火，当前只有{}萤火", total_cost, balance.glow_amount));
    }

    // Deduct glow
    repo.update_glow(-total_cost)
        .map_err(|e| format!("扣除萤火失败: {}", e))?;

    // Add tickets
    if args.ticket_type == "micro" {
        repo.update_tickets(args.count, 0)
            .map_err(|e| format!("添加奖券失败: {}", e))?;
    } else {
        repo.update_tickets(0, args.count)
            .map_err(|e| format!("添加奖券失败: {}", e))?;
    }

    // Record ledger
    {
        use crate::db::repositories::glow_ledger_repo;
        let glow_after = balance.glow_amount - total_cost;
        let _ = glow_ledger_repo::record_entry(conn, "glow", -total_cost, glow_after, "buy_ticket",
            &format!("购买{}张{}", args.count, ticket_label), "");
        let ticket_after = if args.ticket_type == "micro" { balance.micro_tickets + args.count } else { balance.shimmer_tickets + args.count };
        let asset_type = if args.ticket_type == "micro" { "micro_ticket" } else { "shimmer_ticket" };
        let _ = glow_ledger_repo::record_entry(conn, asset_type, args.count, ticket_after, "buy_ticket",
            &format!("购买{}张{}", args.count, ticket_label), "");
    }

    let new_balance = repo.get_balance()
        .map_err(|e| format!("查询余额失败: {}", e))?;

    Ok(format!(
        "购买成功！{}张{} × {}萤火 = {}萤火\n当前：{}萤火 | {}微光券 | {}拾光券",
        args.count, ticket_label, price_per, total_cost,
        new_balance.glow_amount, new_balance.micro_tickets, new_balance.shimmer_tickets
    ))
}

#[derive(Debug, Deserialize)]
struct ToolDrawWishArgs {
    ticket_type: String,
}

pub fn execute_draw_wish(conn: &Connection, arguments: &str) -> Result<String, String> {
    use rand::seq::SliceRandom;
    use rand::Rng;

    let args: ToolDrawWishArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("draw_wish 参数解析失败: {}", e))?;

    if args.ticket_type != "micro" && args.ticket_type != "shimmer" {
        return Err("奖券类型必须是 micro 或 shimmer".to_string());
    }

    let repo = wish_repo::WishRepository::new(conn);

    // Level probability
    let (level_weights, pity_threshold): (Vec<(i32, f64)>, i32) = if args.ticket_type == "micro" {
        (vec![(1, 0.6), (2, 0.4)], 30)
    } else {
        (vec![(3, 0.8), (4, 0.2)], 80)
    };

    // 先检查心愿池是否有可用心愿，再扣奖券
    let mut has_any_wish = false;
    for (level, _) in &level_weights {
        if !repo.get_wishes_by_level(*level).map_err(|e| format!("查询心愿失败: {}", e))?.is_empty() {
            has_any_wish = true;
            break;
        }
    }
    if !has_any_wish {
        return Err("心愿池为空，请先添加心愿".to_string());
    }

    // Check and consume ticket
    if !repo.consume_ticket(&args.ticket_type)
        .map_err(|e| format!("消费奖券失败: {}", e))? {
        let ticket_label = if args.ticket_type == "micro" { "微光券" } else { "拾光券" };
        return Err(format!("{}不足，请先购买或获取奖券", ticket_label));
    }

    // Record ticket consumption in ledger
    {
        use crate::db::repositories::glow_ledger_repo;
        let asset_type = if args.ticket_type == "micro" { "micro_ticket" } else { "shimmer_ticket" };
        let column = if args.ticket_type == "micro" { "micro_tickets" } else { "shimmer_tickets" };
        let balance_after: i32 = conn
            .query_row(&format!("SELECT {} FROM glow_balances WHERE id = 'user'", column), [], |row| row.get(0))
            .unwrap_or(0);
        let ticket_label = if args.ticket_type == "micro" { "微光券" } else { "拾光券" };
        let _ = glow_ledger_repo::record_entry(conn, asset_type, -1, balance_after, "draw_consume",
            &format!("消耗{}抽奖", ticket_label), "");
    }

    // Get pity count
    let pity_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM wish_draws WHERE ticket_type = ?1 AND result_type != 'pity'",
            [&args.ticket_type],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Roll for level
    let mut rng = rand::thread_rng();
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
        .map_err(|e| format!("查询心愿失败: {}", e))?;

    let selected = if wishes.is_empty() {
        let mut all_wishes = Vec::new();
        for (level, _) in &level_weights {
            all_wishes.extend(
                repo.get_wishes_by_level(*level).map_err(|e| format!("查询心愿失败: {}", e))?
            );
        }
        all_wishes.choose(&mut rng).cloned()
    } else {
        wishes.choose(&mut rng).cloned()
    };

    let has_wish = selected.is_some();

    // Record the draw
    let draw = wish_repo::WishDraw {
        id: nanoid!(),
        draw_type: args.ticket_type.clone(),
        ticket_type: args.ticket_type.clone(),
        cost: 1,
        result_wish_id: selected.as_ref().map(|w| w.id.clone()),
        result_type: if has_wish { "wish".to_string() } else { "none".to_string() },
        pity_count: pity_count + 1,
        redeemed_at: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    repo.create_draw(&draw).map_err(|e| format!("记录抽奖失败: {}", e))?;

    let new_pity = pity_count + 1;
    let pity_info = if args.ticket_type == "micro" {
        format!("保底进度：{}/{}", new_pity, pity_threshold)
    } else {
        format!("保底进度：{}/{}", new_pity, pity_threshold)
    };

    if let Some(w) = selected {
        let level_names = ["", "微小心愿", "光影心愿", "流光心愿", "极光心愿"];
        let level_name = level_names.get(w.level as usize).unwrap_or(&"心愿");
        Ok(format!(
            "🎉 抽中了「{}」（{}·Lv.{}）！\n{}\n已放入仓库，去心愿仓库核销吧",
            w.title, level_name, w.level, pity_info
        ))
    } else {
        Ok(format!("未抽中心愿，心愿池中暂无可用心愿。{}\n试试先用 create_wish 添加一些心愿吧！", pity_info))
    }
}

#[derive(Debug, Deserialize)]
struct ToolRedeemWishArgs {
    #[serde(default)]
    wish_id: Option<String>,
    #[serde(default)]
    query: Option<String>,
}

pub fn execute_redeem_wish(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolRedeemWishArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("redeem_wish 参数解析失败: {}", e))?;

    let repo = wish_repo::WishRepository::new(conn);

    let wish = if let Some(ref id) = args.wish_id {
        repo.get_wish(id)
            .map_err(|e| format!("查询心愿失败: {}", e))?
            .ok_or_else(|| "未找到指定心愿".to_string())?
    } else if let Some(ref query) = args.query {
        let wishes = repo.list_wishes(Some("active"))
            .map_err(|e| format!("查询心愿失败: {}", e))?;
        let q = query.to_lowercase();
        wishes.into_iter()
            .find(|w| w.title.to_lowercase().contains(&q))
            .ok_or_else(|| format!("未找到包含「{}」的心愿", query))?
    } else {
        return Err("请提供心愿ID(wish_id)或名称关键词(query)来指定要兑换的心愿".to_string());
    };

    if wish.status != "active" {
        return Err(format!("心愿「{}」已达成或不可兑换", wish.title));
    }

    // Check availability
    if !repo.check_wish_available(&wish.id)
        .map_err(|e| format!("检查心愿库存失败: {}", e))? {
        return Err("该心愿已无库存".to_string());
    }

    let balance = repo.get_balance()
        .map_err(|e| format!("查询余额失败: {}", e))?;

    if balance.glow_amount < wish.cost_glow {
        return Err(format!(
            "萤火不足：兑换「{}」需要{}萤火，当前只有{}萤火",
            wish.title, wish.cost_glow, balance.glow_amount
        ));
    }

    // Deduct glow
    repo.update_glow(-wish.cost_glow)
        .map_err(|e| format!("扣除萤火失败: {}", e))?;

    // Increment achieved count
    repo.mark_wish_achieved(&wish.id)
        .map_err(|e| format!("达成心愿失败: {}", e))?;

    // Record ledger
    {
        use crate::db::repositories::glow_ledger_repo;
        let glow_after = balance.glow_amount - wish.cost_glow;
        let _ = glow_ledger_repo::record_entry(conn, "glow", -wish.cost_glow, glow_after, "redeem_wish",
            &format!("兑换心愿「{}」", wish.title), &wish.id);
    }

    let new_balance = repo.get_balance()
        .map_err(|e| format!("查询余额失败: {}", e))?;

    Ok(format!(
        "兑换成功！「{}」已达成\n消耗{}萤火，剩余{}萤火\n真正的富有，是让每一点萤火都落在值得的地方。",
        wish.title, wish.cost_glow, new_balance.glow_amount
    ))
}

#[derive(Debug, Deserialize)]
struct ToolListDrawsArgs {
    #[serde(default = "default_limit")]
    limit: i32,
}

fn default_limit() -> i32 { 20 }

pub fn execute_list_draws(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolListDrawsArgs = serde_json::from_str(arguments)
        .unwrap_or(ToolListDrawsArgs { limit: 20 });

    let limit = args.limit.min(50).max(1);

    let repo = wish_repo::WishRepository::new(conn);
    let draws = repo.list_draws(limit)
        .map_err(|e| format!("查询抽奖记录失败: {}", e))?;

    if draws.is_empty() {
        return Ok("暂无抽奖记录。去抽一发给心愿池添点惊喜吧！".to_string());
    }

    let mut result = format!("最近{}条抽奖记录：\n\n", draws.len());
    for d in &draws {
        let is_win = d.result_type == "wish" || d.result_type == "pity";
        let type_label = if d.draw_type == "micro" { "微光" } else { "拾光" };
        let win_label = if d.result_type == "pity" { "保底中奖" } else if is_win { "中奖" } else { "未中" };
        let time = d.created_at.get(0..16).unwrap_or(&d.created_at);
        result.push_str(&format!(
            "- {} | {}池 | {} | 消耗{}券 | 保底计数{}\n",
            time, type_label, win_label, d.cost, d.pity_count
        ));
    }

    Ok(result)
}

#[derive(Debug, Deserialize)]
struct ToolListGlowLedgerArgs {
    #[serde(default)]
    asset_type: Option<String>,
    #[serde(default = "default_limit")]
    limit: i32,
}

pub fn execute_list_glow_ledger(conn: &Connection, arguments: &str) -> Result<String, String> {
    let args: ToolListGlowLedgerArgs = serde_json::from_str(arguments)
        .unwrap_or(ToolListGlowLedgerArgs { asset_type: None, limit: 30 });

    let limit = args.limit.min(100).max(1);

    use crate::db::repositories::glow_ledger_repo;
    let (entries, total) = glow_ledger_repo::list_entries(
        conn,
        args.asset_type.as_deref(),
        None,
        limit,
        0,
    ).map_err(|e| format!("查询账本失败: {}", e))?;

    if entries.is_empty() {
        let type_label = match args.asset_type.as_deref() {
            Some("glow") => "萤火",
            Some("micro_ticket") => "微光券",
            Some("shimmer_ticket") => "拾光券",
            _ => "收支",
        };
        return Ok(format!("暂无{}记录", type_label));
    }

    let type_label = match args.asset_type.as_deref() {
        Some("glow") => "萤火",
        Some("micro_ticket") => "微光券",
        Some("shimmer_ticket") => "拾光券",
        _ => "全部",
    };
    let mut result = format!("{}收支明细（共{}条，显示最近{}条）：\n\n", type_label, total, entries.len());

    for e in &entries {
        let sign = if e.change_amount > 0 { "+" } else { "" };
        let asset_label = match e.asset_type.as_str() {
            "glow" => "🔥",
            "micro_ticket" => "🎫微光",
            "shimmer_ticket" => "🎟拾光",
            _ => "",
        };
        let time = e.created_at.get(0..16).unwrap_or(&e.created_at);
        result.push_str(&format!(
            "- {} {} {}{}（余额: {}）{}\n",
            time, asset_label, sign, e.change_amount, e.balance_after, e.source_desc
        ));
    }

    if total > entries.len() as i32 {
        result.push_str(&format!("\n...还有{}条记录", total - entries.len() as i32));
    }

    Ok(result)
}
