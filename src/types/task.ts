/** 任务 - 对应后端 task_repo::Task */
export interface Task {
  id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low' | 'none' | null;
  scheduled_at: string | null;
  deadline: string | null;
  completed_at: string | null;
  xp_earned: number;
  estimated_minutes: number;
  notes: string | null;
  tags: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 创建任务的输入参数 */
export interface CreateTaskInput {
  title: string;
  parent_id?: string;
  description?: string;
  priority?: string;
  scheduled_at?: string;
  deadline?: string;
  estimated_minutes?: number;
  tags?: string;
  glow_reward?: number;
}

/** 更新任务的输入参数 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  scheduled_at?: string;
  deadline?: string;
  estimated_minutes?: number;
  notes?: string;
  tags?: string;
}

/** 列出任务的筛选参数 */
export interface ListTasksInput {
  status?: string;
  parent_id?: string;
}

/** 完成任务的结果 */
export interface CompleteResult {
  xp_earned: number;
  glow_earned: number;
  skill_xps: SkillXp[];
}

/** 技能XP信息 */
export interface SkillXp {
  skill_id: string;
  skill_name: string;
  xp: number;
}
