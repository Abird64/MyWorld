import { create } from 'zustand';
import type { HabitWithStreak, WeekMatrix, CreateHabitInput, UpdateHabitInput } from '@/types/habit';
import * as habitService from '@/services/habitService';

interface HabitState {
  habits: HabitWithStreak[];
  weekMatrix: WeekMatrix[];
  isLoading: boolean;
  error: string | null;

  fetchAll: () => Promise<void>;
  checkHabit: (habitId: string) => Promise<void>;
  uncheckHabit: (habitId: string) => Promise<void>;
  createHabit: (input: CreateHabitInput) => Promise<void>;
  updateHabit: (id: string, input: UpdateHabitInput) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  weekMatrix: [],
  isLoading: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [habits, weekMatrix] = await Promise.all([
        habitService.getAllStreaks(),
        habitService.getWeekMatrix(),
      ]);
      set({ habits, weekMatrix, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  checkHabit: async (habitId) => {
    try {
      await habitService.checkHabit(habitId);
      // 刷新
      await get().fetchAll();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  uncheckHabit: async (habitId) => {
    try {
      await habitService.uncheckHabit(habitId);
      await get().fetchAll();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  createHabit: async (input) => {
    try {
      await habitService.createHabit(input);
      await get().fetchAll();
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  updateHabit: async (id, input) => {
    try {
      await habitService.updateHabit(id, input);
      await get().fetchAll();
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  deleteHabit: async (id) => {
    try {
      await habitService.deleteHabit(id);
      await get().fetchAll();
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
