use rusqlite::Connection;

pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        -- 任务表
        CREATE TABLE IF NOT EXISTS tasks (
            id              TEXT PRIMARY KEY,
            parent_id       TEXT,
            title           TEXT NOT NULL,
            description     TEXT,
            status          TEXT NOT NULL DEFAULT 'pending',
            priority        TEXT,
            scheduled_at    TEXT,
            deadline        TEXT,
            completed_at    TEXT,
            xp_earned       INTEGER DEFAULT 0,
            estimated_minutes INTEGER DEFAULT 0,
            notes           TEXT,
            tags            TEXT,
            sort_order      INTEGER DEFAULT 0,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL,
            FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE SET NULL
        );

        -- 技能表
        CREATE TABLE IF NOT EXISTS skills (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            description     TEXT,
            icon            TEXT,
            color           TEXT,
            parent_id       TEXT,
            category        TEXT,
            level           INTEGER DEFAULT 1,
            total_xp        INTEGER DEFAULT 0,
            is_unlocked     INTEGER DEFAULT 0,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL,
            FOREIGN KEY (parent_id) REFERENCES skills(id) ON DELETE SET NULL
        );

        -- 任务-技能关联表
        CREATE TABLE IF NOT EXISTS task_skills (
            id              TEXT PRIMARY KEY,
            task_id         TEXT NOT NULL,
            skill_id        TEXT NOT NULL,
            xp_amount       INTEGER DEFAULT 0,
            created_at      TEXT NOT NULL DEFAULT '',
            updated_at      TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
            UNIQUE(task_id, skill_id)
        );

        -- 技能XP流水表
        CREATE TABLE IF NOT EXISTS skill_events (
            id              TEXT PRIMARY KEY,
            skill_id        TEXT NOT NULL,
            xp_amount       INTEGER NOT NULL,
            source_type     TEXT NOT NULL,
            source_id       TEXT,
            note            TEXT,
            created_at      TEXT NOT NULL,
            FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
        );

        -- 日记元数据表
        CREATE TABLE IF NOT EXISTS journals (
            id              TEXT PRIMARY KEY,
            title           TEXT NOT NULL,
            summary         TEXT,
            file_path       TEXT NOT NULL,
            mood            TEXT,
            journal_date    TEXT NOT NULL,
            word_count      INTEGER DEFAULT 0,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
        );

        -- 日程表
        CREATE TABLE IF NOT EXISTS schedules (
            id              TEXT PRIMARY KEY,
            title           TEXT NOT NULL,
            description     TEXT,
            start_at        TEXT NOT NULL,
            end_at          TEXT,
            rrule           TEXT,
            reminder        TEXT,
            color           TEXT,
            is_all_day      INTEGER DEFAULT 0,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
        );

        -- 人脉表
        CREATE TABLE IF NOT EXISTS contacts (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            nickname        TEXT,
            group_name      TEXT,
            avatar_path     TEXT,
            birthday        TEXT,
            contact_info    TEXT,
            notes           TEXT,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
        );

        -- 日记-人脉关联表
        CREATE TABLE IF NOT EXISTS diary_contacts (
            id              TEXT PRIMARY KEY,
            journal_id      TEXT NOT NULL,
            contact_id      TEXT NOT NULL,
            FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
            UNIQUE(journal_id, contact_id)
        );

        -- 任务-人脉关联表
        CREATE TABLE IF NOT EXISTS task_contacts (
            id              TEXT PRIMARY KEY,
            task_id         TEXT NOT NULL,
            contact_id      TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
            UNIQUE(task_id, contact_id)
        );

        -- 配置表
        CREATE TABLE IF NOT EXISTS settings (
            key             TEXT PRIMARY KEY,
            value           TEXT NOT NULL,
            updated_at      TEXT NOT NULL
        );

        -- AI 对话表
        CREATE TABLE IF NOT EXISTS ai_conversations (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL DEFAULT '新对话',
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );

        -- AI 消息表
        CREATE TABLE IF NOT EXISTS ai_messages (
            id              TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role            TEXT NOT NULL,
            content         TEXT,
            tool_calls      TEXT,
            tool_call_id    TEXT,
            created_at      TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
        );

        -- 索引
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_at);
        CREATE INDEX IF NOT EXISTS idx_skills_parent ON skills(parent_id);
        CREATE INDEX IF NOT EXISTS idx_task_skills_task ON task_skills(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_skills_skill ON task_skills(skill_id);
        CREATE INDEX IF NOT EXISTS idx_skill_events_skill ON skill_events(skill_id);
        CREATE INDEX IF NOT EXISTS idx_journals_date ON journals(journal_date);
        CREATE INDEX IF NOT EXISTS idx_schedules_start ON schedules(start_at);
        CREATE INDEX IF NOT EXISTS idx_contacts_group ON contacts(group_name);
        CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id);
        ",
    )
    .map_err(|e| format!("Migration failed: {}", e))?;

    // 增量迁移：为已有数据库添加新列（忽略已存在的错误）
    let _ = conn.execute(
        "ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE journals ADD COLUMN entry_type TEXT DEFAULT 'user'",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE journals ADD COLUMN tags TEXT",
        [],
    );

    // 增量迁移：schedules 表新增字段
    let _ = conn.execute(
        "ALTER TABLE schedules ADD COLUMN location TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE schedules ADD COLUMN source_type TEXT DEFAULT 'manual'",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE schedules ADD COLUMN source_id TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE schedules ADD COLUMN category TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE schedules ADD COLUMN exdates TEXT",
        [],
    );

    // 增量迁移：ai_messages 加 reasoning_content（DeepSeek thinking 模式）
    let _ = conn.execute(
        "ALTER TABLE ai_messages ADD COLUMN reasoning_content TEXT",
        [],
    );

    // 增量迁移：birthday 从单个 TEXT 拆分为 4 个结构化字段
    let _ = conn.execute(
        "ALTER TABLE contacts ADD COLUMN birthday_calendar TEXT DEFAULT 'solar'",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE contacts ADD COLUMN birthday_year INTEGER",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE contacts ADD COLUMN birthday_month INTEGER",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE contacts ADD COLUMN birthday_day INTEGER",
        [],
    );
    // 从旧 birthday TEXT 列迁移数据到新字段（2000 是占位年份 → NULL）
    let _ = conn.execute(
        "UPDATE contacts SET \
         birthday_year = CASE WHEN CAST(substr(birthday,1,4) AS INTEGER) = 2000 \
                              THEN NULL ELSE CAST(substr(birthday,1,4) AS INTEGER) END, \
         birthday_month = CAST(substr(birthday,6,2) AS INTEGER), \
         birthday_day = CAST(substr(birthday,9,2) AS INTEGER) \
         WHERE birthday IS NOT NULL AND birthday != '' AND length(birthday) >= 10",
        [],
    );

    // 增量迁移：人脉分组名从古风改为直白
    let _ = conn.execute("UPDATE contacts SET group_name = '家人' WHERE group_name = '至亲'", []);
    let _ = conn.execute("UPDATE contacts SET group_name = '朋友' WHERE group_name = '知己'", []);
    let _ = conn.execute("UPDATE contacts SET group_name = '同学' WHERE group_name = '同窗'", []);
    let _ = conn.execute("UPDATE contacts SET group_name = '同事' WHERE group_name = '共事'", []);
    let _ = conn.execute("UPDATE contacts SET group_name = '老师' WHERE group_name = '恩师'", []);

    // 增量迁移：联系方式从 contacts.contact_info TEXT 拆分为 contact_methods 独立表
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS contact_methods (
            id          TEXT PRIMARY KEY,
            contact_id  TEXT NOT NULL,
            method_type TEXT NOT NULL DEFAULT 'other',
            value       TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
        )",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_contact_methods_contact ON contact_methods(contact_id)",
        [],
    );

    // 迁移旧 contact_info 数据（仅在表刚创建且为空时执行一次）
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM contact_methods", [], |row| row.get(0))
        .unwrap_or(0);
    if count == 0 {
        let mut stmt = conn
            .prepare("SELECT id, contact_info, created_at FROM contacts WHERE contact_info IS NOT NULL AND contact_info != ''")
            .map_err(|e| format!("Migration prepare failed: {}", e))?;
        let rows: Vec<(String, String, String)> = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| format!("Migration query_map failed: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        for (contact_id, info, created_at) in &rows {
            for val in info.split([',', '，']).map(|s| s.trim()).filter(|s| !s.is_empty()) {
                let method_id: String = nanoid::nanoid!();
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO contact_methods (id, contact_id, method_type, value, created_at)
                     VALUES (?1, ?2, 'other', ?3, ?4)",
                    rusqlite::params![method_id, contact_id, val, created_at],
                );
            }
        }
    }

    // 增量迁移：AI 对话收藏夹
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_favorites (
            id                  TEXT PRIMARY KEY,
            content             TEXT NOT NULL,
            role                TEXT NOT NULL DEFAULT 'assistant',
            conversation_title  TEXT,
            message_id          TEXT,
            created_at          TEXT NOT NULL
        )",
        [],
    );
    // 为已有数据库补加 message_id 列
    let _ = conn.execute(
        "ALTER TABLE ai_favorites ADD COLUMN message_id TEXT",
        [],
    );

    // 增量迁移：日历表（用户自建日历视图）
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS calendars (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL UNIQUE,
            color       TEXT NOT NULL DEFAULT '#3A8FB7',
            is_default  INTEGER DEFAULT 0,
            sort_order  INTEGER DEFAULT 0,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        )",
        [],
    );

    // 增量迁移：schedules 加 calendar_id
    let _ = conn.execute(
        "ALTER TABLE schedules ADD COLUMN calendar_id TEXT",
        [],
    );

    // 从现有 category 值创建日历条目并回填 calendar_id
    let mut cat_stmt = conn
        .prepare("SELECT DISTINCT category FROM schedules WHERE category IS NOT NULL AND category != ''")
        .map_err(|e| format!("Migration error: {}", e))?;
    let categories: Vec<String> = cat_stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Migration error: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let cat_colors: std::collections::HashMap<&str, &str> = [
        ("课表", "#3A8FB7"),
        ("学习", "#4A90D9"),
        ("娱乐", "#D4A843"),
        ("工作", "#58A968"),
        ("生活", "#D98B58"),
    ].into_iter().collect();

    for cat in &categories {
        let cal_id = nanoid::nanoid!();
        let color = cat_colors.get(cat.as_str()).copied().unwrap_or("#999999");
        let _ = conn.execute(
            "INSERT OR IGNORE INTO calendars (id, name, color, is_default, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, 0, 1, datetime('now'), datetime('now'))",
            rusqlite::params![cal_id, cat, color],
        );
        let _ = conn.execute(
            "UPDATE schedules SET calendar_id = ?1 WHERE category = ?2 AND calendar_id IS NULL",
            rusqlite::params![cal_id, cat],
        );
    }

    // 插入默认日历（如不存在）
    let _ = conn.execute(
        "INSERT OR IGNORE INTO calendars (id, name, color, is_default, sort_order, created_at, updated_at)
         VALUES (?1, '主日历', '#3A8FB7', 1, 0, datetime('now'), datetime('now'))",
        rusqlite::params![nanoid::nanoid!()],
    );
    let _ = conn.execute(
        "INSERT OR IGNORE INTO calendars (id, name, color, is_default, sort_order, created_at, updated_at)
         VALUES (?1, '其他', '#999999', 0, 2, datetime('now'), datetime('now'))",
        rusqlite::params![nanoid::nanoid!()],
    );

    // 增量迁移：心愿表（心愿夹系统）
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS wishes (
            id              TEXT PRIMARY KEY,
            title           TEXT NOT NULL,
            description     TEXT,
            level           INTEGER NOT NULL DEFAULT 1,
            cost_glow       INTEGER NOT NULL DEFAULT 0,
            quantity        INTEGER DEFAULT -1,
            achieved_count  INTEGER DEFAULT 0,
            status          TEXT NOT NULL DEFAULT 'active',
            achieved_at     TEXT,
            sort_order      INTEGER DEFAULT 0,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL,
            deleted_at      TEXT
        )",
        [],
    );
    // 为已有表添加 quantity 列
    let _ = conn.execute(
        "ALTER TABLE wishes ADD COLUMN quantity INTEGER DEFAULT -1",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE wishes ADD COLUMN achieved_count INTEGER DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_wishes_level ON wishes(level)",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_wishes_status ON wishes(status)",
        [],
    );

    // 增量迁移：抽奖记录表
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS wish_draws (
            id              TEXT PRIMARY KEY,
            draw_type       TEXT NOT NULL DEFAULT 'micro',
            ticket_type     TEXT NOT NULL DEFAULT 'micro',
            cost            INTEGER NOT NULL DEFAULT 0,
            result_wish_id  TEXT,
            result_type     TEXT DEFAULT 'none',
            pity_count      INTEGER DEFAULT 0,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL,
            FOREIGN KEY (result_wish_id) REFERENCES wishes(id) ON DELETE SET NULL
        )",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_wish_draws_type ON wish_draws(draw_type)",
        [],
    );

    // 增量迁移：萤火余额表（用户虚拟货币）
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS glow_balances (
            id              TEXT PRIMARY KEY,
            glow_amount     INTEGER NOT NULL DEFAULT 0,
            micro_tickets   INTEGER NOT NULL DEFAULT 0,
            shimmer_tickets INTEGER NOT NULL DEFAULT 0,
            updated_at      TEXT NOT NULL
        )",
        [],
    );
    // 初始化默认余额记录
    let _ = conn.execute(
        "INSERT OR IGNORE INTO glow_balances (id, glow_amount, micro_tickets, shimmer_tickets, updated_at)
         VALUES ('user', 0, 0, 0, datetime('now'))",
        [],
    );

    // 增量迁移：番茄钟会话表
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS pomodoro_sessions (
            id              TEXT PRIMARY KEY,
            task_id         TEXT,
            session_type    TEXT NOT NULL DEFAULT 'focus',
            target_minutes  INTEGER NOT NULL,
            actual_seconds  INTEGER NOT NULL DEFAULT 0,
            status          TEXT NOT NULL DEFAULT 'running',
            started_at      TEXT NOT NULL,
            completed_at    TEXT,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL,
            deleted_at      TEXT,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
        )",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_task ON pomodoro_sessions(task_id)",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_status ON pomodoro_sessions(status)",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_sync ON pomodoro_sessions(updated_at)",
        [],
    );

    // 增量迁移：AI 小本本记忆表
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_memories (
            id              TEXT PRIMARY KEY,
            content         TEXT NOT NULL,
            memory_type     TEXT NOT NULL DEFAULT 'fact',
            source_text     TEXT,
            conversation_id TEXT,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE SET NULL
        )",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_memories_type ON ai_memories(memory_type)",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_memories_created ON ai_memories(created_at DESC)",
        [],
    );

    // 增量迁移：schedules 表加 event_type（'event' 普通日程 / 'countdown' 倒数日）
    let _ = conn.execute(
        "ALTER TABLE schedules ADD COLUMN event_type TEXT DEFAULT 'event'",
        [],
    );

    // 增量迁移：习惯表
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS habits (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            icon            TEXT,
            color           TEXT,
            frequency_type  TEXT NOT NULL DEFAULT 'daily',
            frequency_value TEXT,
            target_minutes  INTEGER,
            skill_id        TEXT,
            xp_per_check    INTEGER DEFAULT 5,
            is_active       INTEGER DEFAULT 1,
            sort_order      INTEGER DEFAULT 0,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
        )",
        [],
    );
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS habit_records (
            id          TEXT PRIMARY KEY,
            habit_id    TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
            checked_at  TEXT NOT NULL,
            note        TEXT,
            created_at  TEXT NOT NULL
        )",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_habit_records_habit ON habit_records(habit_id)",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_habit_records_date ON habit_records(checked_at)",
        [],
    );
    let _ = conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_records_unique ON habit_records(habit_id, checked_at)",
        [],
    );

    // 修复：将 habit_records UNIQUE 索引改为条件索引，排除已软删除的记录
    // 否则取消打卡（软删除）后同一天无法重新打卡
    let _ = conn.execute(
        "DROP INDEX IF EXISTS idx_habit_records_unique",
        [],
    );
    let _ = conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_records_unique ON habit_records(habit_id, checked_at) WHERE deleted_at IS NULL",
        [],
    );

    // 增量迁移：技能 ID 英文重命名
    // knowledge→focus, physique→vitality, talent→creativity, worldliness→insight, charm→empathy, cultivation→expression
    // 先更新子表（避免外键冲突），再更新主表
    let skill_id_map: &[(&str, &str)] = &[
        ("knowledge", "focus"),
        ("physique", "vitality"),
        ("talent", "creativity"),
        ("worldliness", "insight"),
        ("charm", "empathy"),
        ("cultivation", "expression"),
    ];
    for &(old_id, new_id) in skill_id_map {
        let _ = conn.execute("UPDATE task_skills SET skill_id = ?1 WHERE skill_id = ?2", rusqlite::params![new_id, old_id]);
        let _ = conn.execute("UPDATE skill_events SET skill_id = ?1 WHERE skill_id = ?2", rusqlite::params![new_id, old_id]);
        let _ = conn.execute("UPDATE skills SET id = ?1 WHERE id = ?2", rusqlite::params![new_id, old_id]);
        // habits 表也可能引用旧 skill_id
        let _ = conn.execute("UPDATE habits SET skill_id = ?1 WHERE skill_id = ?2", rusqlite::params![new_id, old_id]);
    }

    // === 清理旧 CRDT 触发器和表（如果存在） ===
    cleanup_old_change_tracking(conn);

    // === 增量迁移：添加 deleted_at 列（软删除）===
    let sync_tables = [
        "tasks", "skills", "task_skills", "skill_events", "journals",
        "schedules", "contacts", "diary_contacts", "task_contacts",
        "settings", "ai_conversations", "ai_messages", "calendars",
        "contact_methods", "ai_favorites", "ai_memories", "habits", "habit_records",
        "pomodoro_sessions", "wishes", "wish_draws", "glow_balances", "glow_ledger",
    ];
    for table in &sync_tables {
        let _ = conn.execute(
            &format!("ALTER TABLE {} ADD COLUMN deleted_at TEXT", table),
            [],
        );
    }

    // === 增量迁移：给缺 updated_at 的表添加列 ===
    let now = "datetime('now')";
    for table in &["task_skills", "skill_events", "diary_contacts", "task_contacts",
                     "ai_messages", "contact_methods", "ai_favorites", "habit_records",
                     "glow_ledger"] {
        let _ = conn.execute(
            &format!("ALTER TABLE {} ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''", table),
            [],
        );
        // 回填已有数据的 updated_at = created_at（如果有的话），否则用当前时间
        let _ = conn.execute(
            &format!("UPDATE {table} SET updated_at = COALESCE(created_at, {now}) WHERE updated_at = ''"),
            [],
        );
    }

    // === 增量迁移：给缺 created_at 的表添加列 ===
    for table in &["task_skills"] {
        let _ = conn.execute(
            &format!("ALTER TABLE {} ADD COLUMN created_at TEXT NOT NULL DEFAULT ''", table),
            [],
        );
    }

    // 为 deleted_at 和 updated_at 创建索引
    for table in &sync_tables {
        let _ = conn.execute(
            &format!("CREATE INDEX IF NOT EXISTS idx_{table}_sync ON {table}(updated_at)"),
            [],
        );
    }

    // === 增量迁移：CRDT 变更追踪表 ===
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_changes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name      TEXT NOT NULL,      -- 表名
            row_pk          TEXT NOT NULL,      -- 主键值（JSON）
            column_name     TEXT,               -- 列名，NULL 表示整行操作
            value           TEXT,               -- 值（JSON），NULL 表示删除
            col_version     INTEGER DEFAULT 1,  -- 列版本号
            db_version      INTEGER NOT NULL,   -- 数据库版本号（单调递增）
            site_id         TEXT NOT NULL,      -- 站点ID
            seq             INTEGER,            -- 同事务内序列
            is_delete       INTEGER DEFAULT 0,  -- 是否是删除操作
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .map_err(|e| format!("Migration sync_changes failed: {}", e))?;

    // 变更追踪表索引
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sync_changes_version ON sync_changes(db_version, seq)",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sync_changes_site ON sync_changes(site_id, db_version)",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sync_changes_row ON sync_changes(table_name, row_pk, column_name)",
        [],
    );

    // === 增量迁移：数据库版本计数器表 ===
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_db_version (
            id              INTEGER PRIMARY KEY CHECK (id = 1),
            version         INTEGER DEFAULT 0,
            updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .map_err(|e| format!("Migration sync_db_version failed: {}", e))?;

    // 初始化版本计数器
    let _ = conn.execute("INSERT OR IGNORE INTO sync_db_version (id, version) VALUES (1, 0)", []);

    // === 增量迁移：Counter CRDT 支持表 ===
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_counters (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name      TEXT NOT NULL,      -- 表名
            row_pk          TEXT NOT NULL,      -- 主键
            column_name     TEXT NOT NULL,      -- 列名
            site_id         TEXT NOT NULL,      -- 站点ID
            delta           INTEGER NOT NULL,   -- 增量值
            db_version      INTEGER NOT NULL,   -- 版本号
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .map_err(|e| format!("Migration sync_counters failed: {}", e))?;

    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sync_counters_lookup ON sync_counters(table_name, row_pk, column_name, site_id)",
        [],
    );

    // 增量迁移：tasks 表加 glow_reward（完成任务时奖励的萤火数，0 则自动计算）
    let _ = conn.execute(
        "ALTER TABLE tasks ADD COLUMN glow_reward INTEGER DEFAULT 0",
        [],
    );

    // 增量迁移：萤火账本表
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS glow_ledger (
            id              TEXT PRIMARY KEY,
            asset_type      TEXT NOT NULL,
            change_amount   INTEGER NOT NULL,
            balance_after   INTEGER NOT NULL,
            reason          TEXT NOT NULL,
            source_desc     TEXT NOT NULL DEFAULT '',
            related_id      TEXT NOT NULL DEFAULT '',
            created_at      TEXT NOT NULL
        )",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_glow_ledger_type ON glow_ledger(asset_type)",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_glow_ledger_created ON glow_ledger(created_at)",
        [],
    );

    // 增量迁移：ai_messages 加 images 列（支持图片消息）
    let _ = conn.execute(
        "ALTER TABLE ai_messages ADD COLUMN images TEXT",
        [],
    );

    // 增量迁移：日记图片表
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS journal_images (
            id          TEXT PRIMARY KEY,
            journal_id  TEXT NOT NULL,
            file_path   TEXT NOT NULL,
            file_name   TEXT NOT NULL,
            mime_type   TEXT,
            file_size   INTEGER,
            sort_order  INTEGER DEFAULT 0,
            created_at  TEXT NOT NULL,
            FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE
        )",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_journal_images_journal ON journal_images(journal_id)",
        [],
    );

    // 清理回退：将 keychain 占位符恢复为空字符串（OS 密钥链方案已回退）
    for key in &["sync.password", "ai.api_key", "sync.oss.access_key_secret"] {
        let _ = conn.execute(
            "UPDATE settings SET value = '' WHERE key = ?1 AND value = '[keychain]'",
            rusqlite::params![key],
        );
    }

    // === 增量迁移：心愿仓库 — wish_draws 增加 redeemed_at ===
    // ALTER TABLE ADD COLUMN 在列已存在时会静默失败，所以安全
    let _ = conn.execute(
        "ALTER TABLE wish_draws ADD COLUMN redeemed_at TEXT",
        [],
    );
    // 一次性修复：旧迁移 bug 误将所有 draw 标记为已核销
    // 用 settings 表做标记，只执行一次
    let fix_done: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM settings WHERE key = '_migration_fix_redeemed_at'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if !fix_done {
        log::warn!("[migration] 修复 wish_draws 误标记的 redeemed_at");
        let _ = conn.execute(
            "UPDATE wish_draws SET redeemed_at = NULL WHERE redeemed_at IS NOT NULL",
            [],
        );
        let _ = conn.execute(
            "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('_migration_fix_redeemed_at', '1', datetime('now'))",
            [],
        );
    }

    log::info!("Database migrations completed");
    Ok(())
}

/// 清理旧的 CRDT 触发器和表
fn cleanup_old_change_tracking(conn: &Connection) {
    // 删除所有 _crsql_* 触发器
    let tables = [
        "tasks", "skills", "task_skills", "skill_events", "journals",
        "schedules", "contacts", "diary_contacts", "task_contacts",
        "settings", "ai_conversations", "ai_messages", "calendars",
        "contact_methods", "ai_favorites", "ai_memories", "habits", "habit_records",
        "pomodoro_sessions",
    ];
    for table in &tables {
        let _ = conn.execute_batch(&format!(
            "DROP TRIGGER IF EXISTS _crsql_{table}_insert;
             DROP TRIGGER IF EXISTS _crsql_{table}_update;
             DROP TRIGGER IF EXISTS _crsql_{table}_delete;"
        ));
    }
    // 删除旧表
    let _ = conn.execute("DROP TABLE IF EXISTS crsql_changes", []);
    let _ = conn.execute("DROP TABLE IF EXISTS crsql_db_version", []);
    // 清理旧的同步配置
    let _ = conn.execute("DELETE FROM settings WHERE key IN ('sync.export_version', 'sync.last_known_versions')", []);
}
