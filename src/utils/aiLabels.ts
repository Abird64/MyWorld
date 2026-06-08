/** 工具名 → 人类可读标签 */
export const TOOL_LABELS: Record<string, { group: string; label: string; color: string }> = {
  // 任务
  create_task:       { group: '创建', label: '创建任务', color: '#58A968' },
  complete_task:     { group: '执行', label: '完成任务', color: '#7CB342' },
  delete_task:       { group: '删除', label: '删除任务', color: '#E65C5C' },
  search_tasks:      { group: '查询', label: '查看任务', color: '#6B9BD2' },
  update_task:       { group: '修改', label: '修改任务', color: '#E8B959' },
  // 日程
  create_schedule:   { group: '创建', label: '创建日程', color: '#58A968' },
  list_schedules_in_range: { group: '查询', label: '查看日程', color: '#6B9BD2' },
  update_schedule:   { group: '修改', label: '修改日程', color: '#E8B959' },
  delete_schedule:   { group: '删除', label: '删除日程', color: '#E65C5C' },
  // 日记
  get_journal_by_date: { group: '查询', label: '读取日记', color: '#6B9BD2' },
  save_journal:      { group: '创建', label: '写入日记', color: '#58A968' },
  get_timeline:      { group: '查询', label: '日记时间线', color: '#6B9BD2' },
  settle_diary:      { group: '执行', label: '日记结算', color: '#7CB342' },
  // 人脉
  create_contact:    { group: '创建', label: '创建联系人', color: '#58A968' },
  search_contacts:   { group: '查询', label: '搜索联系人', color: '#6B9BD2' },
  list_contacts:     { group: '查询', label: '列出联系人', color: '#6B9BD2' },
  update_contact:    { group: '修改', label: '修改联系人', color: '#E8B959' },
  delete_contact:    { group: '删除', label: '删除联系人', color: '#E65C5C' },
  // 技能
  list_skills:       { group: '查询', label: '查看属性', color: '#6B9BD2' },
  get_task_skills:   { group: '查询', label: '查看任务属性', color: '#6B9BD2' },
  // 记忆
  record_memory:     { group: '创建', label: '记录记忆', color: '#58A968' },
  search_memories:   { group: '查询', label: '搜索记忆', color: '#6B9BD2' },
  delete_memory:     { group: '删除', label: '删除记忆', color: '#E65C5C' },
  // 倒数日
  list_countdowns:   { group: '查询', label: '查看倒数日', color: '#6B9BD2' },
  // 习惯
  list_habits:       { group: '查询', label: '查看习惯', color: '#6B9BD2' },
  create_habit:      { group: '创建', label: '创建习惯', color: '#58A968' },
  check_habit:       { group: '执行', label: '习惯打卡', color: '#7CB342' },
  uncheck_habit:     { group: '执行', label: '取消打卡', color: '#E65C5C' },
  // 日期/日历/引导
  resolve_date:      { group: '查询', label: '解析日期', color: '#6B9BD2' },
  search_journals:   { group: '查询', label: '搜索日记', color: '#6B9BD2' },
  list_calendars:    { group: '查询', label: '查看日历', color: '#6B9BD2' },
  get_guide:         { group: '查询', label: '获取指南', color: '#6B9BD2' },
  // 萤火
  reward_glow:       { group: '奖励', label: '萤火奖励', color: '#D4A843' },
  get_glow_balance:  { group: '查询', label: '萤火余额', color: '#6B9BD2' },
  list_wishes:       { group: '查询', label: '查看心愿', color: '#6B9BD2' },
  // 专注
  start_pomodoro:    { group: '执行', label: '开始专注', color: '#7CB342' },
  get_pomodoro_stats:{ group: '查询', label: '专注统计', color: '#6B9BD2' },
  // 心愿系统
  create_wish:       { group: '创建', label: '创建心愿', color: '#58A968' },
  update_wish:       { group: '修改', label: '修改心愿', color: '#E8B959' },
  delete_wish:       { group: '删除', label: '删除心愿', color: '#E65C5C' },
  list_draws:        { group: '查询', label: '抽奖记录', color: '#6B9BD2' },
  draw_wish:         { group: '执行', label: '抽奖', color: '#7CB342' },
  redeem_wish:       { group: '执行', label: '兑换心愿', color: '#7CB342' },
  buy_tickets:       { group: '执行', label: '购买奖券', color: '#7CB342' },
  claim_pity_wish:   { group: '执行', label: '保底自选', color: '#7CB342' },
  list_glow_ledger:  { group: '查询', label: '萤火账本', color: '#6B9BD2' },
};

/** 状态中文映射 */
export const STATUS_LABELS: Record<string, string> = {
  pending: '待办',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

/** 优先级中文映射 */
export const PRIORITY_LABELS: Record<string, string> = {
  high: '紧急',
  medium: '重要',
  low: '一般',
  none: '无',
};

export const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-white/10 text-white/50',
  none: 'bg-white/5 text-white/30',
};
