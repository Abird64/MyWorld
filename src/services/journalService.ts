/**
 * 日记服务 - 封装所有日记相关的 Tauri 命令调用
 */
import { tauriInvoke } from './tauri';
import type { Journal, JournalEntry, AiDiary, ExtractedContact } from '@/types/journal';
import type { CompleteResult } from '@/types/task';

/** 获取或创建指定日期的日记 */
export async function getJournalByDate(date: string): Promise<JournalEntry> {
  return tauriInvoke<JournalEntry>('get_journal_by_date', {
    input: { date },
  });
}

/** 保存日记内容（自动写 .md + 更新元数据） */
export async function saveJournal(
  date: string,
  content: string,
  mood?: string
): Promise<Journal> {
  return tauriInvoke<Journal>('save_journal', {
    input: { date, content, mood: mood ?? null },
  });
}

/** 获取某月有日记的日期列表 */
export async function getTimeline(
  year: number,
  month: number
): Promise<string[]> {
  return tauriInvoke<string[]>('get_timeline', {
    input: { year, month },
  });
}

/** 获取 AI 日记 */
export async function getAiDiary(date: string): Promise<AiDiary> {
  return tauriInvoke<AiDiary>('get_ai_diary', {
    input: { date },
  });
}

/** 保存 AI 日记 */
export async function saveAiDiary(
  date: string,
  content: string
): Promise<void> {
  return tauriInvoke<void>('save_ai_diary', {
    input: { date, content },
  });
}

/** 日记 XP 结算 */
export async function completeDiary(date: string): Promise<CompleteResult> {
  return tauriInvoke<CompleteResult>('complete_diary', {
    input: { date },
  });
}

/** 日省反思结果 */
export interface DailyReflectionResult {
  reflection: string;
  xp_result: CompleteResult;
  contacts: ExtractedContact[];
  mood: string | null;
  tags: string | null;
}

/** 日省：AI 综合日记+任务+日程生成反思并结算 XP */
export async function dailyReflection(date: string): Promise<DailyReflectionResult> {
  return tauriInvoke<DailyReflectionResult>('daily_reflection', {
    input: { date },
  });
}
