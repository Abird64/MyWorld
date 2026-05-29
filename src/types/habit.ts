/** 习惯 - 对应后端 habit_repo::Habit */
export interface Habit {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  frequency_type: 'daily' | 'weekly' | 'custom';
  frequency_value: string | null;
  target_minutes: number | null;
  skill_id: string | null;
  xp_per_check: number;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 打卡记录 */
export interface HabitRecord {
  id: string;
  habit_id: string;
  checked_at: string;
  note: string | null;
  created_at: string;
}

/** 习惯 + streak 信息 */
export interface HabitWithStreak extends Habit {
  streak: number;
  checked_today: boolean;
}

/** 本周打卡矩阵 */
export interface WeekMatrix {
  habit_id: string;
  checked_days: string[];
}

export interface CreateHabitInput {
  name: string;
  icon?: string;
  color?: string;
  frequency_type?: string;
  frequency_value?: string;
  target_minutes?: number;
  skill_id?: string;
  xp_per_check?: number;
}

export interface UpdateHabitInput {
  name?: string;
  icon?: string;
  color?: string;
  frequency_type?: string;
  frequency_value?: string;
  target_minutes?: number;
  skill_id?: string;
  xp_per_check?: number;
}
