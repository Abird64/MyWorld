import { useEffect, useMemo } from 'react';
import { Users, Settings, ChevronRight, Brain, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { usePluginStore } from '@/stores/pluginStore';
import { useSettingStore } from '@/stores/settingStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useSkillStore } from '@/stores/skillStore';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { LEVEL_TITLES } from '@/utils/dateFormat';
import { Card } from '@/components/ui/Card';

interface MenuItem {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const builtinMenuGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: '功能',
    items: [
      { id: 'meditation', label: '冥想', desc: '呼吸练习，平静心灵', icon: Brain, iconBg: '#e8f5ff', iconColor: '#4CAF76' },
      { id: 'wishes', label: '心愿', desc: '心愿夹与萤火奖券', icon: Heart, iconBg: '#fff0f5', iconColor: '#E8A87C' },
      { id: 'relations', label: '联系人', desc: '人脉管理与生日提醒', icon: Users, iconBg: '#f0f0ff', iconColor: '#5856d6' },
    ],
  },
  {
    title: '更多',
    items: [
      { id: 'settings', label: '设置', desc: 'AI 助手、数据管理', icon: Settings, iconBg: '', iconColor: '' },
    ],
  },
];


export function MinePage() {
  const appTheme = useAppTheme();
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);
  const settings = useSettingStore();
  const plugins = usePluginStore((s) => s.plugins);

  const { skills, fetchSkills } = useSkillStore();

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // XP & level
  const totalXp = skills.reduce((sum, s) => sum + s.total_xp, 0);
  const avgLevel = skills.length > 0
    ? Math.round(skills.reduce((sum, s) => sum + s.level, 0) / skills.length)
    : 0;
  const title = LEVEL_TITLES[avgLevel] || '超凡';
  const nextLevelXp = 100 * avgLevel;
  const currentLevelXp = totalXp - (100 * avgLevel * (avgLevel - 1) / 2);
  const xpProgress = nextLevelXp > 0 ? Math.min(currentLevelXp / (nextLevelXp * skills.length || 1), 1) : 0;

  // 动态菜单：内置 + 已启用的插件
  const menuGroups = useMemo(() => {
    const pluginItems: MenuItem[] = Object.values(plugins)
      .filter((p) => settings.get(`plugin.${p.id}.enabled`, 'true') !== 'false')
      .map((p) => ({
        id: p.id,
        label: p.name,
        desc: p.description,
        icon: p.icon,
        iconBg: p.iconBg,
        iconColor: p.iconColor,
      }));

    const groups = [...builtinMenuGroups];
    if (pluginItems.length > 0) {
      // 插件入口插在"功能"组之后、"更多"组之前
      groups.splice(1, 0, { title: '插件', items: pluginItems });
    }
    return groups;
  }, [plugins, settings]);

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
                style={{ backgroundColor: appTheme.primary, color: appTheme.onPrimary }}
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
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.08)}` }}>
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
                          backgroundColor: isSettings ? `${withAlpha(appTheme.ink, 0.05)}` : item.iconBg,
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
