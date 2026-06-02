import { SKILL_COLORS, SKILL_ORDER } from '@/styles/theme';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import type { Skill } from '@/types/skill';

interface RadarChartProps {
  skills: Skill[];
  size?: number;
}

export function RadarChart({ skills, size = 200 }: RadarChartProps) {
  const appTheme = useAppTheme();
  const gridStroke = `${withAlpha(appTheme.ink, 0.12)}`;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const levels = 5;
  const maxLevel = 10;
  const skillCount = SKILL_ORDER.length;

  const totalXp = skills.reduce((sum, s) => sum + s.total_xp, 0);

  const getPoint = (index: number, r: number): [number, number] => {
    const angle = (Math.PI * 2 * index) / skillCount - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const levelRings: [number, number][][] = [];
  for (let l = 1; l <= levels; l++) {
    const r = (radius * l) / levels;
    levelRings.push(SKILL_ORDER.map((_, i) => getPoint(i, r)));
  }

  const dataPoints = SKILL_ORDER.map((skillId, i) => {
    const skill = skills.find((s) => s.id === skillId);
    const level = skill?.level ?? 1;
    const ratio = Math.min(level / maxLevel, 1);
    return getPoint(i, radius * ratio);
  });

  const axisLines = SKILL_ORDER.map((_, i) => getPoint(i, radius));

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {levelRings.map((ring, li) => (
          <polygon
            key={`ring-${li}`}
            points={ring.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={gridStroke}
            strokeWidth="0.5"
          />
        ))}

        {axisLines.map(([x, y], i) => (
          <line
            key={`axis-${i}`}
            x1={cx} y1={cy} x2={x} y2={y}
            stroke={gridStroke}
            strokeWidth="0.5"
          />
        ))}

        <polygon
          points={dataPoints.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="rgba(138,109,167,0.2)"
          stroke="#8A6DA7"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {dataPoints.map(([x, y], i) => (
          <circle key={`dot-${i}`} cx={x} cy={y} r="3" fill={SKILL_COLORS[SKILL_ORDER[i]]?.hex || '#8A6DA7'} />
        ))}

        {axisLines.map((_point, i) => {
          const skillId = SKILL_ORDER[i];
          const info = SKILL_COLORS[skillId];
          const skill = skills.find((s) => s.id === skillId);
          const level = skill?.level ?? 1;
          const angle = (Math.PI * 2 * i) / skillCount - Math.PI / 2;
          const labelR = radius + 22;
          const lx = cx + labelR * Math.cos(angle);
          const ly = cy + labelR * Math.sin(angle);
          return (
            <g key={`label-${i}`}>
              <text
                x={lx} y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fill={info?.hex || '#fff'}
                fontSize="11"
                fontWeight="500"
              >
                Lv.{level}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="text-center -mt-[120px] pointer-events-none relative z-10">
        <div className="text-[28px] font-bold" style={{ color: appTheme.ink }}>{totalXp.toLocaleString()}</div>
        <div className="text-xs" style={{ color: appTheme.inkMuted48 }}>XP</div>
      </div>
    </div>
  );
}
