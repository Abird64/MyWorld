import { Sparkles, Gift, Crown, Star, Plus, Sparkle, Shuffle, TrendingUp, CheckCircle, Edit3, Timer, ShoppingBag } from 'lucide-react';
import type { WishLevel } from '@/types/wish';

export const LEVEL_ICONS: Record<WishLevel, typeof Sparkles> = {
  1: Sparkles,
  2: Gift,
  3: Crown,
  4: Star,
};

export const LEVEL_COLORS: Record<WishLevel, string> = {
  1: '#7EB8A2',
  2: '#5A9A9E',
  3: '#C49A6C',
  4: '#B76E79',
};

export const CARD_BACK_STYLE = {
  background: 'repeating-linear-gradient(45deg, #1a1a1a 0px, #1a1a1a 10px, #2a2a2a 10px, #2a2a2a 20px)',
};

export const REASON_CONFIG = {
  task_complete: { icon: CheckCircle, label: '完成任务', color: '#4CAF50' },
  diary_settle: { icon: Edit3, label: '日记结算', color: '#7EB8A2' },
  pomodoro_focus: { icon: Timer, label: '番茄专注', color: '#D98B58' },
  skill_level_up: { icon: TrendingUp, label: '技能升级', color: '#C49A6C' },
  ai_reward: { icon: Sparkle, label: 'AI 奖励', color: '#B76E79' },
  manual_add: { icon: Plus, label: '手动添加', color: '#5A9A9E' },
  buy_ticket: { icon: ShoppingBag, label: '购买奖券', color: '#E8B959' },
  draw_consume: { icon: Shuffle, label: '抽奖消耗', color: '#9C27B0' },
  redeem_wish: { icon: Star, label: '兑换心愿', color: '#E91E63' },
};
