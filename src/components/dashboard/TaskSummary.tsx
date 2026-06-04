import { useEffect, useState, useCallback } from 'react';
import { ListTodo } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { DashboardCard } from './DashboardCard';

export function TaskSummary() {
  const appTheme = useAppTheme();
  const { tasks, fetchTasks } = useTaskStore();
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchTasks().then(() => setLoading(false)).catch(() => { setError(true); setLoading(false); });
  }, [fetchTasks]);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const todayTasks = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled' && t.scheduled_at?.slice(0, 10) === today
  );
  const todayCompleted = tasks.filter(
    (t) => t.status === 'completed' && t.completed_at?.slice(0, 10) === today
  );
  const overdueTasks = tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      t.status !== 'cancelled' &&
      t.deadline &&
      new Date(t.deadline) < now
  );
  const allDone = todayTasks.length === 0 && todayCompleted.length > 0;

  return (
    <DashboardCard
      title="任务"
      icon={ListTodo}
      color="#5856d6"
      onClick={() => setActiveSubPage('tasks')}
      variant="prominent"
      loading={loading}
      error={error}
      onRetry={load}
    >
      <div className="flex items-end justify-between">
        <div>
          {allDone ? (
            <span className="text-sm font-medium" style={{ color: appTheme.primary }}>
              今天的任务都完成了
            </span>
          ) : (
            <>
              <span
                className="text-2xl font-bold"
                style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
              >
                {todayTasks.length}
              </span>
              <span className="text-xs ml-1" style={{ color: appTheme.inkMuted48 }}>今日待办</span>
              {todayCompleted.length > 0 && (
                <span className="text-xs ml-1" style={{ color: appTheme.inkMuted48 }}>
                  · 已完成 {todayCompleted.length}
                </span>
              )}
            </>
          )}
        </div>
        {overdueTasks.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: withAlpha(appTheme.danger, 0.12), color: appTheme.danger }} role="status" aria-label={`${overdueTasks.length} 个任务逾期`}>
            {overdueTasks.length} 逾期
          </span>
        )}
      </div>
    </DashboardCard>
  );
}
