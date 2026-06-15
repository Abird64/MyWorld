import { useEffect, useState, useCallback, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { getNextMilestone } from '@/utils/milestone';
import { DashboardCard } from './DashboardCard';

function getDaysRemaining(targetDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function getDaysSince(targetDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - target.getTime()) / 86400000);
}

interface DayItem {
  id: string;
  title: string;
  color: string;
  type: 'countdown' | 'anniversary';
  days: number;       // 对于倒数日=剩余天数，对于纪念日=距里程碑天数
  label: string;      // 显示文本
}

export function DaysSummary() {
  const appTheme = useAppTheme();
  const { countdowns, anniversaries, fetchCountdowns, fetchAnniversaries } = useScheduleStore();
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([fetchCountdowns(), fetchAnniversaries()])
      .then(() => setLoading(false))
      .catch(() => { setError(true); setLoading(false); });
  }, [fetchCountdowns, fetchAnniversaries]);

  useEffect(() => { load(); }, [load]);

  const nearest = useMemo(() => {
    const items: DayItem[] = [];

    // 倒数日：显示未过期的，按剩余天数排序
    for (const c of countdowns) {
      const days = getDaysRemaining(c.start_at);
      if (days >= 0) {
        items.push({
          id: c.id,
          title: c.title,
          color: c.color || '#C4784A',
          type: 'countdown',
          days,
          label: days === 0 ? '今天' : `${days}天`,
        });
      }
    }

    // 纪念日：今天 + 30天内有里程碑的
    for (const a of anniversaries) {
      const daysSince = getDaysSince(a.start_at);
      if (daysSince === 0) {
        items.push({
          id: a.id,
          title: a.title,
          color: a.color || '#C4784A',
          type: 'anniversary',
          days: 0,
          label: '今天',
        });
        continue;
      }
      const next = getNextMilestone(daysSince);
      if (next && next.remaining <= 30) {
        items.push({
          id: a.id,
          title: a.title,
          color: a.color || '#C4784A',
          type: 'anniversary',
          days: next.remaining,
          label: `即将${next.milestone}天`,
        });
      }
    }

    // 按 days 升序，取前 3
    return items.sort((a, b) => a.days - b.days).slice(0, 3);
  }, [countdowns, anniversaries]);

  return (
    <DashboardCard
      title="日子"
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
          {nearest.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-xs">
              <span className="truncate flex-1 mr-2" style={{ color: appTheme.ink }}>
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                  style={{ backgroundColor: item.color }}
                />
                {item.title}
                {item.type === 'anniversary' && (
                  <span
                    className="inline-block ml-1 px-1 py-px rounded text-[10px]"
                    style={{
                      backgroundColor: `${item.color}20`,
                      color: item.color,
                    }}
                  >
                    纪念
                  </span>
                )}
              </span>
              <span
                className="font-medium tabular-nums flex-shrink-0"
                style={{ color: item.days === 0 ? '#D4A843' : appTheme.inkMuted80 }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

/** 旧名导出，向后兼容 */
export { DaysSummary as CountdownSummary };
