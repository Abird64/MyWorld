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

    log::info!("Database migrations completed");
    Ok(())
}
