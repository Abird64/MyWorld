import { useUIStore } from '@/stores/uiStore';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import {
  HomePage,
  TasksPage,
  SchedulePage,
  DiaryPage,
  RelationsPage,
  HabitsPage,
  SkillsPage,
  SettingsPage,
} from '@/pages';
import { MinePage } from '@/pages/Mine';
import '@/styles/global.css';

function App() {
  const { activeTab, activeSubPage } = useUIStore();

  const renderSubPage = () => {
    switch (activeSubPage) {
      case 'tasks': return <TasksPage />;
      case 'diary': return <DiaryPage />;
      case 'habits': return <HabitsPage />;
      case 'skills': return <SkillsPage />;
      case 'settings': return <SettingsPage />;
      default: return null;
    }
  };

  const renderPage = () => {
    // 子页面优先
    if (activeSubPage) return renderSubPage();

    switch (activeTab) {
      case 'chat': return <HomePage />;
      case 'relations': return <RelationsPage />;
      case 'schedule': return <SchedulePage />;
      case 'mine': return <MinePage />;
      default: return <HomePage />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        {renderPage()}
      </div>
      <BottomTabBar />
    </div>
  );
}

export default App;
