import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { PomodoroBar } from '@/components/pomodoro/PomodoroBar';
import { PomodoroTimer } from '@/components/pomodoro/PomodoroTimer';
import {
  HomePage,
  TasksPage,
  SchedulePage,
  DiaryPage,
  RelationsPage,
  HabitsPage,
  SkillsPage,
  SettingsPage,
  DashboardPage,
  MemoriesPage,
} from '@/pages';
import { MinePage } from '@/pages/Mine';
import '@/styles/global.css';

function App() {
  const { activeTab, activeSubPage, goBack } = useUIStore();
  const { phase, restoreSession, fetchSettings, fetchStats } = usePomodoroStore();
  const [showTimer, setShowTimer] = useState(false);

  // 恢复番茄钟会话 + 加载设置
  useEffect(() => {
    fetchSettings();
    restoreSession();
    fetchStats();
  }, [fetchSettings, restoreSession, fetchStats]);

  // 监听番茄钟看板卡片点击
  useEffect(() => {
    const handler = () => setShowTimer(true);
    window.addEventListener('pomodoro-open-timer', handler);
    return () => window.removeEventListener('pomodoro-open-timer', handler);
  }, []);

  // Android 返回键：子页面内按返回键回到主页，而非退出应用
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/app').then(({ onBackButtonPress }) => {
      onBackButtonPress((payload) => {
        if (activeSubPage) {
          goBack();
        } else {
          // 在主页时，允许默认行为（最小化或退出）
          // Tauri 默认会 minimize，这里不阻止
        }
      }).then((listener) => {
        unlisten = listener.unregister;
      });
    });
    return () => { unlisten?.(); };
  }, [activeSubPage, goBack]);

  const renderSubPage = () => {
    switch (activeSubPage) {
      case 'tasks': return <TasksPage />;
      case 'diary': return <DiaryPage />;
      case 'habits': return <HabitsPage />;
      case 'skills': return <SkillsPage />;
      case 'relations': return <RelationsPage />;
      case 'memories': return <MemoriesPage />;
      case 'settings': return <SettingsPage />;
      default: return null;
    }
  };

  const renderPage = () => {
    // 子页面优先
    if (activeSubPage) return renderSubPage();

    switch (activeTab) {
      case 'chat': return <HomePage />;
      case 'dashboard': return <DashboardPage />;
      case 'schedule': return <SchedulePage />;
      case 'mine': return <MinePage />;
      default: return <HomePage />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <PomodoroBar onClick={() => setShowTimer(true)} />
      <div className="flex-1 overflow-hidden">
        {renderPage()}
      </div>
      <BottomTabBar />
      <PomodoroTimer open={showTimer} onClose={() => setShowTimer(false)} />
    </div>
  );
}

export default App;
