import { create } from 'zustand';
import type { Schedule, CreateScheduleInput, UpdateScheduleInput } from '@/types/schedule';
import * as scheduleService from '@/services/scheduleService';
import { triggerSync } from '@/stores/syncStore';

interface ScheduleState {
  schedules: Schedule[];
  countdowns: Schedule[];
  isLoading: boolean;
  error: string | null;

  rangeStart: string;
  rangeEnd: string;

  fetchSchedules: (rangeStart: string, rangeEnd: string) => Promise<void>;
  fetchCountdowns: () => Promise<void>;
  createSchedule: (input: CreateScheduleInput) => Promise<Schedule>;
  updateSchedule: (id: string, input: UpdateScheduleInput) => Promise<Schedule>;
  deleteSchedule: (id: string) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, _get) => ({
  schedules: [],
  countdowns: [],
  isLoading: false,
  error: null,
  rangeStart: '',
  rangeEnd: '',

  fetchSchedules: async (rangeStart, rangeEnd) => {
    set({ isLoading: true, error: null, rangeStart, rangeEnd });
    try {
      const schedules = await scheduleService.listSchedulesInRange({
        range_start: rangeStart,
        range_end: rangeEnd,
      });
      set({ schedules, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  fetchCountdowns: async () => {
    try {
      const countdowns = await scheduleService.listCountdowns();
      set({ countdowns });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  createSchedule: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const schedule = await scheduleService.createSchedule(input);
      set((state) => ({
        schedules: [...state.schedules, schedule].sort(
          (a, b) => a.start_at.localeCompare(b.start_at)
        ),
        isLoading: false,
      }));
      triggerSync();
      return schedule;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  updateSchedule: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const schedule = await scheduleService.updateSchedule(id, input);
      set((state) => ({
        schedules: state.schedules.map((s) => (s.id === id ? schedule : s)),
        isLoading: false,
      }));
      triggerSync();
      return schedule;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  deleteSchedule: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await scheduleService.deleteSchedule(id);
      set((state) => ({
        schedules: state.schedules.filter((s) => s.id !== id),
        isLoading: false,
      }));
      triggerSync();
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },
}));
