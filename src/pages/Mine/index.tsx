import { useEffect, useState } from 'react';
import { ListTodo, BookOpen, Repeat, Sparkles, Settings, ChevronRight } from 'lucide-react';
import { useUIStore, type SubPage } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { useSkillStore } from '@/stores/skillStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHabitStore } from '@/stores/habitStore';
import { getJournalCount } from '@/services/journalService';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { Card } from '@/components/ui/Card';

interface MenuItem {
  id: SubPage;
  label: string;
  desc: string;
  icon: typeof ListTodo;
  iconBg: string;
  iconColor: string;
}

const menuGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: '核心功能',
    items: [
      { id: 'tasks', label: '尘事', desc: '任务与待办', icon: ListTodo, iconBg: '#f0f0ff', iconColor: '#5856d6' },
      { id: 'diary', label: '日记', desc: '记录生活，AI 帮你反思', icon: BookOpen, iconBg: '#fff0f3', iconColor: '#ff2d55' },
      { id: 'habits', label: '习惯', desc: '建立好习惯，每日打卡', icon: Repeat, iconBg: '#e8f8e8', iconColor: '#34c759' },
      { id: 'skills', label: '成长', desc: '六维属性与成长数据', icon: Sparkles, iconBg: '#fff8e8', iconColor: '#ff9500' },
    ],
  },
  {
    title: '更多',
    items: [
      { id: 'settings', label: '设置', desc: 'AI 助手、数据管理', icon: Settings, iconBg: '', iconColor: '' },
    ],
  },
];

const LEVEL_TITLES: Record<number, string> = {
  1: '入门', 2: '初窥', 3: '略懂',
  4: '通晓', 5: '精熟', 6: '专深',
  7: '卓越', 8: '宗师', 9: '入圣',
  10: '化境',
};

export function MinePage() {
  const appTheme = useAppTheme();
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);

  const { skills, fetchSkills } = useSkillStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { habits, fetchAll: fetchHabits } = useHabitStore();

  const [journalCount, setJournalCount] = useState(0);

  useEffect(() => {
    fetchSkills();
    fetchTasks('pending');
    fetchHabits();
    getJournalCount().then(setJournalCount).catch(() => {});
  }, [fetchSkills, fetchTasks, fetchHabits]);

  // XP & level
  const totalXp = skills.reduce((sum, s) => sum + s.total_xp, 0);
  const avgLevel = skills.length > 0
    ? Math.round(skills.reduce((sum, s) => sum + s.level, 0) / skills.length)
    : 0;
  const title = LEVEL_TITLES[avgLevel] || '超凡';
  const nextLevelXp = 100 * avgLevel;
  const currentLevelXp = totalXp - (100 * avgLevel * (avgLevel - 1) / 2);
  const xpProgress = nextLevelXp > 0 ? Math.min(currentLevelXp / (nextLevelXp * skills.length || 1), 1) : 0;

  // Quick stats
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const todayHabits = habits.filter((h) => h.checked_today).length;
  const maxStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak)) : 0;

  return (
    <PageContainer className="flex flex-col" bgColor={appTheme.canvasParchment}>
      <NavBar title="我的" />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-4 pb-8">
        <div className="max-w-[800px] mx-auto space-y-5">

          {/* ─── 头部 + 快捷统计 ─── */}
          <Card padding={false}>
            {/* XP 信息 */}
            <div className="px-5 pt-5 pb-4 text-center">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-3"
                style={{ backgroundColor: appTheme.primary, color: '#fff' }}
              >
                ◈ Lv.{avgLevel} · {title}
              </div>
              <div
                className="text-4xl font-bold tracking-tight"
                style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
              >
                {totalXp.toLocaleString()}
              </div>
              <p className="text-xs mt-0.5" style={{ color: appTheme.inkMuted48 }}>经验值</p>

              <div className="mt-4 max-w-[260px] mx-auto">
                <div className="flex justify-between text-xs mb-1" style={{ color: appTheme.inkMuted48 }}>
                  <span>Lv.{avgLevel}</span>
                  <span>{currentLevelXp} / {nextLevelXp * skills.length || totalXp}</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${appTheme.ink}14` }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${xpProgress * 100}%`,
                      background: `linear-gradient(90deg, ${appTheme.primary}, #5856d6)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 快捷统计 */}
            <div
              className="grid grid-cols-4"
              style={{ borderTop: `0.5px solid ${appTheme.hairline}` }}
            >
              {[
                { num: pendingCount, label: '待办任务', page: 'tasks' as SubPage },
                { num: `${todayHabits}/${habits.length}`, label: '今日习惯', page: 'habits' as SubPage },
                { num: journalCount, label: '日记天数', page: 'diary' as SubPage },
                { num: maxStreak, label: '连续打卡', page: 'habits' as SubPage },
              ].map((stat, i) => (
                <button
                  key={stat.label}
                  onClick={() => setActiveSubPage(stat.page)}
                  className="flex flex-col items-center py-3 transition-colors"
                  style={{ borderRight: i < 3 ? `0.5px solid ${appTheme.divider}` : 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = appTheme.canvasParchment)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span
                    className="text-xl font-semibold"
                    style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
                  >
                    {stat.num}
                  </span>
                  <span className="text-xs mt-0.5" style={{ color: appTheme.inkMuted48 }}>{stat.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* ─── 功能列表 ─── */}
          {menuGroups.map((group) => (
            <div key={group.title}>
              <p
                className="text-xs font-medium uppercase tracking-wide mb-1.5 px-1"
                style={{ color: appTheme.inkMuted48 }}
              >
                {group.title}
              </p>
              <Card padding={false}>
                {group.items.map((item, i) => {
                  const Icon = item.icon;
                  const isSettings = item.id === 'settings';
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSubPage(item.id)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 btn-press"
                      style={{
                        borderBottom: i < group.items.length - 1
                          ? `0.5px solid ${appTheme.divider}`
                          : 'none',
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: isSettings ? `${appTheme.ink}0D` : item.iconBg,
                        }}
                      >
                        <Icon
                          size={18}
                          style={{ color: isSettings ? appTheme.inkMuted80 : item.iconColor }}
                        />
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
              </Card>
            </div>
          ))}

        </div>
      </div>
    </PageContainer>
  );
}
