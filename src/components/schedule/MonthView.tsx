import { useState } from 'react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import type { Schedule } from '@/types/schedule';


interface MonthViewProps {
  year: number;
  month: number; // 0-11
  schedules: Schedule[];
  onEventClick: (event: Schedule) => void;
  onDayClick: (date: Date) => void;
}

const weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const MAX_VISIBLE_EVENTS = 3;

export function MonthView({ year, month, schedules, onEventClick, onDayClick }: MonthViewProps) {
  const appTheme = useAppTheme();
  const [hoveredCellIdx, setHoveredCellIdx] = useState<number | null>(null);
  // 获取当月第一天
  const firstDay = new Date(year, month, 1);
  // 获取当月最后一天
  // 第一天是周几（0=周一，6=周日）
  const firstWeekday = (firstDay.getDay() + 6) % 7;

  // 生成 6 周的日期网格
  const days: Date[] = [];
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstWeekday);

  for (let i = 0; i < 42; i++) {
    days.push(new Date(startDate));
    startDate.setDate(startDate.getDate() + 1);
  }

  // 今天
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 获取某天的事件
  const getEventsForDay = (date: Date): Schedule[] => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    return schedules.filter((e) => {
      const eStart = new Date(e.start_at);
      return eStart >= dayStart && eStart < dayEnd;
    });
  };

  return (
    <div className="w-full rounded-2xl" style={{ backgroundColor: appTheme.canvas }}>
      <div>
      {/* 星期标题 */}
      <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${withAlpha(appTheme.primary, 0.2)}` }}>
        {weekDayNames.map((name) => (
          <div key={name} className="py-2 text-center text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>
            {name}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === month;
          const isToday = day.getTime() === today.getTime();
          const dayEvents = getEventsForDay(day);
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const hiddenCount = dayEvents.length - MAX_VISIBLE_EVENTS;

          return (
            <div
              key={idx}
              className={`min-h-[80px] p-1 cursor-pointer ${
                !isCurrentMonth ? 'opacity-40' : ''
              }`}
              style={{
                borderBottom: `1px solid ${withAlpha(appTheme.primary, 0.1)}`,
                borderRight: `1px solid ${withAlpha(appTheme.primary, 0.1)}`,
                backgroundColor: hoveredCellIdx === idx ? `${withAlpha(appTheme.primary, 0.05)}` : undefined,
              }}
              onMouseEnter={() => setHoveredCellIdx(idx)}
              onMouseLeave={() => setHoveredCellIdx(null)}
              onClick={() => onDayClick(day)}
            >
              {/* 日期数字 */}
              <div className="flex justify-end mb-1">
                <span
                  className={`text-sm w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'font-medium' : ''
                  }`}
                  style={isToday
                    ? { backgroundColor: appTheme.primary, color: appTheme.ink }
                    : { color: `${withAlpha(appTheme.ink, 0.7)}` }
                  }
                >
                  {day.getDate()}
                </span>
              </div>

              {/* 事件圆点指示器 */}
              <div className="flex items-center gap-1 flex-wrap px-0.5">
                {visibleEvents.map((event) => {
                  const dotColor = event.color || appTheme.primary;
                  const isTaskSync = event.source_type === 'task_sync';

                  return (
                    <span
                      key={event.id}
                      title={event.title}
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 cursor-pointer transition-transform hover:scale-150"
                      style={isTaskSync
                        ? { backgroundColor: 'transparent', border: `1px dashed ${dotColor}` }
                        : { backgroundColor: dotColor }
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                    />
                  );
                })}

                {hiddenCount > 0 && (
                  <span className="text-[10px]" style={{ color: `${withAlpha(appTheme.ink, 0.45)}` }}>
                    +{hiddenCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
