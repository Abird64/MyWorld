import type { Skill } from '@/types/skill';
import { SKILL_COLORS, appTheme } from '@/styles/theme';

interface AttributeCardProps {
  skill: Skill;
}

const LEVEL_TITLES: Record<number, string> = {
  1: '入门', 2: '初窥', 3: '略懂',
  4: '通晓', 5: '精熟', 6: '专深',
  7: '卓越', 8: '宗师', 9: '入圣',
  10: '化境',
};

function getLevelInfo(totalXp: number, level: number) {
  const xpAtLevelStart = 100 * level * (level - 1) / 2;
  const xpForNextLevel = 100 * level;
  const currentLevelXp = totalXp - xpAtLevelStart;
  const progress = Math.min(currentLevelXp / xpForNextLevel, 1);
  return { level, currentXp: currentLevelXp, xpToNext: xpForNextLevel - currentLevelXp, progress };
}

export function AttributeCard({ skill }: AttributeCardProps) {
  const info = SKILL_COLORS[skill.id];
  const color = info?.hex || '#888';
  const name = info?.name || skill.name;
  const { level, currentXp, xpToNext, progress } = getLevelInfo(skill.total_xp, skill.level);
  const title = LEVEL_TITLES[level] || '超凡';

  return (
    <div
      className="backdrop-blur-sm rounded-2xl p-5 transition-colors"
      style={{ backgroundColor: `${appTheme.ink}0D` }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${appTheme.ink}14`)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = `${appTheme.ink}0D`)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-lg font-normal" style={{ color: appTheme.ink }}>{name}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold" style={{ color }}>Lv.{level}</span>
          <span className="text-xs ml-1" style={{ color: appTheme.inkMuted48 }}>{title}</span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="w-full h-2.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: `${appTheme.ink}14` }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress * 100}%`, backgroundColor: color }}
        />
      </div>

      <div className="flex justify-between text-xs" style={{ color: `${appTheme.ink}59` }}>
        <span>{currentXp} / {100 * level} XP</span>
        <span>{xpToNext > 0 ? `距下一级 +${xpToNext}XP` : '已满级'}</span>
      </div>
    </div>
  );
}
