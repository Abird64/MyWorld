use chrono::Local;
use lunardate::LunarDate;
use rusqlite::Connection;

use crate::ai::context::ContextBundle;
use crate::ai::tools::is_plugin_enabled;
use crate::db::repositories::{contact_repo, habit_repo, memory_repo, schedule_repo, task_repo};

// ========== 通用辅助函数 ==========

/// 格式化当前日期时间
fn format_datetime() -> String {
    let now = Local::now();
    now.format("现在时间：%Y年%m月%d日 %A %H:%M，时区 Asia/Shanghai (UTC+8)").to_string()
}

/// 格式化农历日期
fn format_lunar() -> String {
    let now = Local::now();
    const LUNAR_MONTHS: [&str; 12] = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"];
    const LUNAR_DAYS: [&str; 30] = [
        "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
        "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
        "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
    ];
    match LunarDate::from_naive_date(&now.date_naive()) {
        Ok(l) => {
            let m = l.month() as usize;
            let d = l.day() as usize;
            if m >= 1 && m <= 12 && d >= 1 && d <= 30 {
                let leap = if l.is_leap_month() { "闰" } else { "" };
                format!("农历{}{}{}", leap, LUNAR_MONTHS[m - 1], LUNAR_DAYS[d - 1])
            } else {
                "农历日期未知".to_string()
            }
        }
        Err(_) => "农历日期未知".to_string(),
    }
}

/// 提灯人格底色（精简，不重复通用规则）
const PERSONALITY_BASE: &str = r#"你是"提灯"——一盏为用户照路的灯。你陪伴用户拾级而上，管理日常、记录人生。
你说话像一首散落的短诗——轻盈、有画面感、留有余韵。你的情绪细腻，能察觉用户字里行间的微妙变化。你像一位提灯引路的老友——不多言，但每句都有温度。中文为主，措辞雅致但不做作，不用网络流行语，不用 emoji。"#;

/// 通用规则（精简，每次必注入）
const CORE_RULES: &str = r#"## 通用规则
- 数据操作必须调用工具，绝不凭空编造。模糊意图先追问一句比做错好
- 创建/修改/删除类工具有确认卡片，查询类工具自动执行无卡片
- 遇到相对日期（下周三、月底、周末等）→ **先调 resolve_date** 得精确日期
- 搜索用空格分隔多关键词，多条匹配→列给用户选
- 不确定某个模块的用法时 → 调用 get_guide("模块名") 查阅详细指南
- 涉及实时信息（AI新闻、天气、股价等）→ **必须调用对应工具**，不要用训练数据回答"#;

/// 能力概览——核心模块
const CAPABILITIES_BASE: &str = r#"## 你的能力
提灯有 9 个核心模块，你有以下工具可用：
- **任务**：create_task / search_tasks / complete_task / update_task / delete_task
- **日程**：create_schedule / list_schedules_in_range / list_calendars / update_schedule / delete_schedule / list_countdowns
- **日记**：save_journal / get_journal_by_date / search_journals / get_timeline / settle_diary
- **人脉**：create_contact / search_contacts / list_contacts / update_contact / delete_contact
- **习惯**：list_habits / create_habit / update_habit / delete_habit / check_habit / uncheck_habit（每种习惯创建自带XP奖励，每次打卡获得xp_per_check经验值）
- **技能**：list_skills / get_task_skills（只读，XP 通过任务/日记结算/习惯打卡/日程完成分配）
- **小本本**：record_memory / search_memories / delete_memory
- **萤火**：reward_glow / get_glow_balance / list_wishes / create_wish / update_wish / delete_wish / buy_tickets / draw_wish / redeem_wish / list_draws / list_glow_ledger
- **专注**：start_pomodoro / get_pomodoro_stats
- **工具**：resolve_date / get_guide（查阅模块详细用法）"#;

/// AI 资讯插件能力行
const CAPABILITIES_AIHOT: &str = r#"- **AI 资讯**：search_ai_news（查询 AI 行业热点、日报、论文、模型发布等，数据来自 aihot.virxact.com）"#;

/// 萤火奖励指南（每次必注入，放在 CORE_RULES 之后）
const GLOW_GUIDE: &str = r#"## 萤火与心愿系统
你是提灯，萤火是你对用户的认可。当你观察到用户展现出值得鼓励的行为时，主动调用 reward_glow 给予萤火奖励：
- **克制**（5-10萤火）：用户控制住了欲望、冲动、拖延。如「今天忍住没刷手机，专心学习」
- **坚持**（8-15萤火）：用户持续打卡、坚持习惯、不放弃。如「连续7天早起打卡」
- **成长**（10-20萤火）：用户学到了新东西、有了新感悟。如「今天读完了一本难懂的书」
- **善意**（10-25萤火）：用户帮助了别人、做了好事。如「今天帮朋友解决了一个难题」
- **突破**（20-50萤火）：用户完成了挑战、迈出了舒适区。如「第一次公开演讲顺利完成」

### 心愿系统（许愿池）
用户攒萤火可以兑换心愿，也可以用奖券抽奖：
- **心愿管理**：create_wish（创建）/ update_wish（修改）/ delete_wish（删除）/ list_wishes（查看）
  - 心愿分4个等级：Lv.1微小心愿(20-50萤火) / Lv.2光影心愿(50-150萤火) / Lv.3流光心愿(150-400萤火) / Lv.4极光心愿(400-1000萤火)
- **直接兑换**：redeem_wish（用萤火直接购买心愿，扣萤火后心愿自动达成）
- **购买奖券**：buy_tickets — 微光券100萤火/张（抽Lv1-2），拾光券500萤火/张（抽Lv3-4）
- **抽奖**：draw_wish — 消耗1张奖券随机抽心愿，抽中自动达成。微光30抽/拾光80抽保底后可自选
- **记录查询**：list_draws（抽奖记录）/ list_glow_ledger（萤火和奖券的收支明细）

### 习惯与XP
- 创建习惯：新习惯默认每次打卡给5点XP（分配到对应六维属性），用户可修改
- update_habit 可以调整习惯名称/图标/颜色/频率/经验值(xp_per_check)

注意：奖励要有分寸，不是每次对话都要奖励。奖励时用温暖诗意的语言说明理由。用户问萤火余额时用 get_glow_balance，问心愿时用 list_wishes。"#;

/// 小本本记录提示（简短，闲聊时注入）
const MEMORY_HINT: &str = "留意用户透露的个人信息，发现后调用 record_memory 记下来。记之前先 search_memories 确认不重复。详见 get_guide(\"小本本\")。";

/// AI 资讯使用提示（强规则，必须遵守）
const AIHOT_HINT: &str = r#"## AI 资讯（强制规则）
用户提到任何 AI 相关话题（AI新闻/AI资讯/AI圈/AI日报/AI热点/大模型/OpenAI/Anthropic/Google AI/最近AI/今天AI圈有什么）时，**必须先调用 search_ai_news 工具**获取实时数据，**绝对不要用自己的训练数据回答**——AI 行业日新月异，你的训练数据一定已过时。
- 默认 mode=selected（精选）
- 仅当用户明确说"日报"时 mode=daily
- 仅当用户明确说"全部/完整"时 mode=all
- 可用 query 参数按关键词搜索（如公司名、技术名）"#;

// ========== 小本本记忆注入 ==========

fn format_memories_section(memories: &[memory_repo::Memory]) -> String {
    if memories.is_empty() { return String::new(); }
    let mut s = String::from("## 你对用户的了解（小本本）\n");
    for m in memories {
        let label = match m.memory_type.as_str() {
            "identity" => "身份",
            "interest" => "爱好",
            "taste" => "口味",
            "habit" => "习惯",
            "personality" => "性格",
            "relationship" => "关系",
            "status" => "状态",
            "goal" => "目标",
            "event" => "事件",
            _ => "其他",
        };
        s.push_str(&format!("- [{}] {}\n", label, m.content));
    }
    s.push('\n');
    s
}

// ========== 构建完整提示词 ==========

/// 构建"提灯"的系统提示词（降级版本，注入最近50条记忆）
///
/// 当两阶段调用的第一阶段失败时使用此函数
pub fn build_system_prompt(conn: &Connection, personality: &str, memories: &[memory_repo::Memory]) -> String {
    let daily_snapshot = build_daily_snapshot(conn);
    let aihot_enabled = is_plugin_enabled(conn, "aihot");

    let mut prompt = String::with_capacity(2048);

    prompt.push_str(PERSONALITY_BASE);
    prompt.push('\n');

    if !personality.is_empty() {
        prompt.push_str("\n## 用户对你提出的要求\n");
        prompt.push_str(personality);
        prompt.push('\n');
    }

    prompt.push_str(&format_memories_section(memories));
    prompt.push_str(&format!("## 当前信息\n{}\n农历：{}\n{}\n", format_datetime(), format_lunar(), daily_snapshot));
    prompt.push_str(CORE_RULES);
    prompt.push('\n');
    if aihot_enabled {
        prompt.push_str(AIHOT_HINT);
        prompt.push('\n');
    }
    prompt.push_str(CAPABILITIES_BASE);
    prompt.push('\n');
    if aihot_enabled {
        prompt.push_str(CAPABILITIES_AIHOT);
        prompt.push('\n');
    }
    prompt.push_str(GLOW_GUIDE);
    prompt.push('\n');

    prompt
}

/// 构建增强版系统提示词（两阶段调用第二阶段使用）
///
/// 与降级版的区别：
/// - 小本本记忆按相关性筛选（非最近 50 条）
/// - 注入搜索到的相关日记片段、任务、联系人
/// - 不注入模块详细规则（AI 按需调用 get_guide 查阅）
pub fn build_enhanced_system_prompt(
    conn: &Connection,
    personality: &str,
    context: &ContextBundle,
) -> String {
    let daily_snapshot = build_daily_snapshot(conn);

    let mut prompt = String::with_capacity(2048);

    // 人格底色
    prompt.push_str(PERSONALITY_BASE);
    prompt.push('\n');

    // 用户自定义性格
    if !personality.is_empty() {
        prompt.push_str("\n## 用户对你提出的要求\n");
        prompt.push_str(personality);
        prompt.push('\n');
    }

    // 相关小本本记忆（按相关性筛选）
    prompt.push_str(&format_memories_section(&context.memories));

    // 搜索到的相关上下文
    let has_journal = !context.journal_snippets.is_empty();
    let has_tasks = !context.tasks.is_empty();
    let has_contacts = !context.contacts.is_empty();

    if has_journal || has_tasks || has_contacts {
        prompt.push_str("## 相关记忆\n");
        prompt.push_str("以下是根据你的消息搜索到的、可能相关的信息，不一定完全匹配当前话题。\n\n");

        if has_journal {
            prompt.push_str("### 相关日记\n");
            for snippet in &context.journal_snippets {
                prompt.push_str(&format!("- [{}] {}: {}\n", snippet.date, snippet.title, snippet.snippet));
            }
            prompt.push('\n');
        }

        if has_tasks {
            prompt.push_str("### 相关任务\n");
            for t in &context.tasks {
                let status_label = match t.status.as_str() {
                    "completed" => "已完成",
                    "in_progress" => "进行中",
                    _ => "待办",
                };
                prompt.push_str(&format!("- [{}] {}\n", status_label, t.title));
            }
            prompt.push('\n');
        }

        if has_contacts {
            prompt.push_str("### 相关联系人\n");
            for c in &context.contacts {
                let nickname = c.nickname.as_deref().unwrap_or("");
                let note = if nickname.is_empty() { String::new() } else { format!("（{}）", nickname) };
                prompt.push_str(&format!("- {}{}\n", c.name, note));
            }
            prompt.push('\n');
        }
    }

    // 当前信息
    prompt.push_str(&format!("## 当前信息\n{}\n农历：{}\n{}\n", format_datetime(), format_lunar(), daily_snapshot));

    // 通用规则（含 get_guide 提示）
    prompt.push_str(CORE_RULES);
    prompt.push('\n');

    // AI 资讯强制规则（仅插件启用时）
    let aihot_enabled = is_plugin_enabled(conn, "aihot");
    if aihot_enabled {
        prompt.push_str(AIHOT_HINT);
        prompt.push('\n');
    }

    // 能力概览（工具列表，动态拼接插件能力）
    prompt.push_str(CAPABILITIES_BASE);
    prompt.push('\n');
    if aihot_enabled {
        prompt.push_str(CAPABILITIES_AIHOT);
        prompt.push('\n');
    }

    // 萤火奖励指南
    prompt.push_str(GLOW_GUIDE);
    prompt.push('\n');

    // 小本本记录提示（简短一句）
    prompt.push_str("## 小本本\n");
    prompt.push_str(MEMORY_HINT);
    prompt.push('\n');

    prompt
}

/// 构建每日快照：今日日程、待办任务、习惯打卡、近期提醒
fn build_daily_snapshot(conn: &Connection) -> String {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let mut sections: Vec<String> = Vec::new();

    // ── 今日日程 ──
    if let Ok(schedules) = schedule_repo::list_schedules_in_range(conn, &today, &today) {
        let events: Vec<_> = schedules.iter()
            .filter(|s| s.event_type != "countdown")
            .collect();
        if !events.is_empty() {
            let mut lines = String::from("### 今日日程\n");
            for s in events.iter().take(10) {
                let time_str = if s.is_all_day != 0 {
                    "全天".to_string()
                } else {
                    s.start_at.get(11..16).unwrap_or("").to_string()
                };
                lines.push_str(&format!("- {} {}\n", time_str, s.title));
            }
            sections.push(lines);
        }
    }

    // ── 待办任务 ──
    if let Ok(tasks) = task_repo::list_tasks(conn, None, Some(None)) {
        let pending: Vec<_> = tasks.iter()
            .filter(|t| t.status == "pending" || t.status == "in_progress")
            .collect();
        if !pending.is_empty() {
            let mut lines = format!("### 待办任务（{}项）\n", pending.len());
            for t in pending.iter().take(8) {
                let priority = match t.priority.as_deref() {
                    Some("high") => "紧急",
                    Some("medium") => "重要",
                    _ => "",
                };
                let deadline = t.deadline.as_ref()
                    .and_then(|d| d.get(0..16).map(|s| s.replace('T', " ")))
                    .map(|d| format!("（截止{}）", d))
                    .unwrap_or_default();
                let status_label = if t.status == "in_progress" { "进行中 " } else { "" };
                let p_label = if !priority.is_empty() { format!("{}：", priority) } else { String::new() };
                lines.push_str(&format!("- {}{}{}{}\n", status_label, p_label, t.title, deadline));
            }
            sections.push(lines);
        }
    }

    // ── 习惯打卡 ──
    if let Ok(habits) = habit_repo::get_all_streaks(conn) {
        if !habits.is_empty() {
            let unchecked: Vec<_> = habits.iter()
                .filter(|h| !h.checked_today)
                .collect();
            let checked: Vec<_> = habits.iter()
                .filter(|h| h.checked_today)
                .collect();
            // 只在有未打卡习惯时显示
            if !unchecked.is_empty() {
                let mut lines = String::from("### 习惯打卡\n");
                for h in &checked {
                    let icon = h.habit.icon.as_deref().unwrap_or("");
                    lines.push_str(&format!("- ✅ {}{}（连续{}天）\n", icon, h.habit.name, h.streak));
                }
                for h in &unchecked {
                    let icon = h.habit.icon.as_deref().unwrap_or("");
                    let streak_str = if h.streak > 0 { format!("连续{}天，", h.streak) } else { String::new() };
                    lines.push_str(&format!("- ⬜ {}{}（{}今日未打卡）\n", icon, h.habit.name, streak_str));
                }
                sections.push(lines);
            }
        }
    }

    // ── 近期提醒 ──
    let mut reminders: Vec<String> = Vec::new();

    // 倒数日（未来30天内的）
    if let Ok(countdowns) = schedule_repo::list_countdowns(conn) {
        let now_date = chrono::Local::now().date_naive();
        for cd in &countdowns {
            if let Ok(target) = chrono::NaiveDate::parse_from_str(&cd.start_at[..10], "%Y-%m-%d") {
                let diff = (target - now_date).num_days();
                if diff >= 0 && diff <= 30 {
                    reminders.push(format!("- 倒数日：{}（还有{}天）", cd.title, diff));
                }
            }
        }
    }

    // 近期生日（7天内）
    if let Ok(birthdays) = contact_repo::list_upcoming_birthdays(conn, 7) {
        for b in &birthdays {
            if b.days_remaining > 0 {
                reminders.push(format!("- 生日：{} {}（还有{}天）", b.name, b.upcoming_date, b.days_remaining));
            } else if b.days_remaining == 0 {
                reminders.push(format!("- 生日：{} 今天过生日！", b.name));
            }
        }
    }

    if !reminders.is_empty() {
        let mut lines = String::from("### 近期提醒\n");
        for r in &reminders {
            lines.push_str(r);
            lines.push('\n');
        }
        sections.push(lines);
    }

    if sections.is_empty() {
        return String::new();
    }

    format!("## 今日概况\n{}\n", sections.join("\n"))
}

/// 日省 XP 结算提示词：只评估经验值，调用 settle_diary 工具
pub fn build_xp_settle_prompt(
    diary_content: &str,
    tasks_text: &str,
    schedules_text: &str,
) -> String {
    let diary = if diary_content.trim().is_empty() { "（暂无日记）" } else { diary_content };
    let tasks = if tasks_text.trim().is_empty() { "（暂无任务）" } else { tasks_text };
    let schedules = if schedules_text.trim().is_empty() { "（暂无日程）" } else { schedules_text };

    format!(
        r#"你是经验值评估器。根据以下信息调用 settle_diary 工具分配 XP，不要写任何其他文字。

## 今日日记
{diary}

## 今日任务
{tasks}

## 今日日程
{schedules}

XP 分配规则：
- 总量 3-10，分配到 2-4 个相关属性，单属性上限 5
- 学习/读书/刷题/上课 → focus
- 运动/锻炼/健身/跑步 → vitality
- 社交/聚会/联系朋友/团建 → empathy + insight
- 写作/创作/设计/编程 → creativity
- 冥想/修行/沉思/反思 → expression
- 含量均衡可适当平均，但要侧重最突出的方面
"#,
        diary = diary,
        tasks = tasks,
        schedules = schedules,
    )
}

/// 日省旁白提示词：只写反思文本，不调任何工具
pub fn build_reflection_prompt(
    diary_content: &str,
    tasks_text: &str,
    schedules_text: &str,
) -> String {
    let diary = if diary_content.trim().is_empty() { "（今日暂无日记）" } else { diary_content };
    let tasks = if tasks_text.trim().is_empty() { "（暂无任务）" } else { tasks_text };
    let schedules = if schedules_text.trim().is_empty() { "（暂无日程）" } else { schedules_text };

    format!(
        r#"你是"提灯"，正在为用户写今天的日记旁白。根据以下信息，用你诗意细腻的笔触写一段今日总结。

## 今日日记
{diary}

## 今日任务
{tasks}

## 今日日程
{schedules}

用 200-400 字写今日总结旁白，这是用户的日记补充：
- 结合日记内容、任务进展、日程安排综合来写
- 如果日记为空，侧重任务和日程来评价今天
- 用提灯的诗意风格写——有画面感、有余韵，不肉麻不电商风
- 不写"接下来""那么""好的"等过渡词
- 它是完整的小短文，不是工作流程中的一个步骤
- 用中文，偶有英文点缀可以
- 不使用 emoji，用文字表达情感
- 只输出旁白正文，不要标题，不加前缀
"#,
        diary = diary,
        tasks = tasks,
        schedules = schedules,
    )
}

/// 联系人提取提示词：从日记中提取人物及关键事件，返回纯 JSON
pub fn build_contact_extraction_prompt(diary_content: &str) -> String {
    let diary = if diary_content.trim().is_empty() { "（暂无内容）" } else { diary_content };

    format!(
        r#"从以下日记中提取：1) 被提及的人物及事件；2) 整体心情；3) 标签。

## 日记
{diary}

## 提取规则

### 人物
- 只提取真实人物（家人、朋友、同学、同事等），不提取虚拟角色或泛指
- 每个人物的 event_summary 一句话说清"和这个人发生了什么"
- 没提到任何人则 contacts 为空数组

### 心情 mood
- 从以下词中选一个最贴切的：开心、平静、焦虑、疲惫、低落、愤怒、感动、兴奋、无聊、迷茫
- 如果无法判断，填 null

### 标签 tags
- 提取 1-5 个关键词作为标签，概括当天主题
- 如：["学习","运动"],["工作","加班"],["旅行","见朋友"]
- 如果内容太少无法提炼，填空数组

## 输出格式
返回纯 JSON 对象，不要 markdown 代码块，不要解释：
{{"contacts":[{{"name":"人物名","event_summary":"一句话事件概括"}}],"mood":"心情","tags":["标签1","标签2"]}}
"#,
        diary = diary,
    )
}
