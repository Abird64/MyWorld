import { useEffect } from 'react';
import { Repeat } from 'lucide-react';
import { useHabitStore } from '@/stores/habitStore';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { DashboardCard } from './DashboardCard';

export function HabitSummary() {
  const appTheme = useAppTheme();
  const { habits, fetchAll } = useHabitStore();
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);

  useEffect(() => {
    fetchAll();
  }, []);

  const activeHabits = habits.filter((h) => h.is_active === 1);
  const unchecked = activeHabits.filter((h) => !h.checked_today);
  const maxStreak = activeHabits.length > 0 ? Math.max(...activeHabits.map((h) => h.streak)) : 0;

  return (
    <DashboardCard
      title="习惯"
      icon={Repeat}
      color="#34c759"
      onClick={() => setActiveSubPage('habits')}
    >
      <div className="flex items-end justify-between">
        <div>
          <span
            className="text-2xl font-bold"
            style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
          >
            {unchecked.length}
          </span>
          <span className="text-xs ml-1" style={{ color: appTheme.inkMuted48 }}>待打卡</span>
        </div>
        {maxStreak > 0 && (
          <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
            最长连续 {maxStreak} 天
          </span>
        )}
      </div>
    </DashboardCard>
  );
}
