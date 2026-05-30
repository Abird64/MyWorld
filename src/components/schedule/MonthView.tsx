import { useState } from 'react';
import { useAppTheme } from '@/stores/themeStore';
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
      <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${appTheme.primary}33` }}>
        {weekDayNames.map((name) => (
          <div key={name} className="py-2 text-center text-xs" style={{ color: `${appTheme.ink}80` }}>
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
                borderBottom: `1px solid ${appTheme.primary}1A`,
                borderRight: `1px solid ${appTheme.primary}1A`,
                backgroundColor: hoveredCellIdx === idx ? `${appTheme.primary}0D` : undefined,
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
                    : { color: `${appTheme.ink}B3` }
                  }
                >
                  {day.getDate()}
                </span>
              </div>

              {/* 事件列表 */}
              <div className="space-y-0.5">
                {visibleEvents.map((event) => {
                  const bgColor = event.color || appTheme.primary;
                  const isTaskSync = event.source_type === 'task_sync';

                  return (
                    <div
                      key={event.id}
                      className="rounded px-1 py-0.5 text-[10px] break-all cursor-pointer transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: isTaskSync ? 'transparent' : bgColor,
                        border: isTaskSync ? `1px dashed ${bgColor}` : 'none',
                        color: isTaskSync ? bgColor : '#FFF',
                        opacity: isTaskSync ? 0.7 : 1,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      {event.title}
                    </div>
                  );
                })}

                {hiddenCount > 0 && (
                  <div className="text-[10px] text-center" style={{ color: `${appTheme.ink}80` }}>
                    +{hiddenCount} 更多
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>{/* end min-w wrapper */}
    </div>
  );
}
