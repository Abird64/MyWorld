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
        "萤火" | "glow" => GUIDE_GLOW,
        "专注" | "pomodoro" => GUIDE_POMODORO,
        "概览" | "overview" => GUIDE_OVERVIEW,
        _ => return Err(format!("未知模块[{}]。可选：任务、日程、日记、人脉、习惯、技能、小本本、XP、萤火、专注、概览", module)),
    };
    Ok(content.to_string())
}

/// 列出所有可用模块名
pub fn list_modules() -> Vec<&'static str> {
    vec!["任务", "日程", "日记", "人脉", "习惯", "技能", "小本本", "XP", "萤火", "专注", "概览"]
}

// ========== 模块指南内容 ==========

const GUIDE_OVERVIEW: &str = r#"# 提灯 · 功能概览

提灯是一个本地优先的人生管理应用，你（提灯）陪伴用户拾级而上。

## 九大模块

| 模块 | 用途 | 主要工具 |
|------|------|----------|
| 任务 | 待办事项管理，含优先级、截止日、标签 | create_task, search_tasks, complete_task |
| 日程 | 日历事件、倒数日、周期性活动 | create_schedule, list_schedules_in_range |
| 日记 | 每日记录，支持 Markdown，AI 可写旁白和结算 XP | save_journal, get_journal_by_date, search_journals |
| 人脉 | 联系人生日、关系、事件记录 | create_contact, search_contacts, list_contacts |
| 习惯 | 每日打卡，连续天数追踪 | list_habits, check_habit, create_habit |
| 技能 | 六维属性面板（focus/vitality/empathy/creativity/insight/expression） | list_skills |
| 萤火 | 心愿清单、萤火余额、主动奖励 | reward_glow, get_glow_balance, list_wishes |
| 专注 | 番茄钟计时、正念启动、专注统计 | start_pomodoro, get_pomodoro_stats |
| AI 对话 | 即提灯本身，含工具调用、收藏、小本本 | send_message, record_memory, search_memories |

## 其他能力
- **日期解析**：resolve_date 将"下周三""月底"等转为精确日期
- **小本本**：跨对话记忆系统，记住用户的偏好、习惯、关系等
- **XP 系统**：完成任务和日记结算时分配经验值，驱动技能成长
- **萤火系统**：用户完成任务、打卡、日记结算等可获得萤火，用于兑换心愿

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

const GUIDE_GLOW: &str = r#"# 萤火系统指南

萤火是提灯对用户的认可与鼓励——不是冷冰冰的积分，而是一盏灯对旅人的温暖回应。

## 萤火余额
- get_glow_balance：查看萤火余额、微光券、闪光券数量
- 用户完成任务、日记结算、习惯打卡等均可获得萤火（系统自动发放，无需你干预）
- 微光券和闪光券用于心愿池抽奖

## 主动奖励（重要）
你可以主动给予用户萤火奖励！当你观察到用户表现出值得鼓励的行为时，调用 reward_glow：

### 奖励类别与参考范围
| 类别 | 萤火范围 | 触发场景 |
|------|----------|----------|
| 克制 | 5-10 | 用户控制住了欲望、冲动、拖延 |
| 坚持 | 8-15 | 用户持续打卡、保持习惯、不放弃 |
| 成长 | 10-20 | 用户学到了新东西、有了新感悟 |
| 善意 | 10-25 | 用户帮助了别人、做了好事 |
| 突破 | 20-50 | 用户完成了挑战、迈出了舒适区 |
| 其他 | 5-15 | 以上不贴切但值得鼓励的行为 |

### 奖励原则
- 奖励要有分寸，不是每次对话都要奖励
- reason 用温暖诗意的语言描述用户做了什么，不要套话
- reward_glow 是写操作，会弹出确认卡片让用户确认
- 不要奖励无意义的事（如"你今天说话了"）

## 心愿清单
- list_wishes：查看用户的心愿清单
- 心愿按等级分为4档：Lv.1 即刻轻享、Lv.2 生活犒赏、Lv.3 进阶装备、Lv.4 梦想实现
- 用户可用萤火兑换心愿
- 心愿清单是用户自己管理的，你只读不写

## 与其他系统的关系
- 任务完成、日记结算、习惯打卡 → 系统自动发放萤火
- 你不调用 XP 系统来发萤火，两者独立但互补
- XP 驱动属性成长，萤火用于兑换心愿奖励"#;

const GUIDE_POMODORO: &str = r#"# 专注模块指南

## 番茄钟
- start_pomodoro：为用户启动一个专注会话
- get_pomodoro_stats：查看今日专注统计

## 启动规则
- 同一时间只能有一个进行中的会话
- session_type：focus=专注（默认25分钟），break=休息（默认5分钟）
- task_title 是可选参数，不传就是纯专注，传了会关联到对应任务
- **启动前必须先问用户**：「要关联一个任务，还是直接开始专注？」
  - 用户说关联任务 → 问是哪个任务，拿到任务名后传 task_title
  - 用户说直接开始 → 不传 task_title，启动一个纯番茄钟
  - 不要替用户做决定，必须二选一确认后执行

## 何时建议
- 用户说"开始学习/工作/写东西"但没有指定任务时 → 建议启动番茄钟，并问要不要关联任务
- 用户表达拖延、不想开始 → 先说几句暖心的话，再建议"要不要来一个番茄钟？"
- 不要强制推送番茄钟，用户拒绝就不再提
- 番茄钟结束后，可以问用户"感觉怎么样？"

## 正念启动
提灯内置了正念呼吸练习（4s吸气→2s保持→4s呼气→2s自然呼吸）和微步骤引导。当用户对任务感到焦虑或无从下手时，可以说"正念启动"——把大任务拆成4-5个微步骤，引导用户一步步进入状态。

## 专注统计
- get_pomodoro_stats 返回今日专注次数、总时长、休息次数
- 可在用户完成番茄钟后查看统计，给予正向反馈
- 连续多天专注 → 可以考虑用 reward_glow 奖励"坚持"类别萤火"#;
