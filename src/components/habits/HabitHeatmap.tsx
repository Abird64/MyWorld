import { useState, useEffect } from 'react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { X } from 'lucide-react';
import { getRecords } from '@/services/habitService';
import type { HabitWithStreak, HabitRecord } from '@/types/habit';

interface HabitHeatmapProps {
  habit: HabitWithStreak;
  onClose: () => void;
}

/** GitHub 风格热力图 */
export function HabitHeatmap({ habit, onClose }: HabitHeatmapProps) {
  const appTheme = useAppTheme();
  const [records, setRecords] = useState<HabitRecord[]>([]);
  const color = habit.color || appTheme.primary;

  useEffect(() => {
    // 获取过去一年的记录
    const end = new Date();
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    const startStr = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}-${start.getDate().toString().padStart(2, '0')}`;
    const endStr = `${end.getFullYear()}-${(end.getMonth() + 1).toString().padStart(2, '0')}-${end.getDate().toString().padStart(2, '0')}`;

    getRecords(habit.id, startStr, endStr).then(setRecords);
  }, [habit.id]);

  // 构建日期到打卡的映射
  const checkedSet = new Set(records.map((r) => r.checked_at));
  const totalChecked = records.length;

  // 计算最长连续天数
  const sortedDates = [...records].sort((a, b) => a.checked_at.localeCompare(b.checked_at));
  let maxStreak = 0;
  let currentMaxStreak = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      currentMaxStreak = 1;
    } else {
      const prev = new Date(sortedDates[i - 1].checked_at);
      const curr = new Date(sortedDates[i].checked_at);
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      currentMaxStreak = diff === 1 ? currentMaxStreak + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, currentMaxStreak);
  }

  // 生成热力图格子（过去 52 周 × 7 天）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayWeekday = (today.getDay() + 6) % 7; // Mon=0

  // 从今天往回数到上一个周日
  const gridStart = new Date(today);
  gridStart.setDate(gridStart.getDate() - todayWeekday - 6 - (51 * 7)); // 52 周

  const weeks: { date: Date; checked: boolean }[][] = [];
  let currentDate = new Date(gridStart);

  for (let w = 0; w < 53; w++) {
    const week: { date: Date; checked: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
      week.push({
        date: new Date(currentDate),
        checked: checkedSet.has(dateStr) && currentDate <= today,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    weeks.push(week);
  }

  // 月份标签
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const m = week[0].date.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({
        label: `${m + 1}月`,
        col: i,
      });
      lastMonth = m;
    }
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-[680px] rounded-2xl p-6 space-y-4"
        style={{ backgroundColor: appTheme.canvas }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{habit.icon || '✨'}</span>
            <h3 className="text-lg font-medium" style={{ color: appTheme.ink }}>{habit.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full" style={{ color: `${withAlpha(appTheme.ink, 0.53)}` }}>
            <X size={20} />
          </button>
        </div>

        {/* 统计数据 */}
        <div className="flex gap-6">
          <div>
            <p className="text-2xl font-bold" style={{ color }}>{totalChecked}</p>
            <p className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.4)}` }}>总打卡天数</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color }}>{maxStreak}</p>
            <p className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.4)}` }}>最长连续</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color }}>{habit.streak}</p>
            <p className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.4)}` }}>当前连续</p>
          </div>
        </div>

        {/* 热力图 */}
        <div className="overflow-x-auto">
          <div className="inline-block">
            {/* 月份标签 */}
            <div className="flex ml-8 mb-1">
              {monthLabels.map((m, i) => (
                <span
                  key={i}
                  className="text-[10px]"
                  style={{
                    color: `${withAlpha(appTheme.ink, 0.4)}`,
                    position: 'absolute',
                    marginLeft: `${m.col * 14}px`,
                  }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            <div className="flex gap-0.5">
              {/* 星期标签 */}
              <div className="flex flex-col gap-0.5 mr-1">
                {['', '一', '', '三', '', '五', ''].map((label, i) => (
                  <div key={i} className="w-3 h-3 flex items-center">
                    <span className="text-[8px]" style={{ color: `${withAlpha(appTheme.ink, 0.27)}` }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* 格子 */}
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((cell, di) => (
                    <div
                      key={di}
                      className="w-3 h-3 rounded-[2px]"
                      style={{
                        backgroundColor: cell.checked ? color : `${withAlpha(color, 0.08)}`,
                      }}
                      title={cell.checked ? cell.date.toLocaleDateString() : undefined}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
