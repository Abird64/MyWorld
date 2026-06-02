import { useEffect } from 'react';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { useSkillStore } from '@/stores/skillStore';
import { SKILL_ORDER } from '@/styles/theme';
import { useAppTheme } from '@/stores/themeStore';
import { LEVEL_TITLES } from '@/utils/dateFormat';
import { AttributeCard } from '@/components/skills/AttributeCard';
import { ActivityHeatmap } from '@/components/skills/ActivityHeatmap';
import { SourceBreakdown } from '@/components/skills/SourceBreakdown';

function getOverallLevel(skills: { level: number }[]): number {
  if (skills.length === 0) return 0;
  return Math.round(skills.reduce((sum, s) => sum + s.level, 0) / skills.length);
}

export function SkillsPage() {
  const appTheme = useAppTheme();
  const { skills, isLoading, activity, sources, fetchSkills, fetchActivity, fetchSources } = useSkillStore();

  useEffect(() => {
    fetchSkills();
    fetchActivity();
    fetchSources();
  }, [fetchSkills, fetchActivity, fetchSources]);

  const totalXp = skills.reduce((sum, s) => sum + s.total_xp, 0);
  const avgLevel = getOverallLevel(skills);
  const title = LEVEL_TITLES[avgLevel] || '超凡';

  // XP progress to next average level
  const nextLevelXp = 100 * avgLevel;
  const currentLevelXp = totalXp - (100 * avgLevel * (avgLevel - 1) / 2);
  const xpProgress = nextLevelXp > 0 ? Math.min(currentLevelXp / (nextLevelXp * skills.length), 1) : 0;

  return (
    <PageContainer>
      <NavBar title="成长" />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
        <div className="max-w-[600px] mx-auto">

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-lg" style={{ color: appTheme.inkMuted48 }}>加载中...</p>
            </div>
          ) : skills.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <p className="text-xl mb-2" style={{ color: appTheme.inkMuted80 }}>成长未启</p>
                <p className="text-sm" style={{ color: appTheme.inkMuted48 }}>完成任务、写日记均可获得属性经验</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8 pt-4">

              {/* ─── Hero 区域 ─── */}
              <div className="text-center">
                <div
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-4"
                  style={{ backgroundColor: appTheme.primary, color: appTheme.onPrimary }}
                >
                  ◈ Lv.{avgLevel}
                </div>
                <div
                  className="text-5xl font-bold tracking-tight"
                  style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
                >
                  {totalXp.toLocaleString()}
                </div>
                <p className="text-base mt-1" style={{ color: appTheme.inkMuted48 }}>经验值</p>
              </div>

              {/* ─── XP 进度条 ─── */}
              <div>
                <div className="flex justify-between text-xs mb-2" style={{ color: appTheme.inkMuted48 }}>
                  <span>Lv.{avgLevel} · {title}</span>
                  <span>{currentLevelXp} / {nextLevelXp * skills.length || totalXp}</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: appTheme.canvasParchment }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${xpProgress * 100}%`,
                      background: `linear-gradient(90deg, ${appTheme.primary}, #5856d6, #af52de)`,
                    }}
                  />
                </div>
              </div>

              {/* ─── 六维属性 ─── */}
              <div>
                <h3 className="text-base font-semibold mb-4" style={{ color: appTheme.ink }}>六维属性</h3>
                <div className="space-y-4">
                  {SKILL_ORDER.map((skillId) => {
                    const skill = skills.find((s) => s.id === skillId);
                    if (!skill) return null;
                    return <AttributeCard key={skillId} skill={skill} />;
                  })}
                </div>
              </div>

              {/* ─── 活跃记录 ─── */}
              <div>
                <h3 className="text-base font-semibold mb-4" style={{ color: appTheme.ink }}>活跃记录</h3>
                <div className="rounded-2xl p-4" style={{ backgroundColor: appTheme.canvasParchment }}>
                  <ActivityHeatmap activity={activity} />
                </div>
              </div>

              {/* ─── 经验来源 ─── */}
              <div>
                <h3 className="text-base font-semibold mb-4" style={{ color: appTheme.ink }}>经验来源</h3>
                <SourceBreakdown sources={sources} />
              </div>

            </div>
          )}

          <div className="h-16" />
        </div>
      </div>
    </PageContainer>
  );
}
