import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { useAppTheme } from '@/stores/themeStore';
import { TaskSummary } from '@/components/dashboard/TaskSummary';
import { ScheduleSummary } from '@/components/dashboard/ScheduleSummary';
import { HabitSummary } from '@/components/dashboard/HabitSummary';
import { BirthdaySummary } from '@/components/dashboard/BirthdaySummary';
import { SkillSummary } from '@/components/dashboard/SkillSummary';
import { DiarySummary } from '@/components/dashboard/DiarySummary';
import { PomodoroCard } from '@/components/pomodoro/PomodoroCard';

export function DashboardPage() {
  const appTheme = useAppTheme();

  return (
    <PageContainer className="flex flex-col" bgColor={appTheme.canvasParchment}>
      <NavBar title="看板" />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
        <div className="max-w-[800px] mx-auto">
          <div className="grid grid-cols-2 gap-3 pt-4">
            <TaskSummary />
            <DiarySummary />
            <ScheduleSummary />
            <HabitSummary />
            <BirthdaySummary />
            <SkillSummary />
            <PomodoroCard />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
