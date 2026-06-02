import type { Skill } from '@/types/skill';
import { SKILL_COLORS } from '@/styles/theme';
import { useAppTheme, withAlpha } from '@/stores/themeStore';

interface AttributeCardProps {
  skill: Skill;
}

const LEVEL_TITLES: Record<number, string> = {
  1: '入门', 2: '初窥', 3: '略懂',
  4: '通晓', 5: '精熟', 6: '专深',
  7: '卓越', 8: '宗师', 9: '入圣',
  10: '化境',
};

const ATTR_ICONS: Record<string, string> = {
  focus: '☉',
  vitality: '❋',
  creativity: '◆',
  insight: '✦',
  empathy: '♡',
  expression: '✧',
};

function getLevelInfo(totalXp: number, level: number) {
  const xpAtLevelStart = 100 * level * (level - 1) / 2;
  const xpForNextLevel = 100 * level;
  const currentLevelXp = totalXp - xpAtLevelStart;
  const progress = Math.min(currentLevelXp / xpForNextLevel, 1);
  return { level, currentXp: currentLevelXp, xpToNext: xpForNextLevel - currentLevelXp, progress };
}

export function AttributeCard({ skill }: AttributeCardProps) {
  const appTheme = useAppTheme();
  const info = SKILL_COLORS[skill.id];
  const color = info?.hex || '#888';
  const name = info?.name || skill.name;
  const icon = ATTR_ICONS[skill.id] || '●';
  const { level, currentXp, progress } = getLevelInfo(skill.total_xp, skill.level);
  const title = LEVEL_TITLES[level] || '超凡';

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
        style={{ backgroundColor: `${withAlpha(color, 0.13)}`, color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm font-medium" style={{ color: appTheme.ink }}>{name}</span>
          <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>
            Lv.{level} · {title} · {currentXp}/{100 * level} XP
          </span>
        </div>
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.08)}` }}>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress * 100}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}
