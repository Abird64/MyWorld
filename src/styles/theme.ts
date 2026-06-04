/**
 * 提灯 (Lantern) - 设计系统
 *
 * 夜萤设计语言：深色默认、萤火绿主色、毛玻璃分层、呼吸感动效。
 * 详见 DESIGN.md
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

export interface AppThemeHelpers {
  /** 返回基于 ink 色的半透明 rgba 字符串，适配深浅色模式 */
  rgba: (opacity: number) => string;
  /** 给任意颜色附加透明度（支持 hex 和 rgba） */
  withAlpha: (color: string, alpha: number) => string;
}

/** 浅色主题（清晨） */
export const appThemeLight: AppTheme = {
  primary: '#2D6B4F',
  primaryFocus: '#3A7D5F',
  primaryOnDark: '#4CAF76',
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

/** 深色主题（夜萤）— 默认 */
export const appThemeDark: AppTheme = {
  primary: '#4CAF76',
  primaryFocus: '#5BBF86',
  primaryOnDark: '#4CAF76',
  ink: 'rgba(255,255,255,0.88)',
  canvas: '#0F1412',
  canvasParchment: '#141A17',
  surfacePearl: 'rgba(255,255,255,0.04)',
  surfaceDark: 'rgba(255,255,255,0.07)',
  surfaceDark2: 'rgba(255,255,255,0.10)',
  surfaceDark3: 'rgba(255,255,255,0.13)',
  surfaceBlack: '#0A0E0C',
  onPrimary: '#ffffff',
  onDark: 'rgba(255,255,255,0.88)',
  bodyMuted: 'rgba(255,255,255,0.30)',
  inkMuted80: 'rgba(255,255,255,0.50)',
  inkMuted48: 'rgba(255,255,255,0.30)',
  hairline: 'rgba(255,255,255,0.06)',
  divider: 'rgba(255,255,255,0.06)',
  danger: '#C97070',
  success: '#4CAF76',
  warning: '#D4A76A',
};

/** 默认主题（深色/夜萤） */
export const appTheme: AppTheme = appThemeDark;

/** 浅色主题辅助函数 */
export const appThemeLightHelpers: AppThemeHelpers = {
  rgba: (o: number) => `rgba(0,0,0,${o})`,
  withAlpha: (color: string, alpha: number) => withAlpha(color, alpha),
};

/** 深色主题辅助函数 */
export const appThemeDarkHelpers: AppThemeHelpers = {
  rgba: (o: number) => `rgba(255,255,255,${o})`,
  withAlpha: (color: string, alpha: number) => withAlpha(color, alpha),
};

// ========== 颜色工具函数 ==========

/**
 * 给颜色附加透明度（支持 hex 和 rgba 格式）
 * - #1d1d1f + 0.6 → #1d1d1f99
 * - rgba(255,255,255,0.88) + 0.6 → rgba(255,255,255,0.6)
 */
export function withAlpha(color: string, alpha: number): string {
  // 处理 rgba 格式
  const rgbaMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`;
  }
  // 处理 hex 格式（#rgb, #rrggbb, #rrggbbaa）
  const hex = color.replace('#', '');
  let r: string, g: string, b: string;
  if (hex.length === 3) {
    r = hex[0] + hex[0]; g = hex[1] + hex[1]; b = hex[2] + hex[2];
  } else if (hex.length >= 6) {
    r = hex.slice(0, 2); g = hex.slice(2, 4); b = hex.slice(4, 6);
  } else {
    return color; // 无法解析，原样返回
  }
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}${a}`;
}

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
    name: '提灯',
    bg: appTheme.canvas,
    nav: appTheme.surfaceBlack,
    accent: appTheme.primary,
    accentLight: withAlpha(appTheme.primary, 0.2),
    text: appTheme.ink,
    card: appTheme.canvas,
    cardText: appTheme.ink,
    isDark: true,
    danger: appTheme.danger,
    warning: appTheme.warning,
    success: appTheme.success,
  },
  // 保留 key 以防旧代码引用，值都映射到新主题
  tasks: { id: 'tasks', name: '提灯', bg: appTheme.canvas, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: withAlpha(appTheme.primary, 0.2), text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: true, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  diary: { id: 'diary', name: '提灯', bg: appTheme.canvasParchment, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: withAlpha(appTheme.primary, 0.2), text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: true, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  schedule: { id: 'schedule', name: '提灯', bg: appTheme.canvas, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: withAlpha(appTheme.primary, 0.2), text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: true, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  relations: { id: 'relations', name: '提灯', bg: appTheme.canvas, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: withAlpha(appTheme.primary, 0.2), text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: true, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  settings: { id: 'settings', name: '设置', bg: appTheme.canvasParchment, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: withAlpha(appTheme.primary, 0.2), text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: true, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  skills: { id: 'skills', name: '提灯', bg: appTheme.canvas, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: withAlpha(appTheme.primary, 0.2), text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: true, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  memories: { id: 'memories', name: '提灯', bg: appTheme.canvasParchment, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: withAlpha(appTheme.primary, 0.2), text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: true, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
  habits: { id: 'habits', name: '提灯', bg: appTheme.canvas, nav: appTheme.surfaceBlack, accent: appTheme.primary, accentLight: withAlpha(appTheme.primary, 0.2), text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink, isDark: true, danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success },
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
  focus:      { hex: '#3A8FB7', name: '专注力' },
  vitality:   { hex: '#4B7F52', name: '生命力' },
  empathy:    { hex: '#C83C3C', name: '共情力' },
  creativity: { hex: '#E8B959', name: '创造力' },
  insight:    { hex: '#B87353', name: '洞察力' },
  expression: { hex: '#8A6DA7', name: '表现力' },
};

export const SKILL_ORDER = ['focus', 'vitality', 'empathy', 'creativity', 'insight', 'expression'];

export const xpColors = {
  focus: SKILL_COLORS.focus.hex,
  creativity: SKILL_COLORS.creativity.hex,
  vitality: SKILL_COLORS.vitality.hex,
};

/** 常用语义色（从 SKILL_COLORS 提取，便于直接引用） */
export const FOCUS_COLOR = SKILL_COLORS.focus.hex;      // #3A8FB7 专注蓝
export const BREAK_COLOR = SKILL_COLORS.vitality.hex;     // #4B7F52 休息绿（复用生命力色）
export const CREATIVITY_COLOR = SKILL_COLORS.creativity.hex; // #E8B959 创造金
export const TASKS_COLOR = '#5856d6';                    // 任务紫（UI 语义色）

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

/** 夜萤圆角系统 */
export const borderRadius = {
  none: '0',
  xs: '5px',
  sm: '8px',
  md: '14px',
  lg: '20px',
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
    xs: '0.625rem',    // 10px
    sm: '0.75rem',     // 12px
    caption: '0.875rem', // 14px
    body: '1.0625rem', // 17px
    md: '1.125rem',    // 18px
    tagline: '1.3125rem', // 21px
    lg: '1.5rem',      // 24px
    lead: '1.75rem',   // 28px
    xl: '2.125rem',    // 34px
    '2xl': '2.5rem',   // 40px
    hero: '3.5rem',    // 56px
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
  borderRadius: 'rounded-[20px]',
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
