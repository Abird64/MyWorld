import { create } from 'zustand';
import type { InspirationNote } from '@/types/inspiration';

interface InspirationState {
  notes: InspirationNote[];
  addNote: (note: Omit<InspirationNote, 'id' | 'createdAt' | 'updatedAt'>) => InspirationNote;
  updateNote: (id: string, updates: Partial<InspirationNote>) => void;
  deleteNote: (id: string) => void;
}

export const useInspirationStore = create<InspirationState>((set) => ({
  notes: [],

  addNote: (note) => {
    const now = new Date().toISOString();
    const newNote: InspirationNote = {
      ...note,
      id: `note-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ notes: [newNote, ...state.notes] }));
    return newNote;
  },

  updateNote: (id, updates) => {
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
      ),
    }));
  },

  deleteNote: (id) => {
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
  },
}));
