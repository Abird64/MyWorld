import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appThemeLight, appThemeDark, appThemeLightHelpers, appThemeDarkHelpers, type AppTheme, type AppThemeHelpers } from '@/styles/theme';

type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'light',
      setMode: (mode) => {
        set({ mode });
        applyBodyClass(mode);
      },
    }),
    {
      name: 'shijie-theme',
      onRehydrateStorage: () => (state) => {
        // 页面加载时恢复 body class
        if (state?.mode === 'dark') {
          document.body.classList.add('dark');
        }
      },
    },
  ),
);

function applyBodyClass(mode: ThemeMode) {
  if (mode === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
}

/** 获取当前主题对象 — 在组件中使用 */
export function useAppTheme(): AppTheme {
  const mode = useThemeStore((s) => s.mode);
  return mode === 'dark' ? appThemeDark : appThemeLight;
}

/** 获取主题模式和切换函数 — 在设置页面使用 */
export function useThemeMode() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  return { mode, setMode };
}

/** 获取主题辅助函数（如 rgba）— 在组件中使用 */
export function useThemeHelpers(): AppThemeHelpers {
  const mode = useThemeStore((s) => s.mode);
  return mode === 'dark' ? appThemeDarkHelpers : appThemeLightHelpers;
}
