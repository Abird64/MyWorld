import { create } from 'zustand';
import type { Journal, ExtractedContact } from '@/types/journal';
import type { CompleteResult } from '@/types/task';
import * as journalService from '@/services/journalService';
import * as contactService from '@/services/contactService';
import type { DailyReflectionResult } from '@/services/journalService';

interface JournalState {
  // 当前日记状态
  currentDate: string;
  journal: Journal | null;
  content: string;

  // AI 日记
  aiContent: string;
  aiExists: boolean;

  // 时间线
  timelineYear: number;
  timelineMonth: number;
  timelineEntries: string[];
  showTimeline: boolean;

  // AI 面板
  showAiPanel: boolean;

  // 日省面板
  showReflectionPanel: boolean;
  contacts: ExtractedContact[];
  reflectionMood: string | null;
  reflectionTags: string | null;

  // 状态
  isLoading: boolean;
  isSaving: boolean;
  isReflecting: boolean;
  lastSaved: number | null;
  error: string | null;
  xpResult: CompleteResult | null;

  // 操作
  setCurrentDate: (date: string) => Promise<void>;
  updateContent: (content: string) => void;
  saveNow: () => Promise<void>;
  loadToday: () => Promise<void>;

  // 时间线
  toggleTimeline: () => void;
  navigateMonth: (delta: number) => Promise<void>;
  fetchTimelineEntries: (year: number, month: number) => Promise<void>;

  // AI 面板
  toggleAiPanel: () => void;
  fetchAiDiary: () => Promise<void>;

  // 日记 XP 结算 + AI 反思
  completeDiary: () => Promise<DailyReflectionResult | null>;

  // 联系人同步
  removeContact: (index: number) => void;
  confirmAllContacts: () => void;
  setShowReflectionPanel: (show: boolean) => void;
}

function getToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getYearMonth(date: string): [number, number] {
  const [y, m] = date.split('-').map(Number);
  return [y, m];
}

// 模块级自动保存计时器（不进入 Zustand state，避免序列化问题）
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useJournalStore = create<JournalState>((set, get) => {
  const today = getToday();
  const [year, month] = getYearMonth(today);

  return {
    currentDate: today,
    journal: null,
    content: '',
    aiContent: '',
    aiExists: false,
    timelineYear: year,
    timelineMonth: month,
    timelineEntries: [],
    showTimeline: false,
    showAiPanel: false,
    showReflectionPanel: false,
    contacts: [],
    reflectionMood: null,
    reflectionTags: null,
    isLoading: false,
    isSaving: false,
    isReflecting: false,
    lastSaved: null,
    error: null,
    xpResult: null,

    setCurrentDate: async (date: string) => {
      // 切换前先保存当前内容
      if (_saveTimer) {
        clearTimeout(_saveTimer);
        _saveTimer = null;
      }

      set({ isLoading: true, currentDate: date, error: null });
      try {
        const entry = await journalService.getJournalByDate(date);
        const [y, m] = getYearMonth(date);
        set({
          journal: entry.journal,
          content: entry.content,
          isLoading: false,
          timelineYear: y,
          timelineMonth: m,
        });
      } catch (e) {
        set({ error: String(e), isLoading: false, content: '', journal: null });
      }
    },

    updateContent: (content: string) => {
      const { currentDate } = get();
      set({ content });

      // 清除已有计时器
      if (_saveTimer) clearTimeout(_saveTimer);

      // 1.5s 后自动保存
      _saveTimer = setTimeout(async () => {
        set({ isSaving: true });
        try {
          const journal = await journalService.saveJournal(currentDate, content);
          set({ journal, isSaving: false, lastSaved: Date.now() });
        } catch (e) {
          set({ error: String(e), isSaving: false });
        }
      }, 1500);
    },

    saveNow: async () => {
      if (_saveTimer) {
        clearTimeout(_saveTimer);
        _saveTimer = null;
      }

      const { currentDate, content } = get();
      set({ isSaving: true });
      try {
        const journal = await journalService.saveJournal(currentDate, content);
        set({ journal, isSaving: false, lastSaved: Date.now() });
      } catch (e) {
        set({ error: String(e), isSaving: false });
      }
    },

    loadToday: async () => {
      const today = getToday();
      await get().setCurrentDate(today);
    },

    toggleTimeline: () => {
      const { showTimeline, timelineYear, timelineMonth } = get();
      if (!showTimeline) {
        // 打开时间线时刷新当月数据
        get().fetchTimelineEntries(timelineYear, timelineMonth);
      }
      set({ showTimeline: !showTimeline });
    },

    navigateMonth: async (delta: number) => {
      const { timelineYear, timelineMonth } = get();
      let newMonth = timelineMonth + delta;
      let newYear = timelineYear;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      } else if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      set({ timelineYear: newYear, timelineMonth: newMonth });
      await get().fetchTimelineEntries(newYear, newMonth);
    },

    fetchTimelineEntries: async (year: number, month: number) => {
      try {
        const entries = await journalService.getTimeline(year, month);
        set({ timelineEntries: entries });
      } catch (e) {
        set({ error: String(e) });
      }
    },

    toggleAiPanel: async () => {
      const { showAiPanel, currentDate } = get();
      if (showAiPanel) {
        set({ showAiPanel: false });
      } else {
        set({ showAiPanel: true });
        // 加载 AI 日记
        try {
          const ai = await journalService.getAiDiary(currentDate);
          set({ aiContent: ai.content, aiExists: ai.exists });
        } catch (e) {
          set({ aiContent: '', aiExists: false });
        }
      }
    },

    fetchAiDiary: async () => {
      const { currentDate } = get();
      try {
        const ai = await journalService.getAiDiary(currentDate);
        set({ aiContent: ai.content, aiExists: ai.exists });
      } catch (e) {
        set({ error: String(e) });
      }
    },

    completeDiary: async () => {
      const { currentDate } = get();
      set({ isReflecting: true, error: null });
      try {
        const result = await journalService.dailyReflection(currentDate);
        set({
          xpResult: result.xp_result,
          aiContent: result.reflection,
          aiExists: !!result.reflection,
          contacts: result.contacts || [],
          reflectionMood: result.mood,
          reflectionTags: result.tags,
          isReflecting: false,
          showReflectionPanel: true,
        });
        return result;
      } catch (e) {
        set({ error: String(e), isReflecting: false });
        return null;
      }
    },

    removeContact: (index: number) => {
      const { contacts } = get();
      set({ contacts: contacts.filter((_, i) => i !== index) });
    },

    confirmAllContacts: async () => {
      const { contacts } = get();
      for (const c of contacts) {
        if (c.existing_contact_id) {
          await contactService.updateContact(c.existing_contact_id, {
            notes: `[${new Date().toISOString().slice(0, 10)}] ${c.event_summary}`,
          });
        } else {
          await contactService.createContact({
            name: c.name,
            notes: c.event_summary,
          });
        }
      }
      set({ contacts: [] });
    },

    setShowReflectionPanel: (show: boolean) => {
      set({ showReflectionPanel: show });
    },
  };
});
