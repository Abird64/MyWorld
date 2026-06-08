import type { Skill } from '@/types/skill';
import { SKILL_COLORS, SKILL_ORDER } from '@/styles/theme';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useIsMobile } from '@/hooks/useIsMobile';

interface TitleSummaryProps {
  skills: Skill[];
}

const LEVEL_TITLES: Record<number, string> = {
  1: '入门', 2: '初窥', 3: '略懂',
  4: '通晓', 5: '精熟', 6: '专深',
  7: '卓越', 8: '宗师', 9: '入圣',
  10: '化境',
};

export function TitleSummary({ skills }: TitleSummaryProps) {
  const appTheme = useAppTheme();
  const isMobile = useIsMobile();
  const totalLevel = skills.reduce((sum, s) => sum + s.level, 0);
  const totalXp = skills.reduce((sum, s) => sum + s.total_xp, 0);

  let topSkill: Skill | null = null;
  for (const s of skills) {
    if (!topSkill || s.level > topSkill.level || (s.level === topSkill.level && s.total_xp > topSkill.total_xp)) {
      topSkill = s;
    }
  }

  return (
    <div
      className={`rounded-2xl p-6 text-center ${isMobile ? '' : 'backdrop-blur-sm'}`}
      style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.05)}` }}
    >
      <div className="flex items-center justify-center gap-6 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: appTheme.ink }}>{totalLevel}</div>
          <div className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.35)}` }}>等级总和</div>
        </div>
        <div className="w-px h-8" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.1)}` }} />
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: appTheme.ink }}>{totalXp.toLocaleString()}</div>
          <div className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.35)}` }}>总经验值</div>
        </div>
        <div className="w-px h-8" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.1)}` }} />
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: topSkill ? SKILL_COLORS[topSkill.id]?.hex || '#8A6DA7' : '#8A6DA7' }}>
            {topSkill ? SKILL_COLORS[topSkill.id]?.name : '-'}
          </div>
          <div className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.35)}` }}>最高属性</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {SKILL_ORDER.map((skillId) => {
          const skill = skills.find((s) => s.id === skillId);
          const level = skill?.level ?? 1;
          const info = SKILL_COLORS[skillId];
          const title = LEVEL_TITLES[level] || '超凡';
          return (
            <span
              key={skillId}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs"
              style={{
                backgroundColor: (info?.hex || '#888') + '20',
                color: info?.hex || '#fff',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: info?.hex }} />
              {info?.name}·{title}
            </span>
          );
        })}
      </div>
    </div>
  );
}
