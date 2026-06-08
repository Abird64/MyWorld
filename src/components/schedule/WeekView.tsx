import type { Schedule } from '@/types/schedule';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { EventBlock, getContrastColor } from './EventBlock';
import {
  HOUR_END,
  hourToPercent,
  layoutOverlappingEvents,
} from '@/utils/scheduleLayout';
import { CurrentTimeLine } from './CurrentTimeLine';


interface WeekViewProps {
  weekStart: Date;
  schedules: Schedule[];
  onEventClick: (event: Schedule) => void;
}

const weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function WeekView({ weekStart, schedules, onEventClick }: WeekViewProps) {
  const appTheme = useAppTheme();
  // 生成 7 天的日期
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // 今天日期
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 时间刻度（显示关键时间点）
  const hours = [0, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

  // 按天分组事件（排除全天事件）
  const eventsByDay: Schedule[][] = days.map((day) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    return schedules.filter((e) => {
      if (e.is_all_day) return false; // 全天事件单独处理
      const eStart = new Date(e.start_at);
      return eStart >= dayStart && eStart < dayEnd;
    });
  });

  // 全天事件按天分组
  const allDayEventsByDay: Schedule[][] = days.map((day) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    return schedules.filter((e) => {
      if (!e.is_all_day) return false;
      const eStart = new Date(e.start_at);
      return eStart >= dayStart && eStart < dayEnd;
    });
  });

  // 是否有全天事件
  const hasAllDayEvents = allDayEventsByDay.some((events) => events.length > 0);

  return (
    <div className="w-full rounded-2xl relative" style={{ backgroundColor: appTheme.canvas }}>
      <div className="flex flex-col">
      {/* ========== 表头：星期标签 + 日期 ========== */}
      <div className="flex flex-shrink-0" style={{ borderBottom: `1px solid ${withAlpha(appTheme.primary, 0.4)}` }}>
        {/* 时间轴占位 */}
        <div className="w-[36px] sm:w-[52px] flex-shrink-0" />
        {/* 7 列标题 */}
        {days.map((day, idx) => {
          const isToday = day.getTime() === today.getTime();
          return (
            <div
              key={idx}
              className={`flex-1 py-2 text-center ${
                isToday ? '' : ''
              }`}
              style={isToday ? { backgroundColor: `${withAlpha(appTheme.primary, 0.1)}` } : undefined}
            >
              <div className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>{weekDayNames[idx]}</div>
              <div
                className={`text-lg font-light mt-0.5 w-8 h-8 flex items-center justify-center mx-auto ${
                  isToday ? 'rounded-full' : ''
                }`}
                style={isToday
                  ? { color: appTheme.ink, backgroundColor: appTheme.primary }
                  : { color: `${withAlpha(appTheme.ink, 0.8)}` }
                }
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========== 全天事件区域 ========== */}
      {hasAllDayEvents && (
        <div className="flex flex-shrink-0 min-h-[32px]" style={{ borderBottom: `1px solid ${withAlpha(appTheme.primary, 0.2)}` }}>
          <div className="w-[36px] sm:w-[52px] flex-shrink-0 flex items-center justify-center">
            <span className="text-[10px]" style={{ color: `${withAlpha(appTheme.ink, 0.4)}` }}>全天</span>
          </div>
          {allDayEventsByDay.map((dayEvents, dayIdx) => (
            <div key={dayIdx} className="flex-1 flex flex-col gap-1 py-1 px-0.5">
              {dayEvents.map((event) => {
                const bgColor = event.color || appTheme.primary;
                const isTaskSync = event.source_type === 'task_sync';
                return (
                  <div
                    key={event.id}
                    className="rounded px-1.5 py-0.5 text-xs break-all cursor-pointer transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: isTaskSync ? 'transparent' : bgColor,
                      border: isTaskSync ? `1px dashed ${bgColor}` : 'none',
                      color: isTaskSync ? bgColor : getContrastColor(bgColor),
                      opacity: isTaskSync ? 0.7 : 1,
                    }}
                    onClick={() => onEventClick(event)}
                  >
                    {event.title}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ========== 网格主体 ========== */}
      <div
        className="flex"
        style={{ height: 1200 }}
      >
        {/* 时间轴 */}
        <div className="w-[36px] sm:w-[52px] flex-shrink-0 relative" style={{ height: '100%' }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute w-full text-right pr-2 text-[10px] -translate-y-1/2"
              style={{ top: `${hourToPercent(hour)}%`, color: `${withAlpha(appTheme.ink, 0.4)}` }}
            >
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
          {/* 夜间压缩区标记 */}
          <div
            className="absolute left-0 right-0 border-t border-dashed" style={{ borderColor: `${withAlpha(appTheme.primary, 0.3)}`, top: `${hourToPercent(7)}%` }}
          />
        </div>

        {/* 7 列事件区 */}
        <div className="flex-1 relative" style={{ height: '100%' }}>
          {/* 水平网格线 */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute w-full h-[1px] left-0" style={{ top: `${hourToPercent(hour)}%`, backgroundColor: `${withAlpha(appTheme.primary, 0.2)}` }}
            />
          ))}

          {/* 垂直分隔线 */}
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="absolute top-0 h-full w-[1px]" style={{ left: `${((i + 1) / 7) * 100}%`, backgroundColor: `${withAlpha(appTheme.primary, 0.2)}` }}
            />
          ))}

          {/* 今天高亮列 */}
          {days.map((day, idx) => {
            const isToday = day.getTime() === today.getTime();
            if (!isToday) return null;
            return (
              <div
                key={`today-${idx}`}
                className="absolute top-0 h-full" style={{ left: `${(idx / 7) * 100}%`, width: `${100 / 7}%`, backgroundColor: `${withAlpha(appTheme.primary, 0.05)}` }}
              />
            );
          })}

          {/* 事件色块 */}
          {eventsByDay.map((dayEvents, dayIdx) => {
            if (dayEvents.length === 0) return null;

            const { layouts, taskSyncOverlap } = layoutOverlappingEvents(dayEvents);

            // 收集已被关联到普通日程的 task_sync id
            const linkedTaskIds = new Set<string>();
            for (const tasks of taskSyncOverlap.values()) {
              for (const t of tasks) linkedTaskIds.add(t.id);
            }

            // 独立的 task_sync 事件（没有重叠的普通日程）
            const standaloneTasks = dayEvents.filter(
              (e) => e.source_type === 'task_sync' && !linkedTaskIds.has(e.id)
            );

            const dayLeft = (dayIdx / 7) * 100;
            const dayWidth = 100 / 7;
            const gap = 1.2;

            return (
              <div key={dayIdx}>
                {/* 普通日程 */}
                {layouts.map(({ event, col, totalCols }) => {
                  const colWidthPercent = dayWidth / totalCols;
                  const colLeft = dayLeft + col * colWidthPercent;
                  const cardLeft = colLeft + gap / 2;
                  const cardWidth = colWidthPercent - gap;

                  const startDate = new Date(event.start_at);
                  const startHour = startDate.getHours() + startDate.getMinutes() / 60;
                  const top = hourToPercent(startHour);

                  let height: number;
                  if (event.end_at) {
                    const endDate = new Date(event.end_at);
                    const endHour = endDate.getHours() + endDate.getMinutes() / 60;
                    height = hourToPercent(endHour) - top;
                  } else {
                    height = hourToPercent(startHour + 1) - top;
                  }

                  if (startHour >= HOUR_END || top >= 100) return null;
                  const maxHeight = 100 - top;
                  const clampedHeight = Math.min(height, maxHeight);

                  return (
                    <EventBlock
                      key={event.id}
                      event={event}
                      top={top}
                      height={clampedHeight}
                      left={cardLeft}
                      width={cardWidth}
                      onClick={onEventClick}
                      taskSyncEvents={taskSyncOverlap.get(event.id)}
                      onTaskSyncClick={onEventClick}
                    />
                  );
                })}

                {/* 独立 task_sync 事件 */}
                {standaloneTasks.map((event) => {
                  const startDate = new Date(event.start_at);
                  const startHour = startDate.getHours() + startDate.getMinutes() / 60;
                  const top = hourToPercent(startHour);

                  let height: number;
                  if (event.end_at) {
                    const endDate = new Date(event.end_at);
                    const endHour = endDate.getHours() + endDate.getMinutes() / 60;
                    height = hourToPercent(endHour) - top;
                  } else {
                    height = hourToPercent(startHour + 1) - top;
                  }

                  if (startHour >= HOUR_END || top >= 100) return null;
                  const maxHeight = 100 - top;
                  const clampedHeight = Math.min(height, maxHeight);

                  return (
                    <EventBlock
                      key={event.id}
                      event={event}
                      top={top}
                      height={clampedHeight}
                      left={dayLeft + gap / 2}
                      width={dayWidth - gap}
                      onClick={onEventClick}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* 当前时间指示线 */}
          <CurrentTimeLine />

        </div>
      </div>
      </div>
    </div>
  );
}

