import { useEffect, useState, useCallback, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { DashboardCard } from './DashboardCard';

function getDaysRemaining(targetDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function CountdownSummary() {
  const appTheme = useAppTheme();
  const { countdowns, fetchCountdowns } = useScheduleStore();
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchCountdowns().then(() => setLoading(false)).catch(() => { setError(true); setLoading(false); });
  }, [fetchCountdowns]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => {
    return [...countdowns]
      .map((c) => ({ ...c, days: getDaysRemaining(c.start_at) }))
      .sort((a, b) => a.days - b.days);
  }, [countdowns]);

  const nearest = sorted.filter((c) => c.days >= 0).slice(0, 3);

  return (
    <DashboardCard
      title="倒数日"
      icon={Clock}
      color="#C4784A"
      onClick={() => {
        setActiveTab('schedule');
      }}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {nearest.length === 0 ? (
        <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>暂无即将到来的日子</p>
      ) : (
        <div className="space-y-1">
          {nearest.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-xs">
              <span className="truncate flex-1 mr-2" style={{ color: appTheme.ink }}>
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                  style={{ backgroundColor: c.color || '#C4784A' }}
                />
                {c.title}
              </span>
              <span
                className="font-medium tabular-nums flex-shrink-0"
                style={{ color: c.days === 0 ? '#D4A843' : appTheme.inkMuted80 }}
              >
                {c.days === 0 ? '今天' : `${c.days}天`}
              </span>
            </div>
          ))}
          {sorted.filter((c) => c.days >= 0).length > 3 && (
            <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>
              +{sorted.filter((c) => c.days >= 0).length - 3} 更多
            </p>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
