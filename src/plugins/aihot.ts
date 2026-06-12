import { lazy } from 'react';
import { Newspaper } from 'lucide-react';
import type { PluginManifest } from '@/types/plugin';

export const aihotPlugin: PluginManifest = {
  id: 'aihot',
  name: 'AI 资讯',
  description: '每日 AI 热点精选与日报',
  icon: Newspaper,
  iconBg: '#fff3e0',
  iconColor: '#FF6B35',
  page: lazy(() => import('@/pages/AiHot').then(m => ({ default: m.AiHotPage }))),
};
