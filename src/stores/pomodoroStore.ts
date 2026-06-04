import { create } from 'zustand';
import type { PomodoroSession, PomodoroSettings, PomodoroStats } from '@/types/pomodoro';
import { DEFAULT_POMODORO_SETTINGS } from '@/types/pomodoro';
import * as pomodoroService from '@/services/pomodoroService';
import { getSetting, setSetting } from '@/services/settingService';
import { triggerSync } from '@/stores/syncStore';

type TimerPhase = 'idle' | 'focus' | 'break';

interface PomodoroState {
  // 当前会话
  session: PomodoroSession | null;
  phase: TimerPhase;
  isPaused: boolean;
  elapsedSeconds: number;       // 已过秒数
  targetSeconds: number;        // 目标秒数

  // 设置
  settings: PomodoroSettings;

  // 今日统计
  stats: PomodoroStats;

  // 绑定的任务信息
  boundTaskTitle: string | null;

  // 最近一次完成的奖励（用于 UI 展示）
  lastReward: { xp: number; glow: number } | null;

  // 错误信息（用于 UI 展示）
  lastError: string | null;

  // 计时模式：true=正计时（显示已过时间），false=倒计时（显示剩余时间）
  countUp: boolean;

  // 内部：计时器引用
  _intervalId: number | null;
  _startTimestamp: number;       // Date.now() 当次计时开始时间
  _pausedElapsed: number;       // 暂停时已累积的秒数

  // Actions
  fetchSettings: () => Promise<void>;
  saveSettings: (settings: Partial<PomodoroSettings>) => Promise<void>;
  clearError: () => void;
  toggleCountUp: () => void;
  fetchStats: () => Promise<void>;
  restoreSession: () => Promise<void>;

  startFocus: (taskId?: string, taskTitle?: string) => Promise<void>;
  startBreak: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
  complete: () => Promise<void>;
  skipBreak: () => Promise<void>;
  _startInterval: () => void;
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  session: null,
  phase: 'idle',
  isPaused: false,
  elapsedSeconds: 0,
  targetSeconds: 0,
  settings: DEFAULT_POMODORO_SETTINGS,
  stats: { focus_count: 0, focus_seconds: 0, break_count: 0 },
  boundTaskTitle: null,
  lastReward: null,
  lastError: null,
  countUp: false,
  _intervalId: null,
  _startTimestamp: 0,
  _pausedElapsed: 0,

  fetchSettings: async () => {
    try {
      const [focusRes, breakRes, longBreakRes, autoRes] = await Promise.all([
        getSetting('pomodoro_focus_minutes'),
        getSetting('pomodoro_break_minutes'),
        getSetting('pomodoro_long_break_minutes'),
        getSetting('pomodoro_auto_start_break'),
      ]);
      set({
        settings: {
          focus_minutes: focusRes ? parseInt(focusRes.value) : DEFAULT_POMODORO_SETTINGS.focus_minutes,
          break_minutes: breakRes ? parseInt(breakRes.value) : DEFAULT_POMODORO_SETTINGS.break_minutes,
          long_break_minutes: longBreakRes ? parseInt(longBreakRes.value) : DEFAULT_POMODORO_SETTINGS.long_break_minutes,
          auto_start_break: autoRes ? autoRes.value === 'true' : DEFAULT_POMODORO_SETTINGS.auto_start_break,
        },
      });
    } catch (e) {
      console.error('Failed to load pomodoro settings:', e);
    }
  },

  saveSettings: async (partial) => {
    const newSettings = { ...get().settings, ...partial };
    set({ settings: newSettings });
    try {
      await Promise.all([
        setSetting('pomodoro_focus_minutes', String(newSettings.focus_minutes)),
        setSetting('pomodoro_break_minutes', String(newSettings.break_minutes)),
        setSetting('pomodoro_long_break_minutes', String(newSettings.long_break_minutes)),
        setSetting('pomodoro_auto_start_break', String(newSettings.auto_start_break)),
      ]);
    } catch (e) {
      console.error('Failed to save pomodoro settings:', e);
    }
  },

  fetchStats: async () => {
    try {
      const stats = await pomodoroService.getPomodoroStats();
      set({ stats });
    } catch (e) {
      console.error('Failed to fetch pomodoro stats:', e);
    }
  },

  clearError: () => set({ lastError: null }),

  toggleCountUp: () => set(s => ({ countUp: !s.countUp })),

  restoreSession: async () => {
    try {
      const active = await pomodoroService.getActivePomodoro();
      if (active && active.status === 'running') {
        const startedAt = new Date(active.started_at).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - startedAt) / 1000);
        const target = active.target_minutes * 60;

        set({
          session: active,
          phase: active.session_type === 'focus' ? 'focus' : 'break',
          isPaused: false,
          elapsedSeconds: Math.min(elapsed, target),
          targetSeconds: target,
          _startTimestamp: now,
          _pausedElapsed: Math.min(elapsed, target),
        });

        // 启动计时器
        get()._startInterval();
      }
    } catch (e) {
      console.error('Failed to restore pomodoro session:', e);
    }
  },

  startFocus: async (taskId, taskTitle) => {
    const state = get();
    // 如果已有运行中的会话，先取消
    if (state.session && state.session.status === 'running') {
      await get().stop();
    }

    const targetMin = state.settings.focus_minutes;
    try {
      const session = await pomodoroService.startPomodoro({
        task_id: taskId,
        session_type: 'focus',
        target_minutes: targetMin,
      });

      const targetSec = targetMin * 60;
      set({
        session,
        phase: 'focus',
        isPaused: false,
        elapsedSeconds: 0,
        targetSeconds: targetSec,
        boundTaskTitle: taskTitle || null,
        _startTimestamp: Date.now(),
        _pausedElapsed: 0,
      });

      get()._startInterval();
    } catch (e) {
      console.error('Failed to start pomodoro:', e);
      set({ lastError: '启动番茄钟失败，请重试' });
    }
  },

  startBreak: async () => {
    const state = get();
    const breakMin = state.settings.break_minutes;
    try {
      const session = await pomodoroService.startPomodoro({
        session_type: 'break',
        target_minutes: breakMin,
      });

      const targetSec = breakMin * 60;
      set({
        session,
        phase: 'break',
        isPaused: false,
        elapsedSeconds: 0,
        targetSeconds: targetSec,
        boundTaskTitle: null,
        _startTimestamp: Date.now(),
        _pausedElapsed: 0,
      });

      get()._startInterval();
    } catch (e) {
      console.error('Failed to start break:', e);
      set({ lastError: '启动休息失败，请重试' });
    }
  },

  pause: () => {
    const state = get();
    if (!state.session || state.isPaused) return;

    // 清除计时器
    if (state._intervalId) {
      clearInterval(state._intervalId);
    }

    set({
      isPaused: true,
      _pausedElapsed: state.elapsedSeconds,
      _intervalId: null,
    });
  },

  resume: () => {
    const state = get();
    if (!state.session || !state.isPaused) return;

    set({
      isPaused: false,
      _startTimestamp: Date.now(),
    });

    get()._startInterval();
  },

  stop: async () => {
    const state = get();
    if (!state.session) return;

    // 清除计时器
    if (state._intervalId) {
      clearInterval(state._intervalId);
    }

    try {
      await pomodoroService.cancelPomodoro(state.session.id);
    } catch (e) {
      console.error('Failed to cancel pomodoro session:', e);
    }

    set({
      session: null,
      phase: 'idle',
      isPaused: false,
      elapsedSeconds: 0,
      targetSeconds: 0,
      boundTaskTitle: null,
      lastError: null,
      _intervalId: null,
      _startTimestamp: 0,
      _pausedElapsed: 0,
    });

    triggerSync();
  },

  complete: async () => {
    const state = get();
    if (!state.session) return;

    // 清除计时器
    if (state._intervalId) {
      clearInterval(state._intervalId);
    }

    const actualSeconds = state.elapsedSeconds;

    try {
      await pomodoroService.completePomodoro(state.session.id, actualSeconds);
    } catch (e) {
      console.error('Failed to complete pomodoro:', e);
      set({ lastError: '完成番茄钟失败，请重试' });
      return;
    }

    const wasBreak = state.phase === 'break';

    // 计算奖励（仅 focus 阶段）
    const targetMin = Math.round(state.targetSeconds / 60);
    const reward = !wasBreak ? { xp: targetMin, glow: Math.max(targetMin, 5) } : null;

    set({
      session: null,
      phase: 'idle',
      isPaused: false,
      elapsedSeconds: 0,
      targetSeconds: 0,
      boundTaskTitle: null,
      lastReward: reward,
      _intervalId: null,
      _startTimestamp: 0,
      _pausedElapsed: 0,
    });

    // 刷新统计
    get().fetchStats();
    triggerSync();

    // 如果完成了专注阶段，自动开始休息
    if (!wasBreak && state.settings.auto_start_break) {
      setTimeout(() => get().startBreak(), 500);
    }
  },

  skipBreak: async () => {
    const state = get();
    if (state.phase !== 'break' || !state.session) return;

    if (state._intervalId) {
      clearInterval(state._intervalId);
    }

    try {
      await pomodoroService.cancelPomodoro(state.session.id);
    } catch (e) {
      console.error('Failed to skip break:', e);
      set({ lastError: '跳过休息失败，请重试' });
      return;
    }

    set({
      session: null,
      phase: 'idle',
      isPaused: false,
      elapsedSeconds: 0,
      targetSeconds: 0,
      _intervalId: null,
      _startTimestamp: 0,
      _pausedElapsed: 0,
    });
  },

  // 内部方法：启动 setInterval
  _startInterval: () => {
    const state = get();
    if (state._intervalId) {
      clearInterval(state._intervalId as number);
    }

    const id = window.setInterval(() => {
      const s = get();
      if (s.isPaused) return;

      const now = Date.now();
      const elapsed = s._pausedElapsed + Math.floor((now - s._startTimestamp) / 1000);

      if (elapsed >= s.targetSeconds) {
        // 时间到，自动完成
        set({ elapsedSeconds: s.targetSeconds });
        get().complete();
      } else {
        set({ elapsedSeconds: elapsed });
      }
    }, 1000);

    set({ _intervalId: id });
  },
}));
