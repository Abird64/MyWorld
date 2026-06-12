import type { LucideIcon } from 'lucide-react';
import type { ComponentType, LazyExoticComponent } from 'react';

/** 插件清单：描述一个插件的身份、入口、设置 */
export interface PluginManifest {
  /** 唯一标识，如 'aihot' */
  id: string;
  /** 显示名称 */
  name: string;
  /** 一句话描述 */
  description: string;
  /** Lucide 图标 */
  icon: LucideIcon;
  /** 图标背景色 */
  iconBg: string;
  /** 图标前景色 */
  iconColor: string;
  /** 插件提供的子页面（注册到路由） */
  page: LazyExoticComponent<ComponentType>;
  /** 插件在设置页的配置区块（可选） */
  settingsComponent?: LazyExoticComponent<ComponentType>;
}
