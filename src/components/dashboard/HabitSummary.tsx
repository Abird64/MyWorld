import { useEffect, useState, useCallback } from 'react';
import { Repeat } from 'lucide-react';
import { useHabitStore } from '@/stores/habitStore';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { DashboardCard } from './DashboardCard';

export function HabitSummary() {
  const appTheme = useAppTheme();
  const { habits, fetchAll } = useHabitStore();
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchAll().then(() => setLoading(false)).catch(() => { setError(true); setLoading(false); });
  }, [fetchAll]);

  useEffect(() => { load(); }, [load]);

  const activeHabits = habits.filter((h) => h.is_active === 1);
  const checked = activeHabits.filter((h) => h.checked_today);
  const maxStreak = activeHabits.length > 0 ? Math.max(...activeHabits.map((h) => h.streak)) : 0;
  const allDone = activeHabits.length > 0 && checked.length === activeHabits.length;

  return (
    <DashboardCard
      title="习惯"
      icon={Repeat}
      color="#34c759"
      onClick={() => setActiveSubPage('habits')}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <div className="flex items-end justify-between">
        <div>
          {activeHabits.length === 0 ? (
            <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>还没有习惯</span>
          ) : allDone ? (
            <span className="text-sm font-medium" style={{ color: appTheme.primary }}>全部完成</span>
          ) : (
            <>
              <span
                className="text-2xl font-bold"
                style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
              >
                {checked.length}/{activeHabits.length}
              </span>
              <span className="text-xs ml-1" style={{ color: appTheme.inkMuted48 }}>已打卡</span>
            </>
          )}
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
