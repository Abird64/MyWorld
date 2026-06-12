import { create } from 'zustand';

export type MainTab = 'chat' | 'dashboard' | 'schedule' | 'mine';
/** 内置子页面 + 插件子页面（插件 id 作为 SubPage 值） */
export type SubPage = string | null;

interface UIState {
  activeTab: MainTab;
  activeSubPage: SubPage;
  setActiveTab: (tab: MainTab) => void;
  setActiveSubPage: (page: SubPage) => void;
  goBack: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'chat',
  activeSubPage: null,
  setActiveTab: (tab) => set({ activeTab: tab, activeSubPage: null }),
  setActiveSubPage: (page) => set({ activeSubPage: page }),
  goBack: () => set({ activeSubPage: null }),
}));
