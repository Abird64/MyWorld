import { useState, useEffect } from 'react';
import { usePageTheme } from '@/hooks/usePageTheme';
import { listUpcomingBirthdays, type BirthdayInfo } from '@/services/contactService';

function formatDate(month: number, day: number): string {
  return `${month}/${day.toString().padStart(2, '0')}`;
}

export function BirthdayBar() {
  const t = usePageTheme('relations');
  const [birthdays, setBirthdays] = useState<BirthdayInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listUpcomingBirthdays(60)
      .then(setBirthdays)
      .finally(() => setLoading(false));
  }, []);

  if (loading || birthdays.length === 0) return null;

  // 按即将到来的公历月份分组显示
  const thisMonth = birthdays.filter(b => {
    const now = new Date();
    return b.upcoming_month === now.getMonth() + 1 && b.days_remaining >= 0;
  });
  const nextMonth = birthdays.filter(b => {
    const now = new Date();
    const next = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
    return b.upcoming_month === next;
  });

  const display = thisMonth.length > 0 ? thisMonth : nextMonth.slice(0, 5);
  if (display.length === 0) return null;

  const monthLabel = display === thisMonth ? '本月生日' : '下月生日';

  return (
    <div className="w-full max-w-[1000px] rounded-2xl p-4 mb-2" style={{ backgroundColor: `${t.accent}12` }}>
      <p className="text-xs font-medium mb-3" style={{ color: `${t.cardText}99` }}>
        {monthLabel}
      </p>
      <div className="flex gap-3 overflow-x-auto">
        {display.map((b) => (
          <div
            key={b.contact_id}
            className="flex-shrink-0 rounded-xl px-4 py-3 text-center min-w-[90px]"
            style={{ backgroundColor: t.card }}
          >
            <p className="text-sm font-medium truncate" style={{ color: t.cardText }}>{b.name}</p>
            <p className="text-xs mt-1" style={{ color: `${t.cardText}88` }}>
              {formatDate(b.upcoming_month, b.upcoming_day)}
              {b.birthday_calendar === 'lunar' && (
                <span className="ml-1 opacity-60">农历{b.birthday_month}/{b.birthday_day}</span>
              )}
            </p>
            {b.upcoming_age && (
              <p className="text-xs" style={{ color: `${t.cardText}66` }}>{b.upcoming_age}岁</p>
            )}
            {b.days_remaining === 0 ? (
              <p className="text-xs font-medium mt-1" style={{ color: '#D4A843' }}>今天</p>
            ) : (
              <p className="text-xs mt-1" style={{ color: `${t.cardText}66` }}>{b.days_remaining}天后</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
