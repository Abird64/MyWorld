import { create } from 'zustand';
import type { Calendar } from '@/types/schedule';
import * as calendarService from '@/services/calendarService';
import { triggerSync } from '@/stores/syncStore';

interface CalendarState {
  calendars: Calendar[];
  visibleCalendarIds: Set<string>;
  isLoading: boolean;

  fetchCalendars: () => Promise<void>;
  createCalendar: (name: string, color: string) => Promise<Calendar>;
  updateCalendar: (id: string, name?: string, color?: string) => Promise<Calendar>;
  deleteCalendar: (id: string) => Promise<void>;
  toggleCalendar: (id: string) => void;
  setAllVisible: (visible: boolean) => void;
  getCalendarById: (id: string | null) => Calendar | undefined;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  calendars: [],
  visibleCalendarIds: new Set<string>(),
  isLoading: false,

  fetchCalendars: async () => {
    set({ isLoading: true });
    try {
      const calendars = await calendarService.listCalendars();
      const visibleSet = new Set(calendars.map((c) => c.id));
      set({ calendars, visibleCalendarIds: visibleSet, isLoading: false });
    } catch (e) {
      console.error('Failed to fetch calendars:', e);
      set({ isLoading: false });
    }
  },

  createCalendar: async (name, color) => {
    const calendar = await calendarService.createCalendar(name, color);
    set((state) => {
      const updated = [...state.calendars, calendar];
      const visibleSet = new Set(state.visibleCalendarIds);
      visibleSet.add(calendar.id);
      return { calendars: updated, visibleCalendarIds: visibleSet };
    });
    triggerSync();
    return calendar;
  },

  updateCalendar: async (id, name, color) => {
    const calendar = await calendarService.updateCalendar(id, name, color);
    set((state) => ({
      calendars: state.calendars.map((c) => (c.id === id ? calendar : c)),
    }));
    triggerSync();
    return calendar;
  },

  deleteCalendar: async (id) => {
    await calendarService.deleteCalendar(id);
    set((state) => {
      const visibleSet = new Set(state.visibleCalendarIds);
      visibleSet.delete(id);
      return {
        calendars: state.calendars.filter((c) => c.id !== id),
        visibleCalendarIds: visibleSet,
      };
    });
    triggerSync();
  },

  toggleCalendar: (id) => {
    set((state) => {
      const visibleSet = new Set(state.visibleCalendarIds);
      if (visibleSet.has(id)) {
        visibleSet.delete(id);
      } else {
        visibleSet.add(id);
      }
      return { visibleCalendarIds: visibleSet };
    });
  },

  setAllVisible: (visible) => {
    set((state) => {
      if (visible) {
        return { visibleCalendarIds: new Set(state.calendars.map((c) => c.id)) };
      } else {
        return { visibleCalendarIds: new Set<string>() };
      }
    });
  },

  getCalendarById: (id) => {
    if (!id) return undefined;
    return get().calendars.find((c) => c.id === id);
  },
}));
