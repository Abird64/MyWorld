import { Sparkles, Users, Calendar, User } from 'lucide-react';
import { useUIStore, type MainTab } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';

const tabs: { id: MainTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'chat', label: '提灯', icon: Sparkles },
  { id: 'relations', label: '联系人', icon: Users },
  { id: 'schedule', label: '日历', icon: Calendar },
  { id: 'mine', label: '我的', icon: User },
];

export function BottomTabBar() {
  const appTheme = useAppTheme();
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  return (
    <nav
      className="flex-shrink-0 flex items-center safe-bottom"
      style={{
        height: 56,
        backgroundColor: appTheme.canvas,
        borderTop: `0.5px solid ${appTheme.hairline}`,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 btn-press"
          >
            <Icon
              size={22}
              strokeWidth={isActive ? 2 : 1.5}
              style={{ color: isActive ? appTheme.primary : appTheme.inkMuted48 }}
            />
            <span
              className="text-[10px]"
              style={{
                color: isActive ? appTheme.primary : appTheme.inkMuted48,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
