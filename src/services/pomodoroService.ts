/**
 * 番茄钟服务 - 封装所有番茄钟相关的 Tauri 命令调用
 */
import { tauriInvoke } from './tauri';
import type { PomodoroSession, StartPomodoroInput, PomodoroStats } from '@/types/pomodoro';

/** 启动番茄钟 */
export async function startPomodoro(input: StartPomodoroInput): Promise<PomodoroSession> {
  return tauriInvoke<PomodoroSession>('start_pomodoro', { input });
}

/** 完成番茄钟 */
export async function completePomodoro(sessionId: string, actualSeconds: number): Promise<PomodoroSession> {
  return tauriInvoke<PomodoroSession>('complete_pomodoro', {
    input: { session_id: sessionId, actual_seconds: actualSeconds },
  });
}

/** 取消番茄钟 */
export async function cancelPomodoro(sessionId: string): Promise<PomodoroSession> {
  return tauriInvoke<PomodoroSession>('cancel_pomodoro', {
    input: { session_id: sessionId },
  });
}

/** 获取当前运行中的番茄钟 */
export async function getActivePomodoro(): Promise<PomodoroSession | null> {
  return tauriInvoke<PomodoroSession | null>('get_active_pomodoro');
}

/** 获取今日番茄钟统计 */
export async function getPomodoroStats(): Promise<PomodoroStats> {
  return tauriInvoke<PomodoroStats>('get_pomodoro_stats');
}
