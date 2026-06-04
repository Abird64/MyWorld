import { Timer, Coffee, Pause, Play } from 'lucide-react';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { FOCUS_COLOR, BREAK_COLOR } from '@/styles/theme';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface PomodoroBarProps {
  onClick: () => void;
}

export function PomodoroBar({ onClick }: PomodoroBarProps) {
  const appTheme = useAppTheme();
  const { phase, isPaused, elapsedSeconds, targetSeconds, boundTaskTitle, countUp, pause, resume } = usePomodoroStore();

  if (phase === 'idle') return null;

  const isFocus = phase === 'focus';
  const color = isFocus ? FOCUS_COLOR : BREAK_COLOR;
  const remaining = Math.max(0, targetSeconds - elapsedSeconds);
  const displaySeconds = countUp ? elapsedSeconds : remaining;
  const progress = targetSeconds > 0 ? elapsedSeconds / targetSeconds : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={isFocus ? `专注中：${formatTime(displaySeconds)}，${boundTaskTitle || '无关联任务'}` : `休息中：${formatTime(displaySeconds)}`}
      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
      style={{
        backgroundColor: appTheme.canvasParchment,
        borderBottom: `1px solid ${withAlpha(color, 0.2)}`,
        outlineColor: color,
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* 图标 */}
      {isFocus ? (
        <Timer size={14} style={{ color }} aria-hidden="true" />
      ) : (
        <Coffee size={14} style={{ color }} aria-hidden="true" />
      )}

      {/* 进度条 */}
      <div
        className="flex-1 h-1 rounded-full overflow-hidden"
        style={{ backgroundColor: withAlpha(color, 0.15) }}
      >
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${progress * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* 时间 */}
      <span
        className="text-xs font-medium tabular-nums min-w-[36px] text-right"
        style={{ color }}
      >
        {formatTime(displaySeconds)}
      </span>

      {/* 任务名 */}
      {boundTaskTitle && (
        <span
          className="text-xs truncate max-w-[100px]"
          style={{ color: appTheme.inkMuted48 }}
        >
          {boundTaskTitle}
        </span>
      )}

      {/* 暂停/继续按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          isPaused ? resume() : pause();
        }}
        aria-label={isPaused ? '继续计时' : '暂停计时'}
        className="p-1 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
        style={{ color, outlineColor: color }}
      >
        {isPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}
