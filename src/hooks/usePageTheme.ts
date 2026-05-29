import { themes, type PageTheme } from '@/styles/theme';

/** 统一返回 Apple 风格主题，忽略 pageId */
export function usePageTheme(_pageId: string): PageTheme {
  return themes.lantern;
}
