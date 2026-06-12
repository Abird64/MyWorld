use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wish {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub level: i32,
    pub cost_glow: i32,
    pub quantity: i32,        // -1 表示无限
    pub achieved_count: i32,  // 已达成次数
    pub status: String,
    pub achieved_at: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WishDraw {
    pub id: String,
    pub draw_type: String,
    pub ticket_type: String,
    pub cost: i32,
    pub result_wish_id: Option<String>,
    pub result_type: String,
    pub pity_count: i32,
    pub redeemed_at: Option<String>,
    pub created_at: String,
}

/// 仓库物品：抽奖记录 + 关联心愿信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryItem {
    pub draw_id: String,
    pub draw_type: String,
    pub result_type: String,
    pub pity_count: i32,
    pub created_at: String,
    pub wish_id: String,
    pub wish_title: String,
    pub wish_description: Option<String>,
    pub wish_level: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlowBalance {
    pub id: String,
    pub glow_amount: i32,
    pub micro_tickets: i32,
    pub shimmer_tickets: i32,
    pub updated_at: String,
}

pub struct WishRepository<'a> {
    conn: &'a Connection,
}

impl<'a> WishRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    // === 心愿管理 ===

    pub fn list_wishes(&self, status: Option<&str>) -> SqliteResult<Vec<Wish>> {
        let mut sql = String::from(
            "SELECT id, title, description, level, cost_glow, quantity, achieved_count, status, achieved_at, sort_order, created_at, updated_at
             FROM wishes WHERE deleted_at IS NULL"
        );

        if let Some(s) = status {
            sql.push_str(&format!(" AND status = '{}'", s));
        }

        sql.push_str(" ORDER BY level ASC, sort_order ASC, created_at DESC");

        let mut stmt = self.conn.prepare(&sql)?;
        let wishes = stmt.query_map([], |row| {
            Ok(Wish {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                level: row.get(3)?,
                cost_glow: row.get(4)?,
                quantity: row.get::<_, i32>(5).unwrap_or(-1),
                achieved_count: row.get::<_, i32>(6).unwrap_or(0),
                status: row.get(7)?,
                achieved_at: row.get(8)?,
                sort_order: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        wishes.collect()
    }

    pub fn get_wish(&self, id: &str) -> SqliteResult<Option<Wish>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, description, level, cost_glow, quantity, achieved_count, status, achieved_at, sort_order, created_at, updated_at
             FROM wishes WHERE id = ?1 AND deleted_at IS NULL"
        )?;

        let result = stmt.query_row([id], |row| {
            Ok(Wish {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                level: row.get(3)?,
                cost_glow: row.get(4)?,
                quantity: row.get::<_, i32>(5).unwrap_or(-1),
                achieved_count: row.get::<_, i32>(6).unwrap_or(0),
                status: row.get(7)?,
                achieved_at: row.get(8)?,
                sort_order: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        });

        match result {
            Ok(w) => Ok(Some(w)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn create_wish(&self, wish: &Wish) -> SqliteResult<()> {
        let desc = wish.description.clone().unwrap_or_default();
        self.conn.execute(
            "INSERT INTO wishes (id, title, description, level, cost_glow, quantity, status, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            [
                &wish.id,
                &wish.title,
                &desc,
                &wish.level.to_string(),
                &wish.cost_glow.to_string(),
                &wish.quantity.to_string(),
                &wish.status,
                &wish.sort_order.to_string(),
                &wish.created_at,
                &wish.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_wish(&self, wish: &Wish) -> SqliteResult<()> {
        let desc = wish.description.clone().unwrap_or_default();
        self.conn.execute(
            "UPDATE wishes SET title = ?2, description = ?3, level = ?4, cost_glow = ?5, quantity = ?6,
             status = ?7, sort_order = ?8, updated_at = ?9 WHERE id = ?1",
            [
                &wish.id,
                &wish.title,
                &desc,
                &wish.level.to_string(),
                &wish.cost_glow.to_string(),
                &wish.quantity.to_string(),
                &wish.status,
                &wish.sort_order.to_string(),
                &wish.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_wish(&self, id: &str) -> SqliteResult<()> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE wishes SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1",
            [id, &now],
        )?;
        Ok(())
    }

    pub fn mark_wish_achieved(&self, id: &str) -> SqliteResult<()> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE wishes SET achieved_count = achieved_count + 1, achieved_at = ?2, updated_at = ?2 WHERE id = ?1",
            [id, &now],
        )?;
        Ok(())
    }

    /// 检查心愿是否还有库存（无限数量返回true）
    pub fn check_wish_available(&self, id: &str) -> SqliteResult<bool> {
        let result: (i32, i32) = self.conn.query_row(
            "SELECT quantity, achieved_count FROM wishes WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            |row| Ok((row.get::<_, i32>(0).unwrap_or(-1), row.get::<_, i32>(1).unwrap_or(0))),
        )?;

        // quantity = -1 表示无限
        Ok(result.0 == -1 || result.1 < result.0)
    }

    pub fn get_wishes_by_level(&self, level: i32) -> SqliteResult<Vec<Wish>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, description, level, cost_glow, quantity, achieved_count, status, achieved_at, sort_order, created_at, updated_at
             FROM wishes WHERE level = ?1 AND status = 'active' AND deleted_at IS NULL
             AND (quantity = -1 OR achieved_count < quantity)
             ORDER BY sort_order ASC, created_at DESC"
        )?;

        let wishes = stmt.query_map([level], |row| {
            Ok(Wish {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                level: row.get(3)?,
                cost_glow: row.get(4)?,
                quantity: row.get::<_, i32>(5).unwrap_or(-1),
                achieved_count: row.get::<_, i32>(6).unwrap_or(0),
                status: row.get(7)?,
                achieved_at: row.get(8)?,
                sort_order: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        wishes.collect()
    }

    // === 抽奖记录 ===

    pub fn create_draw(&self, draw: &WishDraw) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT INTO wish_draws (id, draw_type, ticket_type, cost, result_wish_id, result_type, pity_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            rusqlite::params![
                &draw.id,
                &draw.draw_type,
                &draw.ticket_type,
                &draw.cost.to_string(),
                &draw.result_wish_id,
                &draw.result_type,
                &draw.pity_count.to_string(),
                &draw.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_draws(&self, limit: i32) -> SqliteResult<Vec<WishDraw>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, draw_type, ticket_type, cost, result_wish_id, result_type, pity_count, redeemed_at, created_at
             FROM wish_draws ORDER BY created_at DESC LIMIT ?1"
        )?;

        let draws = stmt.query_map([limit], |row| {
            let wish_id: Option<String> = row.get(4)?;
            Ok(WishDraw {
                id: row.get(0)?,
                draw_type: row.get(1)?,
                ticket_type: row.get(2)?,
                cost: row.get(3)?,
                result_wish_id: wish_id.filter(|s| !s.is_empty()),
                result_type: row.get(5)?,
                pity_count: row.get(6)?,
                redeemed_at: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;

        draws.collect()
    }

    /// 查询仓库：未核销的中奖记录
    pub fn list_inventory(&self) -> SqliteResult<Vec<InventoryItem>> {
        let mut stmt = self.conn.prepare(
            "SELECT d.id, d.draw_type, d.result_type, d.pity_count, d.created_at,
                    w.id, w.title, w.description, w.level
             FROM wish_draws d
             JOIN wishes w ON d.result_wish_id = w.id
               AND w.deleted_at IS NULL
             WHERE d.redeemed_at IS NULL
               AND d.result_type IN ('wish', 'pity')
               AND d.deleted_at IS NULL
             ORDER BY d.created_at DESC"
        )?;

        let items = stmt.query_map([], |row| {
            Ok(InventoryItem {
                draw_id: row.get(0)?,
                draw_type: row.get(1)?,
                result_type: row.get(2)?,
                pity_count: row.get(3)?,
                created_at: row.get(4)?,
                wish_id: row.get(5)?,
                wish_title: row.get(6)?,
                wish_description: row.get(7)?,
                wish_level: row.get(8)?,
            })
        })?;

        items.collect()
    }

    /// 核销仓库物品：标记 draw 为已核销
    /// achieved_count 在抽奖时已增加，核销不再重复
    pub fn redeem_draw(&self, draw_id: &str) -> SqliteResult<()> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE wish_draws SET redeemed_at = ?2, updated_at = ?2 WHERE id = ?1 AND redeemed_at IS NULL AND deleted_at IS NULL",
            [draw_id, &now],
        )?;
        Ok(())
    }

    /// 查询待核销数量
    pub fn get_inventory_count(&self) -> SqliteResult<i32> {
        let count: i32 = self.conn.query_row(
            "SELECT COUNT(*) FROM wish_draws d
             JOIN wishes w ON d.result_wish_id = w.id
               AND w.deleted_at IS NULL
             WHERE d.redeemed_at IS NULL
               AND d.result_type IN ('wish', 'pity')
               AND d.deleted_at IS NULL",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    // === 萤火余额 ===

    pub fn get_balance(&self) -> SqliteResult<GlowBalance> {
        let result = self.conn.query_row(
            "SELECT id, glow_amount, micro_tickets, shimmer_tickets, updated_at
             FROM glow_balances WHERE id = 'user'",
            [],
            |row| {
                Ok(GlowBalance {
                    id: row.get(0)?,
                    glow_amount: row.get(1)?,
                    micro_tickets: row.get(2)?,
                    shimmer_tickets: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            },
        );

        match result {
            Ok(b) => Ok(b),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // 创建默认余额
                let now = Utc::now().to_rfc3339();
                self.conn.execute(
                    "INSERT INTO glow_balances (id, glow_amount, micro_tickets, shimmer_tickets, updated_at)
                     VALUES ('user', 0, 0, 0, ?1)",
                    [&now],
                )?;
                Ok(GlowBalance {
                    id: "user".to_string(),
                    glow_amount: 0,
                    micro_tickets: 0,
                    shimmer_tickets: 0,
                    updated_at: now,
                })
            }
            Err(e) => Err(e),
        }
    }

    pub fn update_glow(&self, amount: i32) -> SqliteResult<()> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE glow_balances SET glow_amount = glow_amount + ?1, updated_at = ?2 WHERE id = 'user'",
            [&amount.to_string(), &now],
        )?;
        Ok(())
    }

    pub fn update_tickets(&self, micro: i32, shimmer: i32) -> SqliteResult<()> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE glow_balances SET micro_tickets = micro_tickets + ?1, shimmer_tickets = shimmer_tickets + ?2, updated_at = ?3 WHERE id = 'user'",
            [&micro.to_string(), &shimmer.to_string(), &now],
        )?;
        Ok(())
    }

    pub fn consume_ticket(&self, ticket_type: &str) -> SqliteResult<bool> {
        let now = Utc::now().to_rfc3339();
        let column = if ticket_type == "micro" { "micro_tickets" } else { "shimmer_tickets" };

        let result = self.conn.execute(
            &format!("UPDATE glow_balances SET {} = {} - 1, updated_at = ?1 WHERE id = 'user' AND {} > 0", column, column, column),
            [&now],
        )?;

        Ok(result > 0)
    }
}
