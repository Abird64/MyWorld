import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  /** 保留 store 以备未来 dark mode 扩展 */
  isDark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      toggle: () => set((s) => ({ isDark: !s.isDark })),
    }),
    { name: 'shijie-theme' },
  ),
);
