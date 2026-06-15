import { create } from 'zustand';

export type MainTab = 'chat' | 'dashboard' | 'schedule' | 'mine';
/** 内置子页面 + 插件子页面（插件 id 作为 SubPage 值） */
export type SubPage = string | null;

/** 聊天引用上下文 — 从外部传入的引用内容 */
export interface ChatContext {
  /** 引用标签，如 "📺 视频字幕" */
  label: string;
  /** 引用内容 */
  content: string;
  /** 来源链接（可选） */
  sourceUrl?: string;
}

interface UIState {
  activeTab: MainTab;
  activeSubPage: SubPage;
  /** 聊天引用上下文 — 从其他页面传入，显示在输入框上方 */
  chatContext: ChatContext | null;
  setActiveTab: (tab: MainTab) => void;
  setActiveSubPage: (page: SubPage) => void;
  setChatContext: (ctx: ChatContext | null) => void;
  goBack: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'chat',
  activeSubPage: null,
  chatContext: null,
  setActiveTab: (tab) => set({ activeTab: tab, activeSubPage: null }),
  setActiveSubPage: (page) => set({ activeSubPage: page }),
  setChatContext: (ctx) => set({ chatContext: ctx }),
  goBack: () => set({ activeSubPage: null }),
}));
