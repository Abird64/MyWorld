/**
 * MyWorld - 设计系统
 *
 * Apple-inspired design tokens: single accent (#0066cc),
 * system-ui typography, 8px spacing grid, pill buttons.
 */

// ========== 新主题系统 ==========

export interface AppTheme {
  primary: string;
  primaryFocus: string;
  primaryOnDark: string;
  ink: string;
  canvas: string;
  canvasParchment: string;
  surfacePearl: string;
  surfaceDark: string;
  surfaceDark2: string;
  surfaceDark3: string;
  surfaceBlack: string;
  onPrimary: string;
  onDark: string;
  bodyMuted: string;
  inkMuted80: string;
  inkMuted48: string;
  hairline: string;
  divider: string;
  danger: string;
  success: string;
  warning: string;
}

/** 统一的 Apple 风格主题 */
export const appTheme: AppTheme = {
  primary: '#0066cc',
  primaryFocus: '#0071e3',
  primaryOnDark: '#2997ff',
  ink: '#1d1d1f',
  canvas: '#ffffff',
  canvasParchment: '#f5f5f7',
  surfacePearl: '#fafafc',
  surfaceDark: '#272729',
  surfaceDark2: '#2a2a2c',
  surfaceDark3: '#252527',
  surfaceBlack: '#000000',
  onPrimary: '#ffffff',
  onDark: '#ffffff',
  bodyMuted: '#cccccc',
  inkMuted80: '#333333',
  inkMuted48: '#7a7a7a',
  hairline: '#e0e0e0',
  divider: '#f0f0f0',
  danger: '#ff3b30',
  success: '#34c759',
  warning: '#ff9500',
};

// ========== 兼容旧接口 ==========
// 保留旧 PageTheme 以支持渐进迁移，由 usePageTheme 提供映射值

export interface PageTheme {
  id: string;
  name: string;
  bg: string;
  nav: string;
  accent: string;
  accentLight: string;
  text: string;
  card: string;
  cardText: string;
  isDark: boolean;
  danger: string;
  warning: string;
  success: string;
}

/** 旧主题兼容映射 — 所有页面统一使用新主题 */
export const themes: Record<string, PageTheme> = {
  lantern: {
    id: 'lantern',
    name: '拾阶',
    bg: appTheme.canvas,
    nav: appTheme.surfaceBlack,
    accent: appTheme.primary,
    accentLight: appTheme.primary + '33',
    text: appTheme.ink,
    card: appTheme.canvas,
    cardText: appTheme.ink,
    isDark: false,
    danger: appTheme.danger,
    warning: appTheme.warning,
    success: appTheme.success,
  },
  // 保留 key 以防旧代码引用，值都映射到新主题
  tasks: { id: 'tasks', name: '拾阶', bg: appTheme.canvas, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: appTheme.primary + '33', text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: false, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  diary: { id: 'diary', name: '拾阶', bg: appTheme.canvasParchment, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: appTheme.primary + '33', text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: false, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  schedule: { id: 'schedule', name: '拾阶', bg: appTheme.canvas, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: appTheme.primary + '33', text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: false, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  relations: { id: 'relations', name: '拾阶', bg: appTheme.canvas, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: appTheme.primary + '33', text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: false, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  settings: { id: 'settings', name: '设置', bg: appTheme.canvasParchment, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: appTheme.primary + '33', text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: false, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  skills: { id: 'skills', name: '拾阶', bg: appTheme.canvas, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: appTheme.primary + '33', text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: false, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  memories: { id: 'memories', name: '拾阶', bg: appTheme.canvasParchment, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: appTheme.primary + '33', text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: false, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  habits: { id: 'habits', name: '拾阶', bg: appTheme.canvas, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: appTheme.primary + '33', text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: false, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
};

export const selectableThemes: PageTheme[] = [themes.lantern];

// ========== 主题辅助函数 ==========

/** 返回叠加在主题背景上的半透明颜色 */
export function overlay(theme: PageTheme, opacity: number): string {
  const o = Math.round(opacity * 100) / 100;
  return theme.isDark
    ? `rgba(255,255,255,${o})`
    : `rgba(0,0,0,${o})`;
}

export function gridColor(theme: PageTheme, opacity = 0.08): string {
  return overlay(theme, opacity);
}

// ========== 六维属性颜色 ==========
export interface SkillColorInfo {
  hex: string;
  name: string;
}

export const SKILL_COLORS: Record<string, SkillColorInfo> = {
  knowledge:    { hex: '#3A8FB7', name: '学识' },
  physique:     { hex: '#4B7F52', name: '筋骨' },
  charm:        { hex: '#C83C3C', name: '风华' },
  talent:       { hex: '#E8B959', name: '才情' },
  worldliness:  { hex: '#B87353', name: '入世' },
  cultivation:  { hex: '#8A6DA7', name: '修为' },
};

export const SKILL_ORDER = ['knowledge', 'physique', 'charm', 'talent', 'worldliness', 'cultivation'];

export const xpColors = {
  knowledge: SKILL_COLORS.knowledge.hex,
  talent: SKILL_COLORS.talent.hex,
  physique: SKILL_COLORS.physique.hex,
};

// ========== 设计 Token ==========

/** Apple 风格间距系统 (8px 基准) */
export const spacing = {
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '17px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  section: '80px',
  component: '16px',
};

/** Apple 风格圆角系统 */
export const borderRadius = {
  none: '0',
  xs: '5px',
  sm: '8px',
  md: '11px',
  lg: '18px',
  pill: '9999px',
  full: '9999px',
};

/** Apple 风格字体系统 */
export const typography = {
  fontFamily: {
    display: 'SF Pro Display, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    body: 'SF Pro Text, system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif',
  },
  sizes: {
    xs: '10px',
    sm: '12px',
    caption: '14px',
    body: '17px',
    md: '18px',
    tagline: '21px',
    lg: '24px',
    lead: '28px',
    xl: '34px',
    '2xl': '40px',
    hero: '56px',
  },
  weights: {
    light: '300',
    normal: '400',
    semibold: '600',
  },
  letterSpacing: {
    tight: '-0.374px',
    normal: '0',
    wide: '0.196px',
  },
};

// ========== 导航栏 ==========
export const navbar = {
  height: '44px',
  padding: {
    x: 'px-4 md:px-6 lg:px-8',
  },
};

// ========== 胶囊标签栏 ==========
export const capsuleTab = {
  padding: {
    x: 'px-4 md:px-5',
    y: 'py-1.5 md:py-2',
  },
  minWidth: '60px',
  fontSize: 'text-sm',
  borderRadius: 'rounded-full',
  transition: 'transition-all duration-200',
};

// ========== 卡片 ==========
export const card = {
  borderRadius: 'rounded-[18px]',
  padding: {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  },
  shadows: {
    sm: '',
    md: '',
    lg: '',
  },
};

// ========== 按钮 ==========
export const button = {
  borderRadius: 'rounded-full',
  padding: {
    sm: 'px-3 py-1 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  },
  transition: 'transition-all duration-200',
};

// ========== 窗口控制按钮 ==========
export const windowControls = {
  colors: [
    { id: 0, color: '#28C840', label: '最小化' },
    { id: 1, color: '#FEBC2E', label: '恢复' },
    { id: 2, color: '#FF5F57', label: '关闭' },
  ],
  size: 'w-8 h-8',
  gap: 'gap-3',
};

// ========== 布局容器 ==========
export const container = {
  maxWidth: 'max-w-[980px]',
  padding: {
    x: 'px-4 md:px-6 lg:px-8',
  },
};
