import { useEffect } from 'react';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { useSkillStore } from '@/stores/skillStore';
import { SKILL_ORDER } from '@/styles/theme';
import { appTheme } from '@/styles/theme';
import { RadarChart } from '@/components/skills/RadarChart';
import { AttributeCard } from '@/components/skills/AttributeCard';
import { TitleSummary } from '@/components/skills/TitleSummary';


export function SkillsPage() {
  const { skills, isLoading, fetchSkills } = useSkillStore();

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  return (
    <PageContainer className="relative">
      <NavBar title="修为" />

      {/* 主内容 */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 sm:px-8 pb-8">
        <div className="h-8" />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-lg" style={{ color: appTheme.inkMuted48 }}>加载中...</p>
          </div>
        ) : skills.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-xl mb-2" style={{ color: appTheme.inkMuted80 }}>修为未启</p>
              <p className="text-sm" style={{ color: appTheme.inkMuted48 }}>完成任务、写日记均可获得属性经验</p>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-[1000px] space-y-8">
            {/* 第一行：雷达图 + 属性卡片 */}
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              {/* 左侧：雷达图 */}
              <div className="flex-shrink-0 pt-4 mx-auto sm:mx-0">
                <RadarChart skills={skills} size={240} />
              </div>

              {/* 右侧：六维属性卡片 */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SKILL_ORDER.map((skillId) => {
                  const skill = skills.find((s) => s.id === skillId);
                  if (!skill) return null;
                  return <AttributeCard key={skillId} skill={skill} />;
                })}
              </div>
            </div>

            {/* 第二行：称号总览 */}
            <TitleSummary skills={skills} />
          </div>
        )}

        <div className="h-24" />
      </div>

    </PageContainer>
  );
}
