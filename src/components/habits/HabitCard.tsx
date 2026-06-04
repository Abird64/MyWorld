import { useState } from 'react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { BarChart3, Pencil } from 'lucide-react';
import type { HabitWithStreak, WeekMatrix } from '@/types/habit';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

interface HabitCardProps {
  habit: HabitWithStreak;
  weekMatrix?: WeekMatrix;
  onToggle: (habitId: string, checked: boolean) => void;
  onEdit: (habit: HabitWithStreak) => void;
  onViewDetail?: (habit: HabitWithStreak) => void;
  loading?: boolean;
}

export function HabitCard({ habit, weekMatrix, onToggle, onEdit, onViewDetail, loading }: HabitCardProps) {
  const appTheme = useAppTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  const accentColor = habit.color || appTheme.primary;

  // 本周的打卡状态（周一=0 ... 周日=6）
  const today = new Date();
  const weekday = (today.getDay() + 6) % 7; // convert Sun=6, Mon=0
  const checkedDays = new Set(weekMatrix?.checked_days ?? []);

  const handleToggle = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    onToggle(habit.id, habit.checked_today);
  };

  return (
    <button
      onClick={handleToggle}
      onContextMenu={(e) => { e.preventDefault(); onEdit(habit); }}
      className={`rounded-[18px] p-5 text-left transition-all w-full ${loading ? 'animate-pulse' : ''}`}
      style={{
        backgroundColor: habit.checked_today
          ? withAlpha(accentColor, 0.06)
          : appTheme.canvas,
        border: `0.5px solid ${habit.checked_today ? withAlpha(accentColor, 0.15) : appTheme.hairline}`,
        transform: isAnimating ? 'scale(0.95)' : 'scale(1)',
        opacity: isAnimating && habit.checked_today ? 0.7 : 1,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{habit.icon || '✨'}</span>
        <span className="text-sm font-medium flex-1" style={{ color: appTheme.ink }}>{habit.name}</span>
        {/* 编辑按钮 */}
        <div
          role="button"
          onClick={(e) => { e.stopPropagation(); onEdit(habit); }}
          className="p-1 rounded-full transition-colors"
          style={{ color: `${withAlpha(appTheme.ink, 0.35)}` }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = withAlpha(appTheme.ink, 0.06); e.currentTarget.style.color = accentColor; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = `${withAlpha(appTheme.ink, 0.35)}`; }}
          title="编辑习惯"
        >
          <Pencil size={13} />
        </div>
        {onViewDetail && (
          <div
            role="button"
            onClick={(e) => { e.stopPropagation(); onViewDetail(habit); }}
            className="p-1 rounded-full transition-colors"
            style={{ color: `${withAlpha(appTheme.ink, 0.35)}` }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = withAlpha(appTheme.ink, 0.06); e.currentTarget.style.color = accentColor; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = `${withAlpha(appTheme.ink, 0.35)}`; }}
            title="查看热力图"
          >
            <BarChart3 size={14} />
          </div>
        )}
        <div
          className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
          style={{
            borderColor: accentColor,
            backgroundColor: habit.checked_today ? accentColor : 'transparent',
          }}
        >
          {habit.checked_today && (
            <span className="text-white text-xs">✓</span>
          )}
        </div>
      </div>

      {/* 本周圆点 */}
      <div className="flex gap-1.5 mb-2">
        {WEEKDAYS.map((label, i) => {
          // 计算这一天的日期
          const dayOffset = i - weekday;
          const d = new Date(today);
          d.setDate(d.getDate() + dayOffset);
          const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
          const isChecked = checkedDays.has(dateStr);
          const isToday = i === weekday;

          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: isChecked ? accentColor : `${withAlpha(accentColor, 0.13)}`,
                  outline: isToday ? `1.5px solid ${accentColor}` : 'none',
                  outlineOffset: 1,
                }}
              />
              <span className="text-[10px]" style={{ color: `${withAlpha(appTheme.ink, 0.4)}` }}>{label}</span>
            </div>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.53)}` }}>
        已经坚持 {habit.streak} 天
      </p>
    </button>
  );
}
