import type { Schedule } from '@/types/schedule';
import { useAppTheme } from '@/stores/themeStore';
import { EventBlock } from './EventBlock';
import {
  HOUR_START,
  HOUR_END,
  hourToPercent,
  layoutOverlappingEvents,
} from '@/utils/scheduleLayout';


interface DayViewProps {
  date: Date;
  schedules: Schedule[];
  onEventClick: (event: Schedule) => void;
  onBack: () => void;
  backLabel?: string;
}

const weekDayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const GAP = 1.6;

export function DayView({ date, schedules, onEventClick, onBack, backLabel = '返回周视图' }: DayViewProps) {
  const appTheme = useAppTheme();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = date.getTime() === today.getTime();

  const hours = [0, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const dayEvents = schedules.filter((e) => {
    const eStart = new Date(e.start_at);
    return eStart >= dayStart && eStart < dayEnd;
  });

  const { layouts, taskSyncOverlap } = layoutOverlappingEvents(dayEvents);

  const linkedTaskIds = new Set<string>();
  for (const tasks of taskSyncOverlap.values()) {
    for (const t of tasks) linkedTaskIds.add(t.id);
  }

  const standaloneTasks = dayEvents.filter(
    (e) => e.source_type === 'task_sync' && !linkedTaskIds.has(e.id)
  );

  // 预计算所有事件的位置信息
  const regularBlocks = layouts.map(({ event, col, totalCols }) => {
    const colWidthPercent = 100 / totalCols;
    const colLeft = col * colWidthPercent;
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
    return { event, top, height: Math.min(height, 100 - top), left: colLeft + GAP / 2, width: colWidthPercent - GAP };
  }).filter(Boolean);

  const taskBlocks = standaloneTasks.map((event) => {
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
    return { event, top, height: Math.min(height, 100 - top), left: GAP / 2, width: 100 - GAP };
  }).filter(Boolean);

  return (
    <div className="w-full rounded-2xl overflow-hidden flex flex-col" style={{ backgroundColor: appTheme.canvas }}>
      {/* 表头 */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${appTheme.primary}33` }}>
        <button
          onClick={onBack}
          className="text-sm transition-colors"
          style={{ color: `${appTheme.ink}99` }}
          onMouseEnter={(e) => (e.currentTarget.style.color = appTheme.ink)}
          onMouseLeave={(e) => (e.currentTarget.style.color = `${appTheme.ink}99`)}
        >
          &larr; {backLabel}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg font-light" style={{ color: appTheme.ink }}>
            {date.getMonth() + 1}月{date.getDate()}日
          </span>
          <span className="text-sm" style={{ color: `${appTheme.ink}80` }}>
            {weekDayNames[date.getDay()]}
          </span>
          {isToday && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: appTheme.primary, color: appTheme.ink }}>
              今天
            </span>
          )}
        </div>
        <div className="w-20" />
      </div>

      {/* 网格主体 */}
      <div className="flex" style={{ height: 1200 }}>
        {/* 时间轴 */}
        <div className="w-[40px] sm:w-[60px] flex-shrink-0 relative" style={{ height: '100%' }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute w-full text-right pr-3 text-xs -translate-y-1/2"
              style={{ top: `${hourToPercent(hour)}%`, color: `${appTheme.ink}66` }}
            >
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
          <div
            className="absolute left-0 right-0 border-t border-dashed" style={{ borderColor: `${appTheme.primary}4D`, top: `${hourToPercent(7)}%` }}
          />
        </div>

        {/* 事件区 */}
        <div className="flex-1 relative" style={{ height: '100%' }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute w-full h-[1px] left-0" style={{ top: `${hourToPercent(hour)}%`, backgroundColor: `${appTheme.primary}33` }}
            />
          ))}

          {isToday && (
            <div className="absolute top-0 h-full left-0 right-0" style={{ backgroundColor: `${appTheme.primary}0D` }} />
          )}

          {/* 普通日程 */}
          {regularBlocks.map((b) => b && (
            <EventBlock
              key={b.event.id}
              event={b.event}
              top={b.top}
              height={b.height}
              left={b.left}
              width={b.width}
              onClick={onEventClick}
              taskSyncEvents={taskSyncOverlap.get(b.event.id)}
              onTaskSyncClick={onEventClick}
            />
          ))}

          {/* 独立 task_sync 事件 */}
          {taskBlocks.map((b) => b && (
            <EventBlock
              key={b.event.id}
              event={b.event}
              top={b.top}
              height={b.height}
              left={b.left}
              width={b.width}
              onClick={onEventClick}
            />
          ))}

          <CurrentTimeLine />
        </div>
      </div>
    </div>
  );
}

function CurrentTimeLine() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;

  if (hour < HOUR_START || hour > HOUR_END) return null;

  const top = hourToPercent(hour);

  return (
    <div
      className="absolute w-full left-0 z-20 pointer-events-none"
      style={{ top: `${top}%` }}
    >
      <div className="w-full h-[2px] bg-red-500" />
      <div className="absolute -left-1 -top-[4px] w-[10px] h-[10px] rounded-full bg-red-500" />
    </div>
  );
}
