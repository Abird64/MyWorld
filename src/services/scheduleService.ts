/**
 * 日程服务 - 封装所有日程相关的 Tauri 命令调用
 */
import { tauriInvoke } from './tauri';
import type {
  Schedule,
  CreateScheduleInput,
  UpdateScheduleInput,
  ListSchedulesInput,
} from '@/types/schedule';

/** 创建日程 */
export async function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
  return tauriInvoke<Schedule>('create_schedule', { input });
}

/** 获取单个日程 */
export async function getSchedule(id: string): Promise<Schedule> {
  return tauriInvoke<Schedule>('get_schedule', { id });
}

/** 按时间范围查询日程 */
export async function listSchedulesInRange(input: ListSchedulesInput): Promise<Schedule[]> {
  return tauriInvoke<Schedule[]>('list_schedules_in_range', { input });
}

/** 更新日程 */
export async function updateSchedule(
  id: string,
  input: UpdateScheduleInput
): Promise<Schedule> {
  return tauriInvoke<Schedule>('update_schedule', { id, input });
}

/** 删除日程 */
export async function deleteSchedule(id: string): Promise<{ success: boolean; deleted: number }> {
  return tauriInvoke('delete_schedule', { input: { id } });
}

/** 给重复事件添加排除日期 */
export async function addExdate(id: string, date: string): Promise<Schedule> {
  return tauriInvoke<Schedule>('add_exdate', { input: { id, date } });
}

/** 批量导入 .ics 事件 */
export async function importIcsEvents(
  events: Array<{
    uid: string;
    title: string;
    description?: string;
    start_at: string;
    end_at?: string;
    rrule?: string;
    location?: string;
    category?: string;
    exdates?: string;
  }>,
  calendarId?: string,
): Promise<{ success: boolean; imported: number; skipped: number; total: number }> {
  return tauriInvoke('import_ics_events', {
    input: { events, calendar_id: calendarId ?? null },
  });
}

/** 导出日程为 ICS 文本，可选按日历筛选 */
export async function exportIcsEvents(calendarId?: string): Promise<string> {
  return tauriInvoke<string>('export_ics_events', { calendar_id: calendarId ?? null });
}

/** 查询所有倒数日 */
export async function listCountdowns(): Promise<Schedule[]> {
  return tauriInvoke<Schedule[]>('list_countdowns');
}
