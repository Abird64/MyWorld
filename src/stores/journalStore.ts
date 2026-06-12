import { create } from 'zustand';
import type { Journal, ExtractedContact, JournalImage } from '@/types/journal';
import type { CompleteResult } from '@/types/task';
import * as journalService from '@/services/journalService';
import * as contactService from '@/services/contactService';
import { triggerSync } from '@/stores/syncStore';
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

  // 日记图片
  images: JournalImage[];
  imageDataCache: Record<string, string>;

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

  // 日记图片
  loadImages: () => Promise<void>;
  uploadImage: (file: File) => Promise<void>;
  deleteImage: (imageId: string) => Promise<void>;
  loadImageData: (imageId: string, filePath: string) => Promise<string>;
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
    images: [],
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

      set({ isLoading: true, currentDate: date, error: null, images: [] });
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
        // 加载图片
        get().loadImages();
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
          triggerSync();
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
        triggerSync();
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
      const today = new Date().toISOString().slice(0, 10);
      for (const c of contacts) {
        if (c.existing_contact_id) {
          // 获取现有备注，追加而非覆盖
          const existing = await contactService.getContact(c.existing_contact_id);
          const prevNotes = existing.notes?.trim();
          const newEntry = `[${today}] ${c.event_summary}`;
          await contactService.updateContact(c.existing_contact_id, {
            notes: prevNotes ? `${prevNotes}\n${newEntry}` : newEntry,
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

    loadImages: async () => {
      const { journal } = get();
      if (!journal) return;
      try {
        const images = await journalService.getJournalImages(journal.id);
        set({ images });
      } catch (e) {
        // 图片加载失败不影响日记功能
        console.error('Failed to load journal images:', e);
      }
    },

    uploadImage: async (file: File) => {
      const { currentDate, journal } = get();
      if (!journal) return;

      set({ error: null });
      try {
        // 读取文件为 Uint8Array
        const buffer = await file.arrayBuffer();
        const data = Array.from(new Uint8Array(buffer));

        const image = await journalService.uploadJournalImage(
          currentDate,
          file.name,
          file.type,
          data,
        );

        set((state) => ({ images: [...state.images, image] }));
        triggerSync();
      } catch (e) {
        set({ error: String(e) });
      }
    },

    // 图片 data URI 缓存（不进持久化）
    imageDataCache: {} as Record<string, string>,
    loadImageData: async (imageId: string, filePath: string) => {
      const { imageDataCache } = get();
      if (imageDataCache[imageId]) return imageDataCache[imageId];
      try {
        const dataUri = await journalService.getJournalImageData(filePath);
        set((state) => ({ imageDataCache: { ...state.imageDataCache, [imageId]: dataUri } }));
        return dataUri;
      } catch (e) {
        console.error('Failed to load image data:', e);
        return '';
      }
    },

    deleteImage: async (imageId: string) => {
      try {
        await journalService.deleteJournalImage(imageId);
        set((state) => ({ images: state.images.filter((img) => img.id !== imageId) }));
        triggerSync();
      } catch (e) {
        set({ error: String(e) });
      }
    },
  };
});
