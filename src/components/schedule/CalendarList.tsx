import { useRef, useEffect } from 'react';
import { useCalendarStore } from '@/stores/calendarStore';
import { useAppTheme } from '@/stores/themeStore';
import { Settings } from 'lucide-react';

interface CalendarListProps {
  onRefresh?: () => void;
  onManage?: () => void;
}

export function CalendarList({ onRefresh, onManage }: CalendarListProps) {
  const appTheme = useAppTheme();
  const { calendars, visibleCalendarIds, toggleCalendar } = useCalendarStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const allVisible = calendars.length > 0 && calendars.every((c) => visibleCalendarIds.has(c.id));

  const handleToggleAll = () => {
    const store = useCalendarStore.getState();
    store.setAllVisible(!allVisible);
  };

  // 鼠标滚轮横向滚动
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <>
      <style>{`.calendar-list-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div ref={scrollRef} className="calendar-list-scroll" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', flexWrap: 'nowrap', scrollbarWidth: 'none' }}>
      {/* 全部开关 */}
      <button
        onClick={handleToggleAll}
        className="px-3 py-1.5 rounded-full text-sm font-light tracking-wider transition-all whitespace-nowrap flex-shrink-0"
        style={{
          backgroundColor: allVisible ? `${appTheme.primary}1A` : `${appTheme.ink}0D`,
          color: allVisible ? appTheme.primary : appTheme.inkMuted48,
          border: `1px solid ${allVisible ? `${appTheme.primary}33` : `${appTheme.ink}14`}`,
        }}
      >
        全部
      </button>

      {/* 各日历勾选 */}
      {calendars.map((cal) => {
        const isVisible = visibleCalendarIds.has(cal.id);
        return (
          <button
            key={cal.id}
            onClick={() => {
              toggleCalendar(cal.id);
              onRefresh?.();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-light tracking-wider transition-all whitespace-nowrap flex-shrink-0"
            style={{
              backgroundColor: isVisible ? `${cal.color}1A` : `${appTheme.ink}0D`,
              color: isVisible ? cal.color : appTheme.inkMuted48,
              border: `1px solid ${isVisible ? `${cal.color}33` : `${appTheme.ink}14`}`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: isVisible ? cal.color : `${appTheme.ink}33` }}
            />
            {cal.name}
          </button>
        );
      })}

      {/* 管理按钮 */}
      <button
        onClick={onManage}
        className="px-2 py-1.5 rounded-full text-sm transition-all hover:opacity-80"
        style={{ color: `${appTheme.ink}99` }}
        title="管理日历"
      >
        <Settings size={14} strokeWidth={1.5} />
      </button>
    </div>
    </>
  );
}
