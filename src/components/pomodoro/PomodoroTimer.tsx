import { useState, useEffect, useCallback } from 'react';
import { X, Pause, Play, Square, SkipForward, Timer, Coffee, Maximize2, Minimize2, AlertTriangle } from 'lucide-react';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { FOCUS_COLOR, BREAK_COLOR } from '@/styles/theme';

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
    boundTaskTitle, lastError, clearError,
    settings, pause, resume, stop, complete, skipBreak, startFocus, startBreak,
    countUp, toggleCountUp,
  } = usePomodoroStore();

  const [immersive, setImmersive] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'stop' | 'complete' | null>(null);

  const isRunning = phase !== 'idle';
  const isFocus = phase !== 'break';
  const color = isFocus ? FOCUS_COLOR : BREAK_COLOR;
  const remaining = Math.max(0, targetSeconds - elapsedSeconds);
  const progress = targetSeconds > 0 ? elapsedSeconds / targetSeconds : 0;

  // 键盘快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (confirmAction) return; // 有确认弹窗时不响应快捷键
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (!isRunning) return;
      isPaused ? resume() : pause();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (immersive) { setImmersive(false); return; }
      if (isRunning) { handleStopRequest(); return; }
      onClose();
    }
  }, [confirmAction, isRunning, isPaused, immersive, resume, pause, onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // 关闭时清除确认状态
  useEffect(() => {
    if (!open) { setConfirmAction(null); clearError(); }
  }, [open, clearError]);

  // 自动消退错误
  useEffect(() => {
    if (!lastError) return;
    const t = setTimeout(() => clearError(), 4000);
    return () => clearTimeout(t);
  }, [lastError, clearError]);

  const handleStopRequest = () => setConfirmAction('stop');
  const handleCompleteRequest = () => setConfirmAction('complete');
  const handleConfirmCancel = () => setConfirmAction(null);

  const handleConfirmStop = () => {
    setConfirmAction(null);
    stop();
  };
  const handleConfirmComplete = () => {
    setConfirmAction(null);
    complete();
  };

  const handleStartFocus = () => startFocus();
  const handleStartBreak = () => startBreak();

  const handleClose = () => {
    setImmersive(false);
    clearError();
    setConfirmAction(null);
    onClose();
  };

  if (!open) return null;

  // 确认对话框
  if (confirmAction) {
    const isStop = confirmAction === 'stop';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div
          className="w-[320px] rounded-3xl p-8 flex flex-col items-center text-center"
          style={{ backgroundColor: appTheme.canvas }}
          role="alertdialog"
          aria-modal="true"
          aria-label={isStop ? '确认停止' : '确认完成'}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: withAlpha(isStop ? '#C97070' : FOCUS_COLOR, 0.12) }}
          >
            <AlertTriangle size={24} style={{ color: isStop ? '#C97070' : FOCUS_COLOR }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: appTheme.ink }}>
            {isStop ? '确定要停止吗？' : '确定要提前完成吗？'}
          </h3>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: appTheme.inkMuted48 }}>
            {isStop
              ? `已专注 ${formatTime(elapsedSeconds)}，停止后无法恢复。`
              : `已专注 ${formatTime(elapsedSeconds)}，完成后将获得奖励。`}
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={handleConfirmCancel}
              className="flex-1 py-3 rounded-2xl text-sm transition-all"
              style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80 }}
              autoFocus
            >
              继续{isStop ? '专注' : '计时'}
            </button>
            <button
              onClick={isStop ? handleConfirmStop : handleConfirmComplete}
              className="flex-1 py-3 rounded-2xl text-white text-sm transition-all"
              style={{ backgroundColor: isStop ? '#C97070' : FOCUS_COLOR }}
            >
              {isStop ? '确认停止' : '确认完成'}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        lastError={lastError}
        onClearError={clearError}
        onPauseResume={() => isPaused ? resume() : pause()}
        onStop={handleStopRequest}
        onComplete={handleCompleteRequest}
        onSkipBreak={skipBreak}
        onExit={() => setImmersive(false)}
        onClose={handleClose}
        appTheme={appTheme}
        countUp={countUp}
        onToggleCountUp={toggleCountUp}
        onStartFocus={handleStartFocus}
        onStartBreak={handleStartBreak}
        idleTargetSeconds={settings.focus_minutes * 60}
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
      lastError={lastError}
      onClearError={clearError}
      onPauseResume={() => isPaused ? resume() : pause()}
      onStop={handleStopRequest}
      onComplete={handleCompleteRequest}
      onSkipBreak={skipBreak}
      onImmersive={() => setImmersive(true)}
      onClose={handleClose}
      appTheme={appTheme}
      countUp={countUp}
      onToggleCountUp={toggleCountUp}
      onStartFocus={handleStartFocus}
      onStartBreak={handleStartBreak}
      idleTargetSeconds={settings.focus_minutes * 60}
    />
  );
}

// ===== NormalView: 340px card =====

function NormalView({ color, isFocus, isPaused, remaining, progress, elapsedSeconds, boundTaskTitle, isRunning, lastError, onClearError, onPauseResume, onStop, onComplete, onSkipBreak, onImmersive, onClose, appTheme, countUp, onToggleCountUp, onStartFocus, idleTargetSeconds }: ViewProps) {
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="relative w-[340px] rounded-3xl overflow-hidden"
        style={{ backgroundColor: appTheme.canvas }}
        role="dialog"
        aria-modal="true"
        aria-label={isFocus ? '专注计时器' : '休息计时器'}
      >
        {/* 顶部按钮 */}
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <button
            onClick={onImmersive}
            className="p-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: appTheme.inkMuted48, outlineColor: color }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(appTheme.ink, 0.06))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="进入沉浸模式"
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: appTheme.inkMuted48, outlineColor: color }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(appTheme.ink, 0.06))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="关闭计时器"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center pt-8 pb-6 px-6">
          {/* 阶段标签 */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-6"
            style={{ backgroundColor: withAlpha(color, 0.12), color }}
            role="status"
            aria-label={isRunning ? (isFocus ? '专注中' : '休息中') : '准备专注'}
          >
            {isRunning ? (isFocus ? <Timer size={13} aria-hidden="true" /> : <Coffee size={13} aria-hidden="true" />) : <Timer size={13} aria-hidden="true" />}
            {isRunning ? (isFocus ? '专注中' : '休息中') : '准备专注'}
          </div>

          {/* 圆环计时器 */}
          <div className="relative w-[260px] h-[260px] flex items-center justify-center mb-6">
            <svg
              className="absolute inset-0 -rotate-90"
              viewBox="0 0 260 260"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${isFocus ? '专注' : '休息'}进度 ${Math.round(progress * 100)}%，${countUp ? `已过 ${formatTime(elapsedSeconds)}` : `剩余 ${formatTime(remaining)}`}`}
            >
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
                {formatTime(isRunning ? (countUp ? elapsedSeconds : remaining) : (countUp ? 0 : idleTargetSeconds))}
              </span>
              {isRunning && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleCountUp(); }}
                  className="mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    color,
                    backgroundColor: withAlpha(color, 0.1),
                    outlineColor: color,
                  }}
                  aria-label={countUp ? '切换为倒计时' : '切换为正计时'}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(color, 0.2))}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = withAlpha(color, 0.1))}
                >
                  {countUp ? '正计时' : '倒计时'}
                </button>
              )}
              {boundTaskTitle && (
                <span className="text-xs mt-2 max-w-[180px] truncate text-center" style={{ color: appTheme.inkMuted48 }}>
                  {boundTaskTitle}
                </span>
              )}
            </div>
          </div>

          {/* 错误提示 */}
          {lastError && (
            <div
              className="w-full flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm"
              style={{ backgroundColor: withAlpha('#C97070', 0.1), color: '#C97070' }}
              role="alert"
            >
              <AlertTriangle size={14} />
              <span className="flex-1">{lastError}</span>
              <button onClick={onClearError} className="font-medium underline" aria-label="关闭错误提示">关闭</button>
            </div>
          )}

          {/* 控制按钮 */}
          {isRunning ? (
            <div className="flex items-center gap-4">
              <button
                onClick={onStop}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80, outlineColor: color }}
                aria-label="停止计时"
              >
                <Square size={20} aria-hidden="true" />
              </button>
              <button
                onClick={onPauseResume}
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: color, color: '#fff', boxShadow: `0 4px 20px ${withAlpha(color, 0.3)}`, outlineColor: color }}
                aria-label={isPaused ? '继续计时' : '暂停计时'}
              >
                {isPaused ? <Play size={24} className="ml-0.5" aria-hidden="true" /> : <Pause size={24} aria-hidden="true" />}
              </button>
              {isFocus ? (
                <button
                  onClick={onComplete}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80, outlineColor: color }}
                  aria-label="提前完成"
                >
                  <SkipForward size={20} aria-hidden="true" />
                </button>
              ) : (
                <button
                  onClick={onSkipBreak}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80, outlineColor: color }}
                  aria-label="跳过休息"
                >
                  <SkipForward size={20} aria-hidden="true" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleCountUp(); }}
                className="px-4 py-2.5 rounded-2xl text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  color,
                  backgroundColor: withAlpha(color, 0.1),
                  outlineColor: color,
                }}
                aria-label={countUp ? '切换为倒计时' : '切换为正计时'}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(color, 0.18))}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = withAlpha(color, 0.1))}
              >
                {countUp ? '正计时' : '倒计时'}
              </button>
              <button
                onClick={onStartFocus}
                className="px-6 py-2.5 rounded-2xl text-sm font-medium text-white transition-all flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: color, boxShadow: `0 4px 20px ${withAlpha(color, 0.3)}`, outlineColor: color }}
                aria-label="立即开始专注"
              >
                <Play size={14} aria-hidden="true" />
                立即启动
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== ImmersiveView: fullscreen =====

function ImmersiveView({ color, isFocus, isPaused, remaining, progress, elapsedSeconds, boundTaskTitle, isRunning, lastError, onClearError, onPauseResume, onStop, onComplete, onSkipBreak, onExit, onClose, appTheme, countUp, onToggleCountUp, onStartFocus, idleTargetSeconds }: ViewProps) {
  const radius = 160;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center animate-fade-in" style={{ backgroundColor: appTheme.canvas }}>
      {/* 顶部栏 */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
          style={{ backgroundColor: withAlpha(color, 0.12), color }}
          role="status"
          aria-label={isRunning ? (isFocus ? '专注中' : '休息中') : '准备专注'}
        >
          {isRunning ? (isFocus ? <Timer size={14} aria-hidden="true" /> : <Coffee size={14} aria-hidden="true" />) : <Timer size={14} aria-hidden="true" />}
          {isRunning ? (isFocus ? '专注中' : '休息中') : '准备专注'}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onExit}
            className="p-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: appTheme.inkMuted48, outlineColor: color }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(appTheme.ink, 0.06))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="退出沉浸模式"
          >
            <Minimize2 size={20} />
          </button>
          <button
            onClick={() => { onExit?.(); onClose(); }}
            className="p-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: appTheme.inkMuted48, outlineColor: color }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(appTheme.ink, 0.06))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="关闭计时器"
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
            aria-hidden="true"
          />
          <svg
            className="absolute inset-0 -rotate-90"
            viewBox="0 0 380 380"
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${isFocus ? '专注' : '休息'}进度 ${Math.round(progress * 100)}%，${countUp ? `已过 ${formatTime(elapsedSeconds)}` : `剩余 ${formatTime(remaining)}`}`}
          >
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
              {formatTime(isRunning ? (countUp ? elapsedSeconds : remaining) : (countUp ? 0 : idleTargetSeconds))}
            </span>
            {isRunning && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleCountUp(); }}
                className="mt-3 px-3 py-1 rounded-full text-xs font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  color,
                  backgroundColor: withAlpha(color, 0.1),
                  outlineColor: color,
                }}
                aria-label={countUp ? '切换为倒计时' : '切换为正计时'}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(color, 0.2))}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = withAlpha(color, 0.1))}
              >
                {countUp ? '正计时' : '倒计时'}
              </button>
            )}
            {boundTaskTitle && (
              <span className="text-sm mt-3 max-w-[260px] truncate text-center" style={{ color: appTheme.inkMuted48 }}>
                {boundTaskTitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {lastError && (
        <div
          className="absolute top-20 left-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: withAlpha('#C97070', 0.1), color: '#C97070' }}
          role="alert"
        >
          <AlertTriangle size={14} />
          <span className="flex-1">{lastError}</span>
          <button onClick={onClearError} className="font-medium underline" aria-label="关闭错误提示">关闭</button>
        </div>
      )}

      {/* 底部控制 */}
      {isRunning ? (
        <div className="absolute bottom-12 flex items-center gap-6">
          <button
            onClick={onStop}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80, outlineColor: color }}
            aria-label="停止计时"
          >
            <Square size={22} aria-hidden="true" />
          </button>
          <button
            onClick={onPauseResume}
            className="w-20 h-20 rounded-full flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: color, color: '#fff', boxShadow: `0 6px 30px ${withAlpha(color, 0.35)}`, outlineColor: color }}
            aria-label={isPaused ? '继续计时' : '暂停计时'}
          >
            {isPaused ? <Play size={28} className="ml-0.5" aria-hidden="true" /> : <Pause size={28} aria-hidden="true" />}
          </button>
          {isFocus ? (
            <button
              onClick={onComplete}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80, outlineColor: color }}
              aria-label="提前完成"
            >
              <SkipForward size={22} aria-hidden="true" />
            </button>
          ) : (
            <button
              onClick={onSkipBreak}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: withAlpha(appTheme.ink, 0.06), color: appTheme.inkMuted80, outlineColor: color }}
              aria-label="跳过休息"
            >
              <SkipForward size={22} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className="absolute bottom-12 flex items-center gap-4">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCountUp(); }}
            className="px-5 py-3 rounded-2xl text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              color,
              backgroundColor: withAlpha(color, 0.1),
              outlineColor: color,
            }}
            aria-label={countUp ? '切换为倒计时' : '切换为正计时'}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(color, 0.18))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = withAlpha(color, 0.1))}
          >
            {countUp ? '正计时' : '倒计时'}
          </button>
          <button
            onClick={onStartFocus}
            className="px-8 py-3 rounded-2xl text-sm font-medium text-white transition-all flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: color, boxShadow: `0 6px 30px ${withAlpha(color, 0.35)}`, outlineColor: color }}
            aria-label="立即开始专注"
          >
            <Play size={16} aria-hidden="true" />
            立即启动
          </button>
        </div>
      )}
    </div>
  );
}

// ===== shared props =====

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
  lastError: string | null;
  onClearError: () => void;
  onPauseResume: () => void;
  onStop: () => void;
  onComplete: () => void;
  onSkipBreak: () => void;
  onImmersive?: () => void;
  onExit?: () => void;
  onClose: () => void;
  appTheme: ReturnType<typeof useAppTheme>;
  countUp: boolean;
  onToggleCountUp: () => void;
  onStartFocus: () => void;
  onStartBreak: () => void;
  idleTargetSeconds: number;
}
