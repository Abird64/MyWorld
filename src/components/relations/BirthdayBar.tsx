import { useState, useEffect } from 'react';
import { useAppTheme } from '@/stores/themeStore';
import { listUpcomingBirthdays, type BirthdayInfo } from '@/services/contactService';

/** 根据名字生成柔和色 */
function nameColor(name: string): string {
  const colors = ['#ff6b6b', '#51cf66', '#339af0', '#cc5de8', '#ff922b', '#20c997', '#f06595', '#845ef7', '#228be6', '#fab005'];
  let hash = 0;
  for (const ch of name) hash = ((hash << 5) - hash) + ch.charCodeAt(0);
  return colors[Math.abs(hash) % colors.length];
}

export function BirthdayBar() {
  const appTheme = useAppTheme();
  const [birthdays, setBirthdays] = useState<BirthdayInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listUpcomingBirthdays(60)
      .then(setBirthdays)
      .finally(() => setLoading(false));
  }, []);

  if (loading || birthdays.length === 0) return null;

  const now = new Date();
  const thisMonth = birthdays.filter(b =>
    b.upcoming_month === now.getMonth() + 1 && b.days_remaining >= 0
  );
  const nextMonth = birthdays.filter(b => {
    const next = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
    return b.upcoming_month === next;
  });

  const display = thisMonth.length > 0 ? thisMonth : nextMonth.slice(0, 5);
  if (display.length === 0) return null;

  const monthLabel = display === thisMonth ? '即将到来' : '下月生日';

  return (
    <div className="w-full max-w-[1000px]">
      <p className="text-xs font-medium mb-2 px-1" style={{ color: appTheme.inkMuted48 }}>
        {monthLabel}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {display.map((b) => (
          <div
            key={b.contact_id}
            className="flex-shrink-0 w-[100px] rounded-2xl p-3 text-center transition-colors cursor-pointer"
            style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}
          >
            {/* 首字头像 */}
            <div
              className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-semibold text-white"
              style={{ backgroundColor: nameColor(b.name) }}
            >
              {b.name.charAt(0)}
            </div>
            <p className="text-xs font-medium truncate" style={{ color: appTheme.ink }}>{b.name}</p>
            <p className="text-xs mt-0.5" style={{ color: appTheme.inkMuted48 }}>
              {b.days_remaining === 0 ? '今天' : `${b.days_remaining}天后`}
            </p>
            {b.upcoming_age && (
              <span
                className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium mt-1 text-white"
                style={{ backgroundColor: appTheme.warning }}
              >
                {b.upcoming_age}岁
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
