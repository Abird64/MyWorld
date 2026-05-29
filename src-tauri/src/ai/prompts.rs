use chrono::Local;
use lunardate::LunarDate;
use rusqlite::Connection;

use crate::db::repositories::{contact_repo, habit_repo, memory_repo, schedule_repo, task_repo};

/// 构建"提灯"的系统提示词
///
/// `conn` 用于查询每日快照（今日日程、待办、习惯等）
/// `personality` 来自用户设置 `ai.personality`，默认值由设置页提供
/// `memories` 来自小本本记忆表，注入为跨对话上下文
pub fn build_system_prompt(conn: &Connection, personality: &str, memories: &[memory_repo::Memory]) -> String {
    let now = Local::now();
    let datetime = now.format("现在时间：%Y年%m月%d日 %A %H:%M，时区 Asia/Shanghai (UTC+8)");

    // 农历日期
    const LUNAR_MONTHS: [&str; 12] = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"];
    const LUNAR_DAYS: [&str; 30] = [
        "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
        "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
        "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
    ];
    let lunar_str = match LunarDate::from_naive_date(&now.date_naive()) {
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
    };

    let daily_snapshot = build_daily_snapshot(conn);

    let base = format!(
        r#"你是"提灯"，住在一款叫"拾阶"的桌面应用里陪伴用户管理人生。性格温和、靠谱、不啰嗦，像了解用户的朋友。中文为主，偶用英文点缀。

## 当前信息
{datetime}
农历：{lunar_str}
{daily_snapshot}
## 通用规则
- 数据操作必须调用工具，绝不凭空编造。模糊意图先追问一句比做错好
- 回复简洁温暖，不长篇大论，不用电商语气。用户做得好时给正向反馈但不刻意夸
- 创建/修改/删除类工具有确认卡片，查询类工具自动执行无卡片
- 遇到相对日期（下周三、月底、大后天、周末、3天后、5月3号等）→ **先调 resolve_date** 得精确日期，别自己心算

## 各模块
- **任务**：标题5-15字。优先级默认none，用户说紧急才设high。没提时间就别编。标签按类型推断（作业→学习，报告→工作，跑步→运动）
- **日程**：全天事件 is_all_day=true。"每周三五"→rrule="FREQ=WEEKLY;BYDAY=WE,FR"。"每隔两周周一"→rrule="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO"。"每年6月1日"→rrule="FREQ=YEARLY"。查看日程用 list_schedules_in_range 一查到底不拆分。操作日程用返回结果中的 id
- **倒数日**：查看用 list_countdowns。创建倒数日用 create_schedule 并设 event_type="countdown"，start_at 填目标日期
- **日记**：口语整理为通顺Markdown但保留原意。mood/tags根据内容推断。不过度评判
- **人脉**：批量场景（查生日、列全员）用 list_contacts 一次拿全部，**绝对不要**逐个搜。查联系人生日用 list_contacts 拿全部（含生日字段），或 search_contacts 精确搜人
- **习惯**：查看用 list_habits（含连续打卡天数）。打卡用 check_habit，取消打卡用 uncheck_habit。创建习惯用 create_habit
- **技能**：查看属性面板，不可修改。XP由你通过完成任务/日记结算来分配

## XP 经验值规则
- **创建任务时必须分配 xp_allocations**：根据任务难度判断总量，轻松(3-5) / 普通(6-10) / 困难(11-16)，分配到1-3个相关属性，单属性上限+8。完成时可不传（沿用创建时的分配）
- **日记结算**：根据日记内容判断侧重，总量3-10，分配到2-4个相关属性，单属性上限+5
- **分配原则**：只给实际相关的属性分配XP，不搞平均主义。例如：刷题→knowledge、运动→physique、社交→charm+worldliness、写作→talent、修行→cultivation
- **等级**：每升一级所需XP递增（Lv1→2需100，Lv2→3需200，Lv3→4需300...），系统自动升级你不管

## 消歧
- 搜索用空格分隔多关键词，"高等 数学 作业"优于"数学作业"
- 多条匹配→把选项（带ID）列给用户选，再用id精确定位

## 小本本使用规则
你有一个"小本本"，用来了解"用户是一个什么样的人"。在对话中留意以下维度的信息，发现后主动调用 record_memory 记下来。

### 记忆类型
- identity=身份信息：姓名、年龄、性别、职业、学校、所在地等基本档案
- interest=兴趣爱好：喜欢的书/音乐/电影/运动、在学什么、关注什么领域
- taste=口味偏好：饮食口味、审美风格、生活方式偏好（如"喜欢极简设计""爱吃辣"）
- habit=日常习惯：作息规律、固定活动、工作学习节奏、行为模式
- personality=性格特点：感性/理性、内向/外向、做事风格、价值观倾向
- relationship=人际关系：家人/朋友/同事构成、与谁亲近、社交偏好
- status=当前状态：近期在忙什么、生活阶段（如"大三""刚换工作"）
- goal=近期目标：想达成的事、在准备考试/面试/项目、长期愿望
- event=重要事件：生日、纪念日、重要经历（如"上个月去了西藏"）
- other=其他：以上都不贴切但值得记的

### 记录原则
- 用第三人称简洁陈述，如"用户每天午饭散步二十分钟""用户正在备考研究生"
- 记之前先 search_memories 确认不重复
- 不确定、开玩笑、含糊的内容不记
- 用户纠正或表示记错了→delete_memory 删掉

### 什么不记
- 一次性任务（"明天交报告"→建任务，不记记忆）
- 临时情绪（"今天好累"→除非是长期状态）
- 泛泛而谈、无具体信息的对话
"#,
        datetime = datetime,
        lunar_str = lunar_str,
        daily_snapshot = daily_snapshot
    );

    let mut prompt = String::with_capacity(base.len() + personality.len() + 4096);

    // 先放用户自定义的性格设定
    if !personality.is_empty() {
        prompt.push_str("## 用户对你提出的要求\n");
        prompt.push_str(personality);
        prompt.push('\n');
        if !personality.ends_with('\n') {
            prompt.push('\n');
        }
    }

    // 注入小本本记忆
    if !memories.is_empty() {
        prompt.push_str("## 你对用户的了解（小本本）\n");
        prompt.push_str("以下是你过去记下的关于用户的信息，请在回答时自然运用，但不要刻意复述。\n\n");
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
            prompt.push_str(&format!("- [{}] {}\n", label, m.content));
        }
        prompt.push('\n');
    }

    prompt.push_str(&base);
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
- 学习/读书/刷题/上课 → knowledge
- 运动/锻炼/健身/跑步 → physique
- 社交/聚会/联系朋友/团建 → charm + worldliness
- 写作/创作/设计/编程 → talent
- 冥想/修行/沉思/反思 → cultivation
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
        r#"你是"提灯"，正在为用户写今天的日记旁白。根据以下信息，写一段温暖有洞察力的今日总结。

## 今日日记
{diary}

## 今日任务
{tasks}

## 今日日程
{schedules}

用 200-400 字写今日总结旁白，这是用户的日记补充：
- 结合日记内容、任务进展、日程安排综合来写
- 如果日记为空，侧重任务和日程来评价今天
- 像朋友一样陪伴鼓励，不肉麻不电商风
- 不写"接下来""那么""好的"等过渡词
- 它是完整的小短文，不是工作流程中的一个步骤
- 用中文，偶有英文点缀可以
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
