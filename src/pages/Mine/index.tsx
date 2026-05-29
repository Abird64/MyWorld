import { ListTodo, BookOpen, Repeat, Sparkles, Settings, ChevronRight } from 'lucide-react';
import { useUIStore, type SubPage } from '@/stores/uiStore';
import { appTheme } from '@/styles/theme';
import { NavBar } from '@/components/ui';

interface MenuItem {
  id: SubPage;
  label: string;
  desc: string;
  icon: typeof ListTodo;
}

const menuGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: '生活管理',
    items: [
      { id: 'tasks', label: '尘事', desc: '任务与待办', icon: ListTodo },
      { id: 'diary', label: '日记', desc: '每日记录与反思', icon: BookOpen },
      { id: 'habits', label: '习惯', desc: '日常习惯追踪', icon: Repeat },
    ],
  },
  {
    title: '成长',
    items: [
      { id: 'skills', label: '修为', desc: '六维属性与技能', icon: Sparkles },
    ],
  },
  {
    title: '',
    items: [
      { id: 'settings', label: '设置', desc: 'AI 助手、数据管理', icon: Settings },
    ],
  },
];

export function MinePage() {
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: appTheme.canvasParchment }}>
      <NavBar title="我的" navColor={appTheme.surfaceBlack} />

      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-8">
        <div className="max-w-[600px] mx-auto space-y-6">
          {menuGroups.map((group, gi) => (
            <div key={gi}>
              {group.title && (
                <p
                  className="text-xs font-medium uppercase tracking-wide mb-1.5 px-4"
                  style={{ color: appTheme.inkMuted48 }}
                >
                  {group.title}
                </p>
              )}
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  backgroundColor: appTheme.canvas,
                  border: `0.5px solid ${appTheme.hairline}`,
                }}
              >
                {group.items.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSubPage(item.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 btn-press"
                      style={{
                        borderBottom: i < group.items.length - 1
                          ? `0.5px solid ${appTheme.divider}`
                          : 'none',
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: appTheme.primary + '14' }}
                      >
                        <Icon size={18} style={{ color: appTheme.primary }} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-[15px] font-medium" style={{ color: appTheme.ink }}>
                          {item.label}
                        </div>
                        <div className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                          {item.desc}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: appTheme.inkMuted48 }} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
