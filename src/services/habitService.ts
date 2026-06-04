/**
 * 习惯服务 - 封装所有习惯相关的 Tauri 命令调用
 */
import { tauriInvoke } from './tauri';
import type {
  Habit,
  HabitRecord,
  HabitWithStreak,
  WeekMatrix,
  CreateHabitInput,
  UpdateHabitInput,
} from '@/types/habit';

/** 创建习惯 */
export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  return tauriInvoke<Habit>('create_habit', { input });
}

/** 更新习惯 */
export async function updateHabit(id: string, input: UpdateHabitInput): Promise<Habit> {
  return tauriInvoke<Habit>('update_habit', { id, input });
}

/** 删除习惯 */
export async function deleteHabit(id: string): Promise<{ success: boolean; deleted: number }> {
  return tauriInvoke('delete_habit', { input: { id } });
}

/** 列出所有习惯 */
export async function listHabits(): Promise<Habit[]> {
  return tauriInvoke<Habit[]>('list_habits');
}

/** 打卡（返回 XP / 萤火 / 技能奖励） */
export async function checkHabit(habitId: string, date?: string, note?: string): Promise<{ xp_earned: number; glow_earned: number; skill_xps: { skill_id: string; skill_name: string; xp: number }[] }> {
  return tauriInvoke('check_habit', { input: { habit_id: habitId, date, note } });
}

/** 取消打卡 */
export async function uncheckHabit(habitId: string, date?: string): Promise<{ success: boolean; deleted: number }> {
  return tauriInvoke('uncheck_habit', { input: { habit_id: habitId, date } });
}

/** 获取打卡记录 */
export async function getRecords(habitId: string, startDate?: string, endDate?: string): Promise<HabitRecord[]> {
  return tauriInvoke<HabitRecord[]>('get_records', { input: { habit_id: habitId, start_date: startDate, end_date: endDate } });
}

/** 获取连续天数 */
export async function getStreak(habitId: string): Promise<number> {
  return tauriInvoke<number>('get_streak', { habit_id: habitId });
}

/** 批量获取 streak */
export async function getAllStreaks(): Promise<HabitWithStreak[]> {
  return tauriInvoke<HabitWithStreak[]>('get_all_streaks');
}

/** 获取本周打卡矩阵 */
export async function getWeekMatrix(): Promise<WeekMatrix[]> {
  return tauriInvoke<WeekMatrix[]>('get_week_matrix');
}
