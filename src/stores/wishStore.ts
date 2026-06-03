import { create } from 'zustand';
import type { Wish, WishDraw, GlowBalance, CreateWishInput, UpdateWishInput, WishLevel, PityProgress } from '@/types/wish';
import * as wishService from '@/services/wishService';

interface WishState {
  // Data
  wishes: Wish[];
  draws: WishDraw[];
  balance: GlowBalance | null;
  pityProgress: Record<'micro' | 'shimmer', PityProgress | null>;

  // UI State
  isLoading: boolean;
  error: string | null;
  selectedLevel: WishLevel | null;
  showAddModal: boolean;
  editingWish: Wish | null;
  activeTab: 'wishes' | 'history' | 'shop';

  // Actions
  fetchWishes: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  fetchDraws: () => Promise<void>;
  fetchPityProgress: (type: 'micro' | 'shimmer') => Promise<void>;
  createWish: (input: CreateWishInput) => Promise<void>;
  updateWish: (input: UpdateWishInput) => Promise<void>;
  deleteWish: (id: string) => Promise<void>;
  markAchieved: (id: string) => Promise<void>;
  draw: (ticketType: 'micro' | 'shimmer') => Promise<{
    success: boolean;
    wish: Wish | null;
    is_pity: boolean;
    pity_count: number;
    message: string;
  }>;
  buyTickets: (ticketType: 'micro' | 'shimmer', count: number) => Promise<void>;
  redeemWish: (wishId: string) => Promise<void>;
  addGlow: (amount: number, source: string) => Promise<void>;

  // UI Actions
  setSelectedLevel: (level: WishLevel | null) => void;
  setShowAddModal: (show: boolean) => void;
  setEditingWish: (wish: Wish | null) => void;
  setActiveTab: (tab: 'wishes' | 'history' | 'shop') => void;
  clearError: () => void;
}

const defaultBalance: GlowBalance = {
  id: 'user',
  glow_amount: 0,
  micro_tickets: 0,
  shimmer_tickets: 0,
  updated_at: new Date().toISOString(),
};

export const useWishStore = create<WishState>((set, get) => ({
  // Initial state
  wishes: [],
  draws: [],
  balance: null,
  pityProgress: { micro: null, shimmer: null },
  isLoading: false,
  error: null,
  selectedLevel: null,
  showAddModal: false,
  editingWish: null,
  activeTab: 'wishes',

  // Fetch wishes
  fetchWishes: async () => {
    set({ isLoading: true, error: null });
    try {
      const wishes = await wishService.listWishes();
      set({ wishes, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  // Fetch balance
  fetchBalance: async () => {
    try {
      const balance = await wishService.getGlowBalance();
      set({ balance });
    } catch (e) {
      console.error('Failed to fetch balance:', e);
    }
  },

  // Fetch draws
  fetchDraws: async () => {
    try {
      const draws = await wishService.listDraws(20);
      set({ draws });
    } catch (e) {
      console.error('Failed to fetch draws:', e);
    }
  },

  // Fetch pity progress
  fetchPityProgress: async (type) => {
    try {
      const progress = await wishService.getPityProgress(type);
      set((state) => ({
        pityProgress: { ...state.pityProgress, [type]: progress },
      }));
    } catch (e) {
      console.error('Failed to fetch pity progress:', e);
    }
  },

  // Create wish
  createWish: async (input) => {
    set({ isLoading: true, error: null });
    try {
      await wishService.createWish(input);
      await get().fetchWishes();
      set({ isLoading: false, showAddModal: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  // Update wish
  updateWish: async (input) => {
    set({ isLoading: true, error: null });
    try {
      await wishService.updateWish(input);
      await get().fetchWishes();
      set({ isLoading: false, editingWish: null, showAddModal: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  // Delete wish
  deleteWish: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await wishService.deleteWish(id);
      await get().fetchWishes();
      set({ isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  // Mark achieved
  markAchieved: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await wishService.markWishAchieved(id);
      await get().fetchWishes();
      set({ isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  // Draw
  draw: async (ticketType) => {
    set({ isLoading: true, error: null });
    try {
      const result = await wishService.drawWish(ticketType);
      await get().fetchBalance();
      await get().fetchDraws();
      await get().fetchPityProgress(ticketType);
      set({ isLoading: false });
      return result;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      return { success: false, wish: null, is_pity: false, pity_count: 0, message: String(e) };
    }
  },

  // Buy tickets
  buyTickets: async (ticketType, count) => {
    set({ isLoading: true, error: null });
    try {
      await wishService.buyTickets(ticketType, count);
      await get().fetchBalance();
      set({ isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  // Redeem wish
  redeemWish: async (wishId) => {
    set({ isLoading: true, error: null });
    try {
      await wishService.redeemWish(wishId);
      await get().fetchBalance();
      await get().fetchWishes();
      set({ isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  // Add glow
  addGlow: async (amount, source) => {
    try {
      await wishService.addGlow(amount, source);
      await get().fetchBalance();
    } catch (e) {
      console.error('Failed to add glow:', e);
    }
  },

  // UI Actions
  setSelectedLevel: (level) => set({ selectedLevel: level }),
  setShowAddModal: (show) => set({ showAddModal: show }),
  setEditingWish: (wish) => set({ editingWish: wish }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  clearError: () => set({ error: null }),
}));
