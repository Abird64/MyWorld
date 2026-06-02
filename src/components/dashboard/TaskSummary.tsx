import { useEffect } from 'react';
import { ListTodo } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { DashboardCard } from './DashboardCard';

export function TaskSummary() {
  const appTheme = useAppTheme();
  const { tasks, fetchTasks } = useTaskStore();
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);

  useEffect(() => {
    fetchTasks();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const todayTasks = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled' && t.scheduled_at?.slice(0, 10) === today
  );
  const overdueTasks = tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      t.status !== 'cancelled' &&
      t.deadline &&
      new Date(t.deadline) < now
  );

  return (
    <DashboardCard
      title="任务"
      icon={ListTodo}
      color="#5856d6"
      onClick={() => setActiveSubPage('tasks')}
    >
      <div className="flex items-end justify-between">
        <div>
          <span
            className="text-2xl font-bold"
            style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
          >
            {todayTasks.length}
          </span>
          <span className="text-xs ml-1" style={{ color: appTheme.inkMuted48 }}>今日待办</span>
        </div>
        {overdueTasks.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fff0f0', color: '#ff3b30' }}>
            {overdueTasks.length} 逾期
          </span>
        )}
      </div>
    </DashboardCard>
  );
}
