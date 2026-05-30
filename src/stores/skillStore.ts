import { create } from 'zustand';
import type { Skill, DayActivity, XpSource } from '@/types/skill';
import * as skillService from '@/services/skillService';

interface SkillState {
  skills: Skill[];
  isLoading: boolean;
  error: string | null;
  activity: DayActivity[];
  sources: XpSource[];
  fetchSkills: () => Promise<void>;
  fetchActivity: () => Promise<void>;
  fetchSources: () => Promise<void>;
}

export const useSkillStore = create<SkillState>((set) => ({
  skills: [],
  isLoading: false,
  error: null,
  activity: [],
  sources: [],

  fetchSkills: async () => {
    set({ isLoading: true, error: null });
    try {
      const skills = await skillService.listSkills();
      set({ skills, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  fetchActivity: async () => {
    try {
      const activity = await skillService.getSkillActivity(84);
      set({ activity });
    } catch (e) {
      console.error('Failed to fetch skill activity:', e);
    }
  },

  fetchSources: async () => {
    try {
      const sources = await skillService.getXpSources();
      set({ sources });
    } catch (e) {
      console.error('Failed to fetch XP sources:', e);
    }
  },
}));
