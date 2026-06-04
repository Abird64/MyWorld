import { useEffect, useState, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { DashboardCard } from './DashboardCard';

export function ScheduleSummary() {
  const appTheme = useAppTheme();
  const { schedules, fetchSchedules } = useScheduleStore();
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
    setLoading(true);
    setError(false);
    fetchSchedules(start, end).then(() => setLoading(false)).catch(() => { setError(true); setLoading(false); });
  }, [fetchSchedules]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardCard
      title="日历"
      icon={Calendar}
      color="#E8873A"
      onClick={() => setActiveTab('schedule')}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <div className="flex items-end gap-1">
        <span
          className="text-2xl font-bold"
          style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
        >
          {schedules.length}
        </span>
        <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>今日日程</span>
      </div>
    </DashboardCard>
  );
}
