import { useState } from 'react';
import { X, Pause, Play, Square, SkipForward, Timer, Coffee, Maximize2, Minimize2 } from 'lucide-react';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { FOCUS_COLOR } from '@/styles/theme';

const BREAK_COLOR = '#4B7F52';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface PomodoroTimerProps {
  open: boolean;
  onClose: () => void;
}

export function PomodoroTimer({ open, onClose }: PomodoroTimerProps) {
  const appTheme = useAppTheme();
  const {
    phase, isPaused, elapsedSeconds, targetSeconds,
    boundTaskTitle,
    pause, resume, stop, complete, skipBreak,
  } = usePomodoroStore();

  const [immersive, setImmersive] = useState(false);

  const isRunning = phase !== 'idle';
  const isFocus = phase === 'focus';
  const color = isFocus ? FOCUS_COLOR : BREAK_COLOR;
  const remaining = Math.max(0, targetSeconds - elapsedSeconds);
  const progress = targetSeconds > 0 ? elapsedSeconds / targetSeconds : 0;

  if (!open) return null;

  if (immersive) {
    return (
      <ImmersiveView
        color={color}
        isFocus={isFocus}
        isPaused={isPaused}
        remaining={remaining}
        progress={progress}
        targetSeconds={targetSeconds}
        elapsedSeconds={elapsedSeconds}
        boundTaskTitle={boundTaskTitle}
        isRunning={isRunning}
        onPauseResume={() => isPaused ? resume() : pause()}
        onStop={stop}
        onComplete={complete}
        onSkipBreak={skipBreak}
        onExit={() => setImmersive(false)}
        onClose={onClose}
        appTheme={appTheme}
      />
    );
  }

  return (
    <NormalView
      color={color}
      isFocus={isFocus}
      isPaused={isPaused}
      remaining={remaining}
      progress={progress}
      targetSeconds={targetSeconds}
      elapsedSeconds={elapsedSeconds}
      boundTaskTitle={boundTaskTitle}
      isRunning={isRunning}
      onPauseResume={() => isPaused ? resume() : pause()}
      onStop={stop}
      onComplete={complete}
      onSkipBreak={skipBreak}
      onImmersive={() => setImmersive(true)}
      onClose={() => { setImmersive(false); onClose(); }}
      appTheme={appTheme}
    />
  );
}

// ===== 普通模式：340px 卡片 =====

function NormalView({ color, isFocus, isPaused, remaining, progress, boundTaskTitle, isRunning, onPauseResume, onStop, onComplete, onSkipBreak, onImmersive, onClose, appTheme }: ViewProps) {
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="relative w-[340px] rounded-3xl overflow-hidden"
        style={{ backgroundColor: appTheme.canvas }}
      >
        {/* 顶部色条 */}
        <div className="h-1" style={{ backgroundColor: color }} />

        {/* 顶部按钮 */}
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <button
            onClick={onImmersive}
            className="p-1.5 rounded-full transition-colors"
            style={{ color: appTheme.inkMuted48 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(appTheme.ink, 0.06))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="沉浸模式"
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full transition-colors"
            style={{ color: appTheme.inkMuted48 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(appTheme.ink, 0.06))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center pt-8 pb-6 px-6">
          {/* 阶段标签 */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-6"
            style={{ backgroundColor: withAlpha(color, 0.12), color }}
          >
            {isFocus ? <Timer size={13} /> : <Coffee size={13} />}
            {isFocus ? '专注中' : '休息中'}
          </div>

          {/* 圆环计时器 */}
          <div className="relative w-[260px] h-[260px] flex items-center justify-center mb-6">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 260 260">
              <circle cx="130" cy="130" r={radius} fill="none" stroke={withAlpha(appTheme.ink, 0.06)} strokeWidth="6" />
              <circle
                cx="130" cy="130" r={radius}
                fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="flex flex-col items-center">
              <span className="text-5xl font-light tracking-tight tabular-nums" style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}>
                {formatTime(remaining)}
              </span>
              {boundTaskTitle && (
                <span className="text-xs mt-2 max-w-[180px] truncate text-center" style={{ color: appTheme.inkMuted48 }}>
                  {boundTaskTitle}
                </span>
              )}
            </div>
          </div>

          {/* 控制按钮 */}
          {isRunning && (
            <div className="flex items-center gap-4">
              <button onClick={onStop} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80 }}>
                <Square size={20} />
              </button>
              <button onClick={onPauseResume} className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: color, color: '#fff', boxShadow: `0 4px 20px ${withAlpha(color, 0.3)}` }}>
                {isPaused ? <Play size={24} className="ml-0.5" /> : <Pause size={24} />}
              </button>
              {isFocus ? (
                <button onClick={onComplete} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80 }} title="提前完成">
                  <SkipForward size={20} />
                </button>
              ) : (
                <button onClick={onSkipBreak} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80 }} title="跳过休息">
                  <SkipForward size={20} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== 沉浸模式：全屏 =====

function ImmersiveView({ color, isFocus, isPaused, remaining, progress, targetSeconds, elapsedSeconds, boundTaskTitle, isRunning, onPauseResume, onStop, onComplete, onSkipBreak, onExit, onClose, appTheme }: ViewProps) {
  const radius = 160;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ backgroundColor: appTheme.canvas }}>
      {/* 顶部栏 */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
          style={{ backgroundColor: withAlpha(color, 0.12), color }}
        >
          {isFocus ? <Timer size={14} /> : <Coffee size={14} />}
          {isFocus ? '专注中' : '休息中'}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onExit}
            className="p-2 rounded-full transition-colors"
            style={{ color: appTheme.inkMuted48 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(appTheme.ink, 0.06))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="退出沉浸"
          >
            <Minimize2 size={20} />
          </button>
          <button
            onClick={() => { onExit(); onClose(); }}
            className="p-2 rounded-full transition-colors"
            style={{ color: appTheme.inkMuted48 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(appTheme.ink, 0.06))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 中央计时器 */}
      <div className="flex flex-col items-center">
        <div className="relative w-[380px] h-[380px] flex items-center justify-center">
          {/* 柔和光晕 */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, ${withAlpha(color, 0.08)} 0%, transparent 70%)`,
            }}
          />
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 380 380">
            <circle cx="190" cy="190" r={radius} fill="none" stroke={withAlpha(appTheme.ink, 0.04)} strokeWidth="4" />
            <circle
              cx="190" cy="190" r={radius}
              fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
              style={{ filter: `drop-shadow(0 0 8px ${withAlpha(color, 0.4)})` }}
            />
          </svg>
          <div className="flex flex-col items-center z-10">
            <span
              className="text-7xl font-extralight tracking-tight tabular-nums"
              style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
            >
              {formatTime(remaining)}
            </span>
            {boundTaskTitle && (
              <span className="text-sm mt-3 max-w-[260px] truncate text-center" style={{ color: appTheme.inkMuted48 }}>
                {boundTaskTitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 底部控制 */}
      {isRunning && (
        <div className="absolute bottom-12 flex items-center gap-6">
          <button
            onClick={onStop}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
            style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80 }}
          >
            <Square size={22} />
          </button>
          <button
            onClick={onPauseResume}
            className="w-20 h-20 rounded-full flex items-center justify-center transition-all"
            style={{ backgroundColor: color, color: '#fff', boxShadow: `0 6px 30px ${withAlpha(color, 0.35)}` }}
          >
            {isPaused ? <Play size={28} className="ml-0.5" /> : <Pause size={28} />}
          </button>
          {isFocus ? (
            <button onClick={onComplete} className="w-14 h-14 rounded-full flex items-center justify-center transition-all" style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80 }} title="提前完成">
              <SkipForward size={22} />
            </button>
          ) : (
            <button onClick={onSkipBreak} className="w-14 h-14 rounded-full flex items-center justify-center transition-all" style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80 }} title="跳过休息">
              <SkipForward size={22} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ===== 共享 props =====

interface ViewProps {
  color: string;
  isFocus: boolean;
  isPaused: boolean;
  remaining: number;
  progress: number;
  targetSeconds: number;
  elapsedSeconds: number;
  boundTaskTitle: string | null;
  isRunning: boolean;
  onPauseResume: () => void;
  onStop: () => void;
  onComplete: () => void;
  onSkipBreak: () => void;
  onImmersive?: () => void;
  onExit?: () => void;
  onClose: () => void;
  appTheme: ReturnType<typeof useAppTheme>;
}
