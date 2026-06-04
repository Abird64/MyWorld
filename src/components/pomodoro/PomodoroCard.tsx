import { useEffect, useState, useRef, useCallback } from 'react';
import { Timer, Play } from 'lucide-react';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { FOCUS_COLOR } from '@/styles/theme';
import { DashboardCard } from '@/components/dashboard/DashboardCard';

export function PomodoroCard() {
  const appTheme = useAppTheme();
  const { stats, lastReward, fetchStats, phase, isPaused, elapsedSeconds, targetSeconds, countUp } = usePomodoroStore();
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchStats().then(() => setLoading(false)).catch(() => { setError(true); setLoading(false); });
  }, [fetchStats]);

  useEffect(() => { load(); }, [load]);

  const clearReward = useCallback(() => {
    usePomodoroStore.setState({ lastReward: null });
  }, []);

  useEffect(() => {
    if (lastReward) {
      if (clearRef.current) clearTimeout(clearRef.current);
      clearRef.current = setTimeout(clearReward, 4000);
    }
    return () => { if (clearRef.current) clearTimeout(clearRef.current); };
  }, [lastReward, clearReward]);

  const focusMinutes = Math.round(stats.focus_seconds / 60);
  const isRunning = phase !== 'idle';
  const progress = targetSeconds > 0 ? elapsedSeconds / targetSeconds : 0;
  const remaining = Math.max(0, targetSeconds - elapsedSeconds);

  const openTimer = () => window.dispatchEvent(new CustomEvent('pomodoro-open-timer'));

  function formatMini(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return (
    <DashboardCard
      title="番茄钟"
      icon={Timer}
      color={FOCUS_COLOR}
      onClick={openTimer}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {lastReward ? (
        <div className="flex items-center gap-3 text-xs animate-pulse">
          <span style={{ color: '#D4A843' }}>+{lastReward.glow} 萤火</span>
          <span style={{ color: appTheme.inkMuted48 }}>+{lastReward.xp} XP</span>
        </div>
      ) : isRunning ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: withAlpha(FOCUS_COLOR, 0.15) }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progress * 100}%`, backgroundColor: FOCUS_COLOR }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums" style={{ color: FOCUS_COLOR }}>
              {formatMini(countUp ? elapsedSeconds : remaining)}
            </span>
          </div>
          <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
            {isPaused ? '已暂停' : '进行中'} · 今日 {stats.focus_count} 个番茄
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <button
            onClick={(e) => { e.stopPropagation(); openTimer(); }}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: withAlpha(FOCUS_COLOR, 0.12), color: FOCUS_COLOR, outlineColor: FOCUS_COLOR }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(FOCUS_COLOR, 0.2))}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = withAlpha(FOCUS_COLOR, 0.12))}
          >
            <Play size={14} />
            开始专注
          </button>
          {stats.focus_count > 0 ? (
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: appTheme.inkMuted48 }}>今日 {stats.focus_count} 个番茄</span>
              <span style={{ color: appTheme.inkMuted48 }}>共 {focusMinutes} 分钟</span>
            </div>
          ) : (
            <span className="text-xs text-center" style={{ color: appTheme.inkMuted48 }}>
              今天还没有开始
            </span>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
