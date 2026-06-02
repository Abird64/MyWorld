export interface PomodoroSession {
  id: string;
  task_id: string | null;
  session_type: 'focus' | 'break';
  target_minutes: number;
  actual_seconds: number;
  status: 'running' | 'completed' | 'cancelled';
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StartPomodoroInput {
  task_id?: string;
  session_type?: string;
  target_minutes?: number;
}

export interface PomodoroStats {
  focus_count: number;
  focus_seconds: number;
  break_count: number;
}

export interface PomodoroSettings {
  focus_minutes: number;
  break_minutes: number;
  long_break_minutes: number;
  auto_start_break: boolean;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focus_minutes: 25,
  break_minutes: 5,
  long_break_minutes: 15,
  auto_start_break: false,
};
