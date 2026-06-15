/**
 * 纪念日里程碑计算工具
 * 里程碑包括：整百（100,200...）、整年（365,730...）、特殊数字（520,999,1314）
 */

/** 预计算里程碑集合（0～10000天内） */
const MILESTONE_NUMBERS: Set<number> = new Set();

function initMilestones(max: number = 10000): void {
  if (MILESTONE_NUMBERS.size > 0) return;
  // 整百
  for (let i = 100; i <= max; i += 100) MILESTONE_NUMBERS.add(i);
  // 整年（365天）
  for (let i = 365; i <= max; i += 365) MILESTONE_NUMBERS.add(i);
  // 特殊数字
  [520, 999, 1314].forEach((n) => MILESTONE_NUMBERS.add(n));
}

/**
 * 获取下一个里程碑及剩余天数
 * @param daysSince 纪念日已过天数
 * @returns { milestone: 里程碑天数, remaining: 距里程碑还有多少天 } 或 null
 */
export function getNextMilestone(daysSince: number): { milestone: number; remaining: number } | null {
  if (daysSince < 0) return null;
  initMilestones();

  let best: number | null = null;
  for (const m of MILESTONE_NUMBERS) {
    if (m > daysSince && (best === null || m < best)) {
      best = m;
    }
  }
  if (best === null) return null;
  return { milestone: best, remaining: best - daysSince };
}

/**
 * 判断里程碑是否值得关注（30天内）
 */
export function isMilestoneNotable(daysSince: number): boolean {
  const next = getNextMilestone(daysSince);
  return next !== null && next.remaining <= 30;
}

/**
 * 获取里程碑的描述文本
 */
export function getMilestoneLabel(daysSince: number): string | null {
  const next = getNextMilestone(daysSince);
  if (!next || next.remaining > 30) return null;

  // 特殊数字标注
  const specialLabels: Record<number, string> = {
    365: '一周年',
    520: '520',
    730: '两周年',
    999: '999',
    1000: '1000天',
    1095: '三周年',
    1314: '1314',
    1460: '四周年',
    1825: '五周年',
  };
  if (specialLabels[next.milestone]) {
    return `即将${specialLabels[next.milestone]}`;
  }
  if (next.milestone % 365 === 0) {
    return `即将${next.milestone / 365}周年`;
  }
  return `即将${next.milestone}天`;
}
