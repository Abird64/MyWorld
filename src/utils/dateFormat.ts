/** 格式化日期为 MM月DD日 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 格式化日期时间为 MM月DD日 HH:MM */
export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${h}:${m}`;
}

/** 判断是否是今天 */
export function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

/** 判断是否在未来 */
export function isFuture(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d > now;
}

/** 判断是否已过期 */
export function isOverdue(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < now;
}

/** 相对时间（今天/昨天/N天前/周前/月前/年月日） */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays === 2) return '前天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

/** 等级称号映射 */
export const LEVEL_TITLES: Record<number, string> = {
  1: '入门', 2: '初窥', 3: '略懂',
  4: '通晓', 5: '精熟', 6: '专深',
  7: '卓越', 8: '宗师', 9: '入圣',
  10: '化境',
};
