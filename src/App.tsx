import { useEffect, useState, Suspense, lazy, createElement } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { usePluginStore } from '@/stores/pluginStore';
import { useSettingStore } from '@/stores/settingStore';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { aihotPlugin } from '@/plugins/aihot';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useKeyboardAware } from '@/hooks/useKeyboardAware';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { PomodoroBar } from '@/components/pomodoro/PomodoroBar';
import { PomodoroTimer } from '@/components/pomodoro/PomodoroTimer';

const HomePage = lazy(() => import('@/pages/Home').then(m => ({ default: m.HomePage })));
const TasksPage = lazy(() => import('@/pages/Tasks').then(m => ({ default: m.TasksPage })));
const SchedulePage = lazy(() => import('@/pages/Schedule').then(m => ({ default: m.SchedulePage })));
const DiaryPage = lazy(() => import('@/pages/Diary').then(m => ({ default: m.DiaryPage })));
const RelationsPage = lazy(() => import('@/pages/Relations').then(m => ({ default: m.RelationsPage })));
const HabitsPage = lazy(() => import('@/pages/Habits').then(m => ({ default: m.HabitsPage })));
const SkillsPage = lazy(() => import('@/pages/Skills').then(m => ({ default: m.SkillsPage })));
const SettingsPage = lazy(() => import('@/pages/Settings').then(m => ({ default: m.SettingsPage })));
const DashboardPage = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.DashboardPage })));
const MemoriesPage = lazy(() => import('@/pages/Memories').then(m => ({ default: m.MemoriesPage })));
const MeditationPage = lazy(() => import('@/pages/Meditation').then(m => ({ default: m.MeditationPage })));
const WishesPage = lazy(() => import('@/pages/Wishes').then(m => ({ default: m.WishesPage })));
const MinePage = lazy(() => import('@/pages/Mine').then(m => ({ default: m.MinePage })));

import '@/styles/global.css';

const PageFallback = () => (
  <div className="h-full flex items-center justify-center" style={{ opacity: 0.3 }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
    </svg>
  </div>
);

function App() {
  const { activeTab, activeSubPage, goBack } = useUIStore();
  const isMobile = useIsMobile();
  const { restoreSession, fetchSettings, fetchStats } = usePomodoroStore();

  useKeyboardAware();
  const [showTimer, setShowTimer] = useState(false);
  const registerPlugin = usePluginStore((s) => s.register);
  const loadSettings = useSettingStore((s) => s.loadAll);

  // 注册插件 + 加载设置
  useEffect(() => {
    registerPlugin(aihotPlugin);
    loadSettings();
  }, [registerPlugin, loadSettings]);

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
      onBackButtonPress((_payload) => {
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

  const plugins = usePluginStore((s) => s.plugins);

  const renderSubPage = () => {
    // 内置页面
    switch (activeSubPage) {
      case 'tasks': return <TasksPage />;
      case 'diary': return <DiaryPage />;
      case 'habits': return <HabitsPage />;
      case 'skills': return <SkillsPage />;
      case 'relations': return <RelationsPage />;
      case 'memories': return <MemoriesPage />;
      case 'meditation': return <MeditationPage />;
      case 'wishes': return <WishesPage />;
      case 'settings': return <SettingsPage />;
      default: break;
    }
    // 插件页面
    if (activeSubPage && plugins[activeSubPage]) {
      return createElement(plugins[activeSubPage].page);
    }
    return null;
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
    <div className="app-root flex flex-col overflow-hidden">
      {!isMobile && <PomodoroBar onClick={() => setShowTimer(true)} />}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<PageFallback />}>
          {renderPage()}
        </Suspense>
      </div>
      <BottomTabBar onPomodoroClick={() => setShowTimer(true)} />
      <PomodoroTimer open={showTimer} onClose={() => setShowTimer(false)} />
    </div>
  );
}

export default App;
