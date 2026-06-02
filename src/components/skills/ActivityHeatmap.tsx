import { useMemo } from 'react';
import { useAppTheme } from '@/stores/themeStore';
import type { DayActivity } from '@/types/skill';

interface ActivityHeatmapProps {
  activity: DayActivity[];
}

function getActivityLevel(xp: number): number {
  if (xp <= 0) return 0;
  if (xp <= 30) return 1;
  if (xp <= 80) return 2;
  if (xp <= 150) return 3;
  return 4;
}

export function ActivityHeatmap({ activity }: ActivityHeatmapProps) {
  const appTheme = useAppTheme();

  const { cells } = useMemo(() => {
    // Build a map of day -> xp
    const dayMap = new Map<string, number>();
    for (const a of activity) {
      dayMap.set(a.day, a.total_xp);
    }

    // Generate 12 weeks (84 days) ending today
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 83); // 84 days total

    // Adjust to start on Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const result: { level: number; day: string }[] = [];
    const d = new Date(startDate);
    while (d <= endDate) {
      const dateStr = d.toISOString().slice(0, 10);
      const xp = dayMap.get(dateStr) || 0;
      result.push({ level: getActivityLevel(xp), day: dateStr });
      d.setDate(d.getDate() + 1);
    }

    // Pad to complete the last week
    while (result.length % 7 !== 0) {
      result.push({ level: 0, day: '' });
    }

    // Build week labels (month names)
    const weeks: (string | null)[] = [];
    for (let i = 0; i < result.length; i += 7) {
      const weekStart = result[i];
      if (weekStart.day) {
        const date = new Date(weekStart.day + 'T00:00:00');
        if (date.getDate() <= 7) {
          weeks.push(`${date.getMonth() + 1}月`);
        } else {
          weeks.push(null);
        }
      } else {
        weeks.push(null);
      }
    }

    return { cells: result, weekLabels: weeks };
  }, [activity]);

  const cellColors = [
    appTheme.canvasParchment,
    '#d4e8fc',
    '#99cbf8',
    '#5aaef0',
    '#0071e3',
  ];

  return (
    <div>
      <div className="flex gap-0.5">
        {/* Week columns */}
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-0.5">
            {cells.slice(weekIdx * 7, weekIdx * 7 + 7).map((cell, dayIdx) => (
              <div
                key={dayIdx}
                className="w-3 h-3 rounded-sm transition-colors"
                style={{ backgroundColor: cellColors[cell.level] }}
                title={cell.day ? `${cell.day}: ${cell.level > 0 ? '活跃' : '无活动'}` : ''}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 justify-end mt-2">
        <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>少</span>
        {cellColors.map((c, i) => (
          <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>多</span>
      </div>
    </div>
  );
}
