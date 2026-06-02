import { create } from 'zustand';
import * as memoryService from '@/services/memoryService';
import type { Memory } from '@/types/memory';
import { triggerSync } from '@/stores/syncStore';

interface MemoryState {
  memories: Memory[];
  loading: boolean;
  selectedType: string | null;
  fetchMemories: (type?: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  setSelectedType: (type: string | null) => void;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  memories: [],
  loading: false,
  selectedType: null,

  fetchMemories: async (type?) => {
    set({ loading: true });
    try {
      const memories = await memoryService.listMemories(type ?? undefined);
      set({ memories, loading: false });
    } catch (e) {
      console.error('Failed to fetch memories:', e);
      set({ loading: false });
    }
  },

  deleteMemory: async (id) => {
    const prev = get().memories;
    set({ memories: prev.filter(m => m.id !== id) });
    try {
      await memoryService.deleteMemory(id);
      triggerSync();
    } catch (e) {
      console.error('Failed to delete memory:', e);
      set({ memories: prev }); // 回滚
    }
  },

  setSelectedType: (type) => {
    set({ selectedType: type });
    get().fetchMemories(type ?? undefined);
  },
}));
