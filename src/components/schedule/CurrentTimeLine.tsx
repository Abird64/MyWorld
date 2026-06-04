import { HOUR_START, HOUR_END, hourToPercent } from '@/utils/scheduleLayout';

/** 当前时间指示线 — 萤火绿微光，非刺眼红线 */
export function CurrentTimeLine() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;

  if (hour < HOUR_START || hour > HOUR_END) return null;

  const top = hourToPercent(hour);

  return (
    <div
      className="absolute w-full left-0 z-20 pointer-events-none"
      style={{ top: `${top}%` }}
    >
      {/* 发光线 */}
      <div
        className="w-full h-[2px] firefly-glow"
        style={{ backgroundColor: 'rgba(76, 175, 118, 0.7)' }}
      />
      {/* 萤火光点 */}
      <div
        className="absolute -left-1 -top-[5px] w-3 h-3 rounded-full firefly-glow"
        style={{ backgroundColor: 'rgba(76, 175, 118, 0.9)' }}
      />
    </div>
  );
}
