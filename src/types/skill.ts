/** 技能 - 对应后端 skill_repo::Skill */
export interface Skill {
  id: string;          // 'focus', 'vitality', 'empathy', 'creativity', 'insight', 'expression'
  name: string;        // '专注力', '生命力', '共情力', '创造力', '洞察力', '表现力'
  description: string | null;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  category: string | null;
  level: number;
  total_xp: number;
  is_unlocked: number;
  created_at: string;
  updated_at: string;
}

/** 任务技能关联 - 对应后端 skill_repo::TaskSkill */
export interface TaskSkill {
  task_id: string;
  skill_id: string;
  xp_amount: number;
}

/** 设置任务XP分配的输入 */
export interface SetTaskSkillsInput {
  skill_id: string;
  xp_amount: number;
}

/** 每日活跃记录 */
export interface DayActivity {
  day: string;
  total_xp: number;
}

/** 经验来源统计 */
export interface XpSource {
  source_type: string;
  total_xp: number;
}
