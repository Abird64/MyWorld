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
    } catch {
      set({ loading: false });
    }
  },

  deleteMemory: async (id) => {
    await memoryService.deleteMemory(id);
    set({ memories: get().memories.filter(m => m.id !== id) });
    triggerSync();
  },

  setSelectedType: (type) => {
    set({ selectedType: type });
    get().fetchMemories(type ?? undefined);
  },
}));
