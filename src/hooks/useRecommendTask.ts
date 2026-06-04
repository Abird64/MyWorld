import { useMemo } from 'react';
import { isOverdue } from '@/utils/dateFormat';
import type { Task } from '@/types/task';

interface RecommendResult {
  task: Task;
  reason: string;
}

function getHour(): number {
  return new Date().getHours();
}

function isToday(deadline: string): boolean {
  const d = new Date(deadline);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isTomorrow(deadline: string): boolean {
  const d = new Date(deadline);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}

function isWithinDays(deadline: string, days: number): boolean {
  const d = new Date(deadline).getTime();
  const limit = Date.now() + days * 86400000;
  return d <= limit;
}

function deadlineUrgency(deadline: string | null): { score: number } {
  if (!deadline) return { score: 0 };
  if (isOverdue(deadline)) return { score: 5 };
  if (isToday(deadline)) return { score: 3 };
  if (isTomorrow(deadline)) return { score: 2 };
  if (isWithinDays(deadline, 7)) return { score: 1 };
  return { score: 0 };
}

function priorityScore(priority: string | null): number {
  switch (priority) {
    case 'high': return 4;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
}

// ----- 时段定义 -----

interface TimeSlot {
  range: [number, number];
  label: string;
  matchingTags: string[];
  bonus: number;
  unmatchedPenalty: number;
}

const TIME_SLOTS: TimeSlot[] = [
  {
    range: [5, 10],
    label: '早晨',
    matchingTags: ['学习', '运动', '阅读', '工作', '写作', '编程', '设计', '刷题', '考试', '复习'],
    bonus: 3,
    unmatchedPenalty: 0,
  },
  {
    range: [10, 14],
    label: '午后',
    matchingTags: ['社交', '生活', '沟通', '会议', '购物', '买菜', '家务'],
    bonus: 2,
    unmatchedPenalty: 0,
  },
  {
    range: [14, 18],
    label: '下午',
    matchingTags: ['工作', '创作', '编程', '学习', '设计', '写作', '阅读', '项目'],
    bonus: 3,
    unmatchedPenalty: 0,
  },
  {
    range: [18, 22],
    label: '晚间',
    matchingTags: ['复盘', '阅读', '生活', '运动', '反思', '日记', '计划'],
    bonus: 2,
    unmatchedPenalty: 0,
  },
  {
    range: [22, 5],
    label: '深夜',
    matchingTags: ['反思', '阅读', '日记'],
    bonus: 1,
    unmatchedPenalty: -5,
  },
];

function getTimeSlot(): TimeSlot {
  const h = getHour();
  if (h >= 22 || h < 5) return TIME_SLOTS[4];
  for (const slot of TIME_SLOTS) {
    if (h >= slot.range[0] && h < slot.range[1]) return slot;
  }
  return TIME_SLOTS[2];
}

function timeMatchScore(task: Task, slot: TimeSlot): number {
  const tags = parseTags(task.tags);
  const hasMatch = tags.some((tag) =>
    slot.matchingTags.some((mt) => tag.includes(mt) || mt.includes(tag))
  );
  if (hasMatch) return slot.bonus;
  return slot.unmatchedPenalty;
}

// ----- 任务大小匹配（仅基于时段） -----

function sizeMatchScore(task: Task, hour: number): number {
  const mins = task.estimated_minutes || 0;
  if (mins === 0) return 0;
  const isMorning = hour >= 5 && hour < 12;
  const isNight = hour >= 21 || hour < 5;

  if (isMorning && mins >= 45) return 2;
  if (isNight && mins <= 15) return 2;
  if (isNight && mins > 45) return -2;
  return 0;
}

// ----- 理由生成（同伴语气） -----

function buildReason(
  task: Task,
  dl: { score: number },
  hour: number,
): string {
  const isMorning = hour >= 5 && hour < 12;
  const isNight = hour >= 21 || hour < 5;
  const isEvening = hour >= 18 && hour < 22;
  const isSmallTask = (task.estimated_minutes || 30) <= 15;
  const isBigTask = (task.estimated_minutes || 30) >= 45;

  // 逾期
  if (dl.score >= 5) {
    if (isMorning) return '这件事在心里放了几天，趁晨光正好，今天把它拿掉吧';
    if (isNight) return '夜深了，但这件事放了几天了。做一点是一点，不急';
    return '这件事在心里放了几天，今天拿掉它吧';
  }

  // 今日截止
  if (dl.score >= 3) {
    if (isMorning) return '早上的光正好，这件事今天该结了';
    if (isNight) return '今天该结了。不急，做一点就算完成';
    return '今天的事，趁现在还有光';
  }

  // 深夜
  if (isNight && isSmallTask) return '夜深了，挑一件轻的，做完就歇';
  if (isNight && isBigTask) return '夜深了，这件事不急。做一点是一点，剩下的留给明天';
  if (isNight) return '夜深了，不急的事留给明天。这个刚刚好';

  // 早晨
  if (isMorning && isBigTask) return '早晨头脑最亮，从这件开始吧';
  if (isMorning) return '晨光正好，从这件暖手';

  // 午后 (12-14)
  if (hour >= 12 && hour < 14) return '午后安静，适合沉下心来做这个';

  // 下午 (14-18)
  if (hour >= 14 && hour < 18) {
    return '天色还亮着，这件事值得花时间';
  }

  // 晚间 (18-22)
  if (isEvening) {
    if (isSmallTask) return '天暗下来了，挑一件轻的收尾';
    return '晚间缓一缓，这件事不急不躁';
  }

  return '或许可以从这项开始';
}

// ----- 主 hook -----

export function useRecommendTask(tasks: Task[]): {
  recommendation: RecommendResult | null;
  state: 'loading' | 'ready' | 'empty' | 'all-done';
} {
  return useMemo(() => {
    try {
      if (!Array.isArray(tasks)) {
        return { recommendation: null, state: 'empty' };
      }

      const pending = tasks.filter(
        (t) => t.status !== 'completed' && t.status !== 'cancelled'
      );

      if (pending.length === 0) {
        const hasCompletedToday = tasks.some((t) => t.status === 'completed');
        return {
          recommendation: null,
          state: hasCompletedToday ? 'all-done' : 'empty',
        };
      }

      const slot = getTimeSlot();
      const hour = getHour();

      let best: RecommendResult | null = null;
      let bestScore = -Infinity;

      for (const task of pending) {
        const timeScore = timeMatchScore(task, slot);
        const dl = deadlineUrgency(task.deadline);
        const prScore = priorityScore(task.priority);
        const sizeScore = sizeMatchScore(task, hour);

        // 基础分 1，确保每个待办任务有机会被推荐
        const score = 1 + timeScore + dl.score + prScore + sizeScore;

        if (score > bestScore) {
          bestScore = score;
          const reason = buildReason(task, dl, hour);
          best = { task, reason };
        }
      }

      if (!best) {
        return { recommendation: null, state: 'all-done' };
      }

      return { recommendation: best, state: 'ready' };
    } catch (e) {
      console.error('[useRecommendTask]', e);
      return { recommendation: null, state: 'empty' };
    }
  }, [tasks]);
}
