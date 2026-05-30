/// 各模块的详细使用指南，供 AI 按需查阅
///
/// AI 通过 get_guide("任务") 工具调用获取，无需全部注入系统提示词

/// 获取指定模块的使用指南
pub fn get_guide(module: &str) -> Result<String, String> {
    let content = match module {
        "任务" | "task" => GUIDE_TASK,
        "日程" | "schedule" => GUIDE_SCHEDULE,
        "日记" | "journal" => GUIDE_JOURNAL,
        "人脉" | "contact" => GUIDE_CONTACT,
        "习惯" | "habit" => GUIDE_HABIT,
        "技能" | "skill" => GUIDE_SKILL,
        "小本本" | "memory" => GUIDE_MEMORY,
        "XP" | "xp" => GUIDE_XP,
        "概览" | "overview" => GUIDE_OVERVIEW,
        _ => return Err(format!("未知模块[{}]。可选：任务、日程、日记、人脉、习惯、技能、小本本、XP、概览", module)),
    };
    Ok(content.to_string())
}

/// 列出所有可用模块名
pub fn list_modules() -> Vec<&'static str> {
    vec!["任务", "日程", "日记", "人脉", "习惯", "技能", "小本本", "XP", "概览"]
}

// ========== 模块指南内容 ==========

const GUIDE_OVERVIEW: &str = r#"# 提灯 · 功能概览

提灯是一个本地优先的人生管理应用，你（提灯）陪伴用户拾级而上。

## 七大模块

| 模块 | 用途 | 主要工具 |
|------|------|----------|
| 任务 | 待办事项管理，含优先级、截止日、标签 | create_task, search_tasks, complete_task |
| 日程 | 日历事件、倒数日、周期性活动 | create_schedule, list_schedules_in_range |
| 日记 | 每日记录，支持 Markdown，AI 可写旁白和结算 XP | save_journal, get_journal_by_date, search_journals |
| 人脉 | 联系人生日、关系、事件记录 | create_contact, search_contacts, list_contacts |
| 习惯 | 每日打卡，连续天数追踪 | list_habits, check_habit, create_habit |
| 技能 | 六维属性面板（focus/vitality/empathy/creativity/insight/expression） | list_skills |
| AI 对话 | 即提灯本身，含工具调用、收藏、小本本 | send_message, record_memory, search_memories |

## 其他能力
- **日期解析**：resolve_date 将"下周三""月底"等转为精确日期
- **小本本**：跨对话记忆系统，记住用户的偏好、习惯、关系等
- **XP 系统**：完成任务和日记结算时分配经验值，驱动技能成长

调用 get_guide("模块名") 查看任意模块的详细用法。"#;

const GUIDE_TASK: &str = r#"# 任务模块指南

## 创建任务
- 调用 create_task
- **标题**：5-15字，简洁明了
- **优先级**：默认 none，用户说"紧急"才设 high，说"重要"设 medium
- **截止日**：用户提到时间才填，没提就别编。格式 ISO 8601
- **标签**：按类型推断（作业→学习，报告→工作，跑步→运动，买菜→生活）
- **描述/备注**：用户说的细节放 description，你的补充放 notes
- **必须分配 xp_allocations**：根据难度判断总量

## 搜索任务
- search_tasks：query 为空则列出所有。支持 status 筛选（pending/in_progress/completed/cancelled）
- 搜索用空格分隔多关键词："高等 数学 作业"优于"数学作业"
- 多条匹配→把选项列给用户选，再用 id 精确定位

## 完成任务
- complete_task：用 id 完成，系统自动结算 XP
- 可传 final_xp_allocations 覆盖创建时的分配

## 修改/删除
- update_task：用 id 修改任意字段
- delete_task：用 id 删除，需用户确认

## XP 分配参考
| 难度 | 总 XP | 属性数 |
|------|-------|--------|
| 轻松（洗衣服、买水） | 3-5 | 1-2 |
| 普通（写作业、运动1小时） | 6-10 | 1-3 |
| 困难（考试复习、项目交付） | 11-16 | 2-3 |

属性选择：刷题→focus、运动→vitality、社交→empathy+insight、写作→creativity、修行→expression"#;

const GUIDE_SCHEDULE: &str = r#"# 日程模块指南

## 创建日程
- 调用 create_schedule
- **标题**：简短描述事件
- **时间**：start_at 必填，end_at 可选（全天事件不需要 end_at）
- **全天事件**：设 is_all_day=true
- **日历**：可指定 calendar_id 归类

## 周期性日程（rrule）
- "每周三五" → rrule="FREQ=WEEKLY;BYDAY=WE,FR"
- "每隔两周周一" → rrule="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO"
- "每月1号" → rrule="FREQ=MONTHLY;BYMONTHDAY=1"
- "每年6月1日" → rrule="FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=1"
- 不要自己计算重复日期，直接写 rrule 让系统处理

## 查看日程
- list_schedules_in_range：传 start_date 和 end_date，一查到底不要拆分成多天
- list_calendars：查看所有日历分类
- list_countdowns：查看所有倒数日

## 倒数日
- 创建：用 create_schedule 并设 event_type="countdown"，start_at 填目标日期
- 查看：list_countdowns 返回所有倒数日及剩余天数

## 修改/删除
- update_schedule / delete_schedule：用返回结果中的 id 操作

## 注意
- 相对日期（下周三、月底、周末）→ **先调 resolve_date** 得精确日期，别自己心算
- 操作日程时用返回结果中的 id，不要猜 id 格式"#;

const GUIDE_JOURNAL: &str = r#"# 日记模块指南

## 写日记
- 调用 save_journal
- 把用户的口语整理为通顺的 Markdown，但保留原意，不要过度美化
- mood：根据内容推断心情（开心/平静/焦虑/疲惫/低落/愤怒/感动/兴奋/无聊/迷茫）
- tags：提取 1-5 个关键词标签（如 ["学习","运动"]）

## 读日记
- get_journal_by_date：按日期读取，格式 YYYY-MM-DD
- search_journals：搜索日记标题、摘要和正文内容，返回匹配片段
- get_timeline：查看某月哪些天有日记

## 日记结算 XP（日省）
- settle_diary：根据日记内容判断侧重，分配经验值
- 总量 3-10，分配到 2-4 个相关属性，单属性上限 5
- 每日限一次

## XP 分配参考
| 日记侧重 | 分配 |
|----------|------|
| 学习/读书/上课 | focus 为主 |
| 运动/锻炼 | vitality 为主 |
| 社交/聚会/见朋友 | empathy + insight |
| 写作/创作/编程 | creativity 为主 |
| 冥想/反思/独处 | expression 为主 |

## 注意
- 不过度评判用户日记内容
- mood 和 tags 是推断，不是评价"#;

const GUIDE_CONTACT: &str = r#"# 人脉模块指南

## 联系人操作
- create_contact：创建联系人，姓名必填，其他可选
- search_contacts：按姓名/昵称/备注搜索
- list_contacts：列出全部联系人（含生日字段）
- update_contact / delete_contact：用 id 操作

## 关键规则
- **批量场景用 list_contacts 一次拿全部**，绝对不要逐个搜索
  - 查生日、列全员、统计人数 → list_contacts
  - 找特定人 → search_contacts
- 联系人有 method 字段：phone（电话）、wechat（微信）、email 等
- 生日格式：YYYY-MM-DD

## 生日提醒
- 系统每日概况中会自动显示 7 天内的生日提醒
- 你不需要主动提醒生日，系统会处理"#;

const GUIDE_HABIT: &str = r#"# 习惯模块指南

## 习惯操作
- list_habits：查看所有习惯，含连续打卡天数和今日是否已打卡
- create_habit：创建习惯，name 必填
- check_habit：打卡（用 habit id）
- uncheck_habit：取消打卡
- delete_habit：删除习惯

## 打卡状态
- habits 返回中每个习惯有 checked_today 和 streak 字段
- streak = 连续打卡天数

## 注意
- 用户说"打卡XX"→ 先 list_habits 找到对应习惯的 id，再 check_habit
- 如果习惯不存在，先问用户要不要创建"#;

const GUIDE_SKILL: &str = r#"# 技能模块指南

## 六维属性
| 属性 | 含义 | 典型来源 |
|------|------|----------|
| focus | 专注力 | 学习、刷题、阅读 |
| vitality | 活力 | 运动、锻炼、户外 |
| empathy | 共情力 | 社交、聚会、帮助他人 |
| creativity | 创造力 | 写作、创作、编程、设计 |
| insight | 洞察力 | 社交、观察、分析 |
| expression | 表达力 | 冥想、反思、修行 |

## 查看
- list_skills：返回所有属性的当前等级、XP、进度
- get_task_skills：查看某个任务关联的 XP 分配

## 规则
- **你不能直接修改技能值**，只能通过完成任务或日记结算来分配 XP
- 创建任务时必须分配 xp_allocations
- 日记结算用 settle_diary
- 每升一级所需 XP 递增（Lv1→2 需 100，Lv2→3 需 200...），系统自动升级"#;

const GUIDE_MEMORY: &str = r#"# 小本本指南

小本本是你了解用户的核心工具。你通过它记住用户是一个什么样的人。

## 操作
- record_memory：记录一条记忆
- search_memories：搜索已有记忆
- delete_memory：删除错误或过时的记忆

## 记忆类型
| 类型 | 含义 | 示例 |
|------|------|------|
| identity | 身份信息 | "用户是大三学生，在北大读计算机" |
| interest | 兴趣爱好 | "用户喜欢跑步和看科幻小说" |
| taste | 口味偏好 | "用户爱吃辣，不吃香菜" |
| habit | 日常习惯 | "用户每天午饭散步二十分钟" |
| personality | 性格特点 | "用户偏内向，做事喜欢先规划" |
| relationship | 人际关系 | "用户和妈妈关系亲近，每周视频" |
| status | 当前状态 | "用户正在准备考研" |
| goal | 近期目标 | "用户想在年底前考过雅思" |
| event | 重要事件 | "用户上个月去了西藏旅行" |
| other | 其他 | 以上都不贴切但值得记的 |

## 记录原则
- 用第三人称简洁陈述
- 记之前先 search_memories 确认不重复
- 不确定、开玩笑、含糊的内容不记
- 用户纠正或表示记错了→delete_memory 删掉

## 什么不记
- 一次性任务（"明天交报告"→建任务，不记记忆）
- 临时情绪（"今天好累"→除非是长期状态）
- 泛泛而谈、无具体信息的对话"#;

const GUIDE_XP: &str = r#"# XP 经验值系统

## 六维属性
focus（专注）、vitality（活力）、empathy（共情）、creativity（创造）、insight（洞察）、expression（表达）

## 任务 XP
- 创建任务时必须传 xp_allocations
- 难度判断：轻松(3-5) / 普通(6-10) / 困难(11-16)
- 分配到 1-3 个相关属性，单属性上限 +8
- 完成时可不传 final_xp_allocations（沿用创建时的分配）

## 日记 XP
- 调用 settle_diary 结算
- 根据日记内容判断侧重，总量 3-10
- 分配到 2-4 个相关属性，单属性上限 +5
- 每日限一次

## 分配原则
- 只给实际相关的属性分配，不搞平均主义
- 例：刷题→focus+6、跑步→vitality+5、聚会→empathy+4,insight+3
- 均衡的一天可适当平均，但要侧重最突出的方面

## 等级
- 每升一级所需 XP 递增：Lv1→2 需 100，Lv2→3 需 200，Lv3→4 需 300...
- 系统自动升级，你不管"#;
