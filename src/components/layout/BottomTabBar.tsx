import { LayoutDashboard, Calendar, User, type LucideIcon } from 'lucide-react';
import { useUIStore, type MainTab } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { LanternIcon } from '@/components/ui/LanternIcon';
import { PomodoroBar } from '@/components/pomodoro/PomodoroBar';

interface TabDef {
  id: MainTab;
  label: string;
  icon: LucideIcon | typeof LanternIcon;
  isCustom?: boolean;
}

const tabs: TabDef[] = [
  { id: 'chat', label: '提灯', icon: LanternIcon, isCustom: true },
  { id: 'dashboard', label: '看板', icon: LayoutDashboard },
  { id: 'schedule', label: '日历', icon: Calendar },
  { id: 'mine', label: '我的', icon: User },
];

interface BottomTabBarProps {
  onPomodoroClick?: () => void;
}

export function BottomTabBar({ onPomodoroClick }: BottomTabBarProps) {
  const appTheme = useAppTheme();
  const isMobile = useIsMobile();
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  return (
    <nav
      className="flex-shrink-0 safe-bottom"
      style={{
        backgroundColor: appTheme.canvas,
        borderTop: `0.5px solid ${appTheme.hairline}`,
      }}
    >
      {isMobile && onPomodoroClick && (
        <PomodoroBar onClick={onPomodoroClick} />
      )}
      <div className="flex items-center" style={{ height: 56 }}>
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
                color={isActive ? appTheme.primary : appTheme.inkMuted48}
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
      </div>
    </nav>
  );
}
