import { useEffect, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { DashboardCard } from './DashboardCard';

export function ScheduleSummary() {
  const appTheme = useAppTheme();
  const { schedules, countdowns, fetchSchedules, fetchCountdowns } = useScheduleStore();
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  useEffect(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
    fetchSchedules(start, end);
    fetchCountdowns();
  }, []);

  const nearestCountdown = useMemo(() => {
    const now = new Date();
    const upcoming = countdowns
      .filter((c) => new Date(c.start_at) >= now)
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
    return upcoming[0] || null;
  }, [countdowns]);

  const daysLeft = useMemo(() => {
    if (!nearestCountdown) return null;
    const diff = new Date(nearestCountdown.start_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [nearestCountdown]);

  return (
    <DashboardCard
      title="日历"
      icon={Calendar}
      color="#ff9500"
      onClick={() => setActiveTab('schedule')}
    >
      <div className="space-y-1">
        <div className="flex items-end gap-1">
          <span
            className="text-2xl font-bold"
            style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
          >
            {schedules.length}
          </span>
          <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>今日日程</span>
        </div>
        {nearestCountdown && (
          <p className="text-xs truncate" style={{ color: appTheme.inkMuted48 }}>
            {nearestCountdown.title} · 还有 {daysLeft} 天
          </p>
        )}
      </div>
    </DashboardCard>
  );
}
