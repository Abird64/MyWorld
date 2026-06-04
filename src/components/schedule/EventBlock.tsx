import type { Schedule } from '@/types/schedule';
import { useAppTheme, withAlpha } from '@/stores/themeStore';


interface EventBlockProps {
  event: Schedule;
  top: number;       // 百分比 0-100
  height: number;    // 百分比
  left: number;      // 百分比
  width: number;     // 百分比
  onClick: (event: Schedule) => void;
  taskSyncEvents?: Schedule[];
  onTaskSyncClick?: (event: Schedule) => void;
}

export function EventBlock({ event, top, height, left, width, onClick, taskSyncEvents, onTaskSyncClick }: EventBlockProps) {
  const appTheme = useAppTheme();
  const isTaskSync = event.source_type === 'task_sync';
  const bgColor = event.color || appTheme.primary;

  return (
    <div
      className="absolute rounded-lg overflow-hidden select-none cursor-pointer"
      style={{
        top: `${top}%`,
        height: `${Math.max(height, 2)}%`,
        left: `${left}%`,
        width: `${width}%`,
        backgroundColor: isTaskSync ? 'transparent' : bgColor,
        border: isTaskSync ? `2px dashed ${bgColor}` : `1px solid ${withAlpha(appTheme.ink, 0.08)}`,
        opacity: isTaskSync ? 0.7 : 1,
        zIndex: 10,
      }}
      onClick={() => onClick(event)}
    >
      <div className="px-1.5 py-0.5 h-full flex flex-col overflow-hidden relative">
        <span
          className="text-xs font-medium leading-tight break-all"
          style={{ color: isTaskSync ? bgColor : getContrastColor(bgColor) }}
        >
          {event.title}
        </span>
        {height > 6 && (
          <span
            className="text-[10px] leading-tight mt-0.5"
            style={{ color: isTaskSync ? bgColor : getContrastColor(bgColor), opacity: 0.7 }}
          >
            {formatTimeRange(event.start_at, event.end_at)}
          </span>
        )}
        {/* 任务同步指示线 */}
        {taskSyncEvents && taskSyncEvents.length > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center gap-1 px-1 cursor-pointer"
            style={{ height: 3, backgroundColor: '#58A968' }}
            title={taskSyncEvents.map((t) => t.title).join('、')}
            onClick={(e) => {
              e.stopPropagation();
              onTaskSyncClick?.(taskSyncEvents[0]);
            }}
          />
        )}
      </div>
    </div>
  );
}

function formatTimeRange(start: string, end: string | null): string {
  const startDate = new Date(start);
  const s = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
  if (!end) return s;
  const endDate = new Date(end);
  const e = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
  return `${s} - ${e}`;
}

export function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1A1A1A' : '#FFFFFF';
}
