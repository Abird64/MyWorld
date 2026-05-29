import type { Schedule } from '@/types/schedule';

// ========== 夜间压缩配置 ==========

export const HOUR_START = 0;
export const HOUR_END = 24;
export const NIGHT_END = 7;       // 0-7 点为夜间压缩区
export const NIGHT_RATIO = 0.1;   // 夜间占 10%
export const DAY_RATIO = 0.9;     // 白天占 90%

/** 将小时转换为显示位置的百分比（考虑夜间压缩） */
export function hourToPercent(hour: number): number {
  if (hour <= NIGHT_END) {
    return (hour / NIGHT_END) * NIGHT_RATIO * 100;
  }
  const dayProgress = (hour - NIGHT_END) / (HOUR_END - NIGHT_END);
  return (NIGHT_RATIO + dayProgress * DAY_RATIO) * 100;
}

/** 将显示位置百分比转换回小时（考虑夜间压缩） */
export function percentToHour(ratio: number): number {
  if (ratio <= NIGHT_RATIO) {
    return (ratio / NIGHT_RATIO) * NIGHT_END;
  }
  const dayProgress = (ratio - NIGHT_RATIO) / DAY_RATIO;
  return NIGHT_END + dayProgress * (HOUR_END - NIGHT_END);
}

/** 吸附到 30 分钟刻度 */
export function snapToGrid(hour: number): number {
  return Math.round(hour * 2) / 2;
}

/** 补零 */
export function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// ========== 事件重叠检测与分栏 ==========

export interface EventLayout {
  event: Schedule;
  col: number;
  totalCols: number;
}

/**
 * 对一天内的事件做重叠检测，用贪心分栏算法分配列。
 * task_sync 事件不参与分栏，单独返回其与普通日程的重叠关系。
 * 无 end_at 的事件默认视为 1 小时时长。
 * 输入的事件应已过滤为同一天。
 */
export function layoutOverlappingEvents(events: Schedule[]): {
  layouts: EventLayout[];
  taskSyncOverlap: Map<string, Schedule[]>;
} {
  if (events.length === 0) return { layouts: [], taskSyncOverlap: new Map() };

  const regular: Schedule[] = [];
  const taskSync: Schedule[] = [];

  for (const evt of events) {
    if (evt.source_type === 'task_sync') {
      taskSync.push(evt);
    } else {
      regular.push(evt);
    }
  }

  // 普通日程分栏
  const sorted = [...regular].sort((a, b) => a.start_at.localeCompare(b.start_at));
  const columns: { endTime: string }[] = [];
  const placements: { event: Schedule; col: number }[] = [];

  for (const evt of sorted) {
    const evtEnd = evt.end_at || evt.start_at;
    let placedCol = -1;

    for (let c = 0; c < columns.length; c++) {
      if (evt.start_at >= columns[c].endTime) {
        placedCol = c;
        break;
      }
    }

    if (placedCol === -1) {
      placedCol = columns.length;
      columns.push({ endTime: evtEnd });
    } else {
      columns[placedCol].endTime = evtEnd;
    }

    placements.push({ event: evt, col: placedCol });
  }

  const totalCols = columns.length;
  const layouts = placements.map(({ event, col }) => ({ event, col, totalCols }));

  // 检测 task_sync 事件与普通日程的重叠
  const taskSyncOverlap = new Map<string, Schedule[]>();
  for (const task of taskSync) {
    const taskEnd = task.end_at || task.start_at;
    for (const { event: reg } of layouts) {
      const regEnd = reg.end_at || reg.start_at;
      if (task.start_at < regEnd && taskEnd > reg.start_at) {
        const existing = taskSyncOverlap.get(reg.id) || [];
        existing.push(task);
        taskSyncOverlap.set(reg.id, existing);
      }
    }
  }

  return { layouts, taskSyncOverlap };
}
