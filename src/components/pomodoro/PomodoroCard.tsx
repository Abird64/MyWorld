import { useEffect } from 'react';
import { Timer } from 'lucide-react';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { FOCUS_COLOR } from '@/styles/theme';
import { DashboardCard } from '@/components/dashboard/DashboardCard';

export function PomodoroCard() {
  const appTheme = useAppTheme();
  const { stats, fetchStats } = usePomodoroStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const focusMinutes = Math.round(stats.focus_seconds / 60);

  return (
    <DashboardCard
      title="番茄钟"
      icon={Timer}
      color={FOCUS_COLOR}
      onClick={() => window.dispatchEvent(new CustomEvent('pomodoro-open-timer'))}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1">
          <span
            className="text-2xl font-semibold"
            style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
          >
            {stats.focus_count}
          </span>
          <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>个番茄</span>
        </div>
        {focusMinutes > 0 && (
          <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
            专注 {focusMinutes} 分钟
          </span>
        )}
        {stats.focus_count === 0 && (
          <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
            今天还没有开始
          </span>
        )}
      </div>
    </DashboardCard>
  );
}
