/**
 * 分类图标映射 — 将存储的图标名映射到 lucide-react 组件
 */
import {
  Zap, CheckSquare, BookOpen, Quote, FolderOpen, Brain,
  Lightbulb, PenLine, Star, Heart, Music, Coffee,
  Code, Globe, Camera, MessageCircle, type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  'zap': Zap,
  'check-square': CheckSquare,
  'book-open': BookOpen,
  'quote': Quote,
  'folder-open': FolderOpen,
  'brain': Brain,
  'lightbulb': Lightbulb,
  'pen-line': PenLine,
  'star': Star,
  'heart': Heart,
  'music': Music,
  'coffee': Coffee,
  'code': Code,
  'globe': Globe,
  'camera': Camera,
  'message-circle': MessageCircle,
};

export const AVAILABLE_ICONS = Object.keys(CATEGORY_ICON_MAP);

export function getCategoryIcon(iconName: string): LucideIcon {
  return CATEGORY_ICON_MAP[iconName] || Lightbulb;
}
