import type { PluginManifest } from '@/types/plugin';
import { aihotPlugin } from './aihot';

/** 所有已注册插件 — 新增插件在此处导入并加入数组即可 */
export const allPlugins: PluginManifest[] = [
  aihotPlugin,
];
