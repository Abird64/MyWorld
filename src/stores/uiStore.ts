import { create } from 'zustand';

export type MainTab = 'chat' | 'relations' | 'schedule' | 'mine';
export type SubPage = 'tasks' | 'diary' | 'habits' | 'skills' | 'settings' | null;

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
