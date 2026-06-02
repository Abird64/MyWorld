import { useEffect, useState } from 'react';
import { Cake } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { listUpcomingBirthdays, type BirthdayInfo } from '@/services/contactService';
import { DashboardCard } from './DashboardCard';

export function BirthdaySummary() {
  const appTheme = useAppTheme();
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);
  const [birthdays, setBirthdays] = useState<BirthdayInfo[]>([]);

  useEffect(() => {
    listUpcomingBirthdays(30).then(setBirthdays).catch(() => {});
  }, []);

  const upcoming = birthdays
    .slice()
    .sort((a, b) => a.days_remaining - b.days_remaining);

  return (
    <DashboardCard
      title="生日"
      icon={Cake}
      color="#ff2d55"
      onClick={() => setActiveSubPage('relations')}
    >
      {upcoming.length === 0 ? (
        <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>近 30 天无生日</p>
      ) : (
        <div className="space-y-1">
          {upcoming.slice(0, 3).map((b) => (
            <div key={b.contact_id} className="flex items-center justify-between text-xs">
              <span style={{ color: appTheme.ink }}>{b.name}</span>
              <span style={{ color: appTheme.inkMuted48 }}>
                {b.days_remaining === 0 ? '今天' : `${b.days_remaining}天后`}
                {b.upcoming_age ? ` · ${b.upcoming_age}岁` : ''}
              </span>
            </div>
          ))}
          {upcoming.length > 3 && (
            <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>+{upcoming.length - 3} 更多</p>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
