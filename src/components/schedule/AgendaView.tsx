import { useState } from 'react';
import { useAppTheme } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';
import type { Schedule } from '@/types/schedule';


interface AgendaViewProps {
  schedules: Schedule[];
  onEventClick: (event: Schedule) => void;
}

const weekDayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function AgendaView({ schedules, onEventClick }: AgendaViewProps) {
  const appTheme = useAppTheme();
  const { getCalendarById } = useCalendarStore();
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  // 按日期分组
  const groupedByDay = new Map<string, Schedule[]>();

  for (const event of schedules) {
    const date = new Date(event.start_at);
    const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    if (!groupedByDay.has(dateKey)) {
      groupedByDay.set(dateKey, []);
    }
    groupedByDay.get(dateKey)!.push(event);
  }

  // 排序日期
  const sortedDates = Array.from(groupedByDay.keys()).sort();

  // 今天
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

  if (sortedDates.length === 0) {
    return (
      <div className="w-full rounded-2xl p-8 text-center" style={{ backgroundColor: appTheme.canvas }}>
        <p className="text-lg" style={{ color: `${appTheme.ink}66` }}>暂无日程</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: appTheme.canvas }}>
      {sortedDates.map((dateKey) => {
        const events = groupedByDay.get(dateKey)!;
        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const isToday = dateKey === todayKey;
        const weekDay = weekDayNames[date.getDay()];

        return (
          <div key={dateKey}>
            {/* 日期标题 */}
            <div className="flex items-center gap-3 px-5 py-3" style={{
              backgroundColor: isToday ? `${appTheme.primary}1A` : undefined,
              borderBottom: isToday ? undefined : `1px solid ${appTheme.primary}1A`,
            }}>
              <span className="text-sm font-medium" style={{ color: isToday ? appTheme.primary : `${appTheme.ink}99` }}>
                {month}月{day}日
              </span>
              <span className="text-xs" style={{ color: isToday ? `${appTheme.primary}B3` : `${appTheme.ink}66` }}>
                {weekDay}
              </span>
              {isToday && (
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: appTheme.primary, color: appTheme.ink }}>
                  今天
                </span>
              )}
            </div>

            {/* 事件列表 */}
            <div className="divide-y" style={{ borderColor: `${appTheme.primary}0D` }}>
              {events.map((event) => {
                const startDate = new Date(event.start_at);
                const bgColor = event.color || appTheme.primary;
                const isTaskSync = event.source_type === 'task_sync';

                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: hoveredEventId === event.id ? `${appTheme.primary}0D` : undefined,
                    }}
                    onMouseEnter={() => setHoveredEventId(event.id)}
                    onMouseLeave={() => setHoveredEventId(null)}
                    onClick={() => onEventClick(event)}
                  >
                    {/* 时间 */}
                    <div className="w-16 text-right flex-shrink-0">
                      <span className="text-sm" style={{ color: `${appTheme.ink}B2` }}>
                        {pad(startDate.getHours())}:{pad(startDate.getMinutes())}
                      </span>
                    </div>

                    {/* 颜色条 */}
                    <div
                      className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: isTaskSync ? 'transparent' : bgColor,
                        borderLeft: isTaskSync ? `2px dashed ${bgColor}` : 'none',
                      }}
                    />

                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm break-all" style={{ color: isTaskSync ? `${appTheme.ink}99` : appTheme.ink }}>
                          {event.title}
                        </span>
                        {event.calendar_id && (() => {
                          const cal = getCalendarById(event.calendar_id);
                          return cal ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: `${appTheme.ink}80`, backgroundColor: `${appTheme.primary}1A` }}>
                              {cal.name}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      {event.end_at && (
                        <span className="text-xs" style={{ color: `${appTheme.ink}66` }}>
                          {formatTimeRange(event.start_at, event.end_at)}
                        </span>
                      )}
                      {event.location && (
                        <span className="text-xs ml-2" style={{ color: `${appTheme.ink}66` }}>
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${pad(s.getHours())}:${pad(s.getMinutes())} - ${pad(e.getHours())}:${pad(e.getMinutes())}`;
}
