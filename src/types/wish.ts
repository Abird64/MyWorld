/**
 * 心愿系统类型定义
 */

/** 心愿等级 */
export type WishLevel = 1 | 2 | 3 | 4;

/** 心愿状态 */
export type WishStatus = 'active' | 'achieved' | 'archived';

/** 心愿 */
export interface Wish {
  id: string;
  title: string;
  description: string | null;
  level: WishLevel;
  cost_glow: number;
  quantity: number;        // -1 表示无限
  achieved_count: number;
  status: WishStatus;
  achieved_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 心愿等级配置 */
export interface WishLevelConfig {
  level: WishLevel;
  name: string;
  subtitle: string;
  description: string;
  color: string;
  glowColor: string;
  icon: string;
}

/** 抽奖记录 */
export interface WishDraw {
  id: string;
  draw_type: 'micro' | 'shimmer';
  ticket_type: 'micro' | 'shimmer';
  cost: number;
  result_wish_id: string | null;
  result_type: 'wish' | 'none' | 'pity';
  pity_count: number;
  redeemed_at: string | null;
  created_at: string;
}

/** 仓库物品（待核销的中奖记录） */
export interface InventoryItem {
  draw_id: string;
  draw_type: 'micro' | 'shimmer';
  result_type: 'wish' | 'pity';
  pity_count: number;
  created_at: string;
  wish_id: string;
  wish_title: string;
  wish_description: string | null;
  wish_level: WishLevel;
}

/** 萤火余额 */
export interface GlowBalance {
  id: string;
  glow_amount: number;
  micro_tickets: number;
  shimmer_tickets: number;
  updated_at: string;
}

/** 创建心愿输入 */
export interface CreateWishInput {
  title: string;
  description?: string;
  level: WishLevel;
  cost_glow?: number;
  quantity?: number;       // -1 表示无限，默认为1
}

/** 更新心愿输入 */
export interface UpdateWishInput {
  id: string;
  title: string;
  description?: string;
  level: WishLevel;
  cost_glow?: number;
  quantity?: number;
}

/** 抽奖结果 */
export interface DrawResult {
  success: boolean;
  wish: Wish | null;
  is_pity: boolean;
  pity_count: number;
  pity_threshold: number;
  pity_available: boolean;
  message: string;
}

/** 保底进度 */
export interface PityProgress {
  current: number;
  threshold: number;
}

/** 萤火账本条目 */
export interface GlowLedgerEntry {
  id: string;
  asset_type: 'glow' | 'micro_ticket' | 'shimmer_ticket';
  change_amount: number;
  balance_after: number;
  reason: string;
  source_desc: string;
  related_id: string;
  created_at: string;
}

/** 账本查询结果 */
export interface GlowLedgerResult {
  entries: GlowLedgerEntry[];
  total: number;
}

/** 心愿等级列表（类型安全遍历） */
export const WISH_LEVEL_VALUES: readonly WishLevel[] = [1, 2, 3, 4];

/** 心愿等级配置映射 */
export const WISH_LEVELS: Record<WishLevel, WishLevelConfig> = {
  1: {
    level: 1,
    name: '即刻轻享',
    subtitle: '微光池',
    description: '一顿早餐、一杯奶茶、一首喜欢的歌',
    color: '#7EB8A2',
    glowColor: 'rgba(126, 184, 162, 0.3)',
    icon: 'Sparkles',
  },
  2: {
    level: 2,
    name: '生活犒赏',
    subtitle: '微光池',
    description: '一件衣服、一本书、一顿大餐',
    color: '#5A9A9E',
    glowColor: 'rgba(90, 154, 158, 0.3)',
    icon: 'Gift',
  },
  3: {
    level: 3,
    name: '进阶装备',
    subtitle: '拾光池',
    description: '数码设备、家具、课程',
    color: '#C49A6C',
    glowColor: 'rgba(196, 154, 108, 0.3)',
    icon: 'Crown',
  },
  4: {
    level: 4,
    name: '梦想实现',
    subtitle: '拾光池',
    description: '大件、旅行、人生目标',
    color: '#B76E79',
    glowColor: 'rgba(183, 110, 121, 0.3)',
    icon: 'Star',
  },
};

/** 等级名称映射 */
export const WISH_LEVEL_NAMES: Record<WishLevel, string> = {
  1: '即刻轻享',
  2: '生活犒赏',
  3: '进阶装备',
  4: '梦想实现',
};

/** 等级成本建议范围 */
export const WISH_COST_RANGES: Record<WishLevel, { min: number; max: number; label: string }> = {
  1: { min: 10, max: 50, label: '< 一顿早餐' },
  2: { min: 50, max: 200, label: '≈ 一件衣服' },
  3: { min: 200, max: 1000, label: '数码/家具' },
  4: { min: 1000, max: 5000, label: '大件/旅行' },
};
