import { useMemo, useEffect, useState, useCallback } from 'react';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { useAppTheme } from '@/stores/themeStore';
import { useTaskStore } from '@/stores/taskStore';
import { TaskSummary } from '@/components/dashboard/TaskSummary';
import { ScheduleSummary } from '@/components/dashboard/ScheduleSummary';
import { HabitSummary } from '@/components/dashboard/HabitSummary';
import { BirthdaySummary } from '@/components/dashboard/BirthdaySummary';
import { SkillSummary } from '@/components/dashboard/SkillSummary';
import { DiarySummary } from '@/components/dashboard/DiarySummary';
import { CountdownSummary } from '@/components/dashboard/CountdownSummary';
import { PomodoroCard } from '@/components/pomodoro/PomodoroCard';
import { RecommendCard } from '@/components/dashboard/RecommendCard';
import { useRecommendTask } from '@/hooks/useRecommendTask';

const DAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function DashboardPage() {
  const appTheme = useAppTheme();
  const tasks = useTaskStore((s) => s.tasks);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const [tasksReady, setTasksReady] = useState(false);
  const [, setTasksError] = useState(false);

  const loadTasks = useCallback(() => {
    setTasksReady(false);
    setTasksError(false);
    fetchTasks().then(() => setTasksReady(true)).catch(() => { setTasksError(true); setTasksReady(true); });
  }, [fetchTasks]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const { recommendation, state } = useRecommendTask(tasks);
  const effectiveState = !tasksReady ? 'loading' : state;

  const dateLabel = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekday = DAY_NAMES[now.getDay()];
    return `${month}月${day}日 ${weekday}`;
  }, []);

  return (
    <PageContainer className="flex flex-col !px-0" bgColor={appTheme.canvasParchment}>
      <NavBar title="看板" />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-[800px] mx-auto">
          {/* 日期 */}
          <div className="pt-4 pb-4">
            <h2 className="text-lg font-semibold" style={{ color: appTheme.ink }}>
              {dateLabel}
            </h2>
          </div>

          {/* 推荐任务 */}
          <RecommendCard recommendation={recommendation} state={effectiveState} onRetry={loadTasks} />

          {/* 今日核心：任务 + 日记 */}
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 mb-4">
            <TaskSummary />
            <DiarySummary />
          </div>

          {/* 追踪指标：习惯 / 日历 / 成长 / 番茄钟 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <HabitSummary />
            <ScheduleSummary />
            <SkillSummary />
            <PomodoroCard />
          </div>

          {/* 关注：生日 + 倒数日 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <BirthdaySummary />
            <CountdownSummary />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
