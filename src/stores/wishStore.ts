import { create } from 'zustand';
import type { Wish, WishDraw, GlowBalance, CreateWishInput, UpdateWishInput, WishLevel, PityProgress, GlowLedgerEntry, GlowLedgerResult, DrawResult, InventoryItem } from '@/types/wish';
import * as wishService from '@/services/wishService';

interface WishState {
  // Data
  wishes: Wish[];
  draws: WishDraw[];
  balance: GlowBalance | null;
  pityProgress: Record<'micro' | 'shimmer', PityProgress | null>;
  ledger: GlowLedgerEntry[];
  ledgerTotal: number;
  inventory: InventoryItem[];
  inventoryCount: number;

  // UI State
  isLoading: boolean;
  error: string | null;
  selectedLevel: WishLevel | null;
  showAddModal: boolean;
  editingWish: Wish | null;
  activeTab: 'wishes' | 'inventory' | 'history' | 'ledger';

  // Actions
  fetchWishes: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  fetchDraws: () => Promise<void>;
  fetchPityProgress: (type: 'micro' | 'shimmer') => Promise<void>;
  fetchInventory: () => Promise<void>;
  createWish: (input: CreateWishInput) => Promise<void>;
  updateWish: (input: UpdateWishInput) => Promise<void>;
  deleteWish: (id: string) => Promise<void>;
  markAchieved: (id: string) => Promise<void>;
  draw: (ticketType: 'micro' | 'shimmer') => Promise<DrawResult>;
  claimPityWish: (ticketType: 'micro' | 'shimmer', wishId: string) => Promise<DrawResult>;
  buyTickets: (ticketType: 'micro' | 'shimmer', count: number) => Promise<void>;
  redeemWish: (wishId: string) => Promise<void>;
  redeemDraw: (drawId: string) => Promise<void>;
  adjustStock: (wishId: string, delta: number) => Promise<void>;
  addGlow: (amount: number, source: string) => Promise<void>;
  fetchLedger: (assetType?: 'glow' | 'micro_ticket' | 'shimmer_ticket', limit?: number, offset?: number) => Promise<void>;

  // UI Actions
  setSelectedLevel: (level: WishLevel | null) => void;
  setShowAddModal: (show: boolean) => void;
  setEditingWish: (wish: Wish | null) => void;
  setActiveTab: (tab: 'wishes' | 'inventory' | 'history' | 'ledger') => void;
  clearError: () => void;
}

export const useWishStore = create<WishState>((set, get) => ({
  // Initial state
  wishes: [],
  draws: [],
  balance: null,
  pityProgress: { micro: null, shimmer: null },
  ledger: [],
  ledgerTotal: 0,
  inventory: [],
  inventoryCount: 0,
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

  // Fetch inventory
  fetchInventory: async () => {
    try {
      const [inventory, count] = await Promise.all([
        wishService.listInventory(),
        wishService.getInventoryCount(),
      ]);
      set({ inventory, inventoryCount: count });
    } catch (e) {
      console.error('Failed to fetch inventory:', e);
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
      await get().fetchWishes();
      await get().fetchInventory();
      set({ isLoading: false });
      return result;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      return { success: false, wish: null, is_pity: false, pity_count: 0, pity_threshold: 0, pity_available: false, message: String(e) };
    }
  },

  // Claim pity (self-select)
  claimPityWish: async (ticketType, wishId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await wishService.claimPityWish(ticketType, wishId);
      await get().fetchBalance();
      await get().fetchDraws();
      await get().fetchPityProgress(ticketType);
      await get().fetchWishes();
      await get().fetchInventory();
      set({ isLoading: false });
      return result;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
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

  // Redeem draw (核销仓库物品)
  redeemDraw: async (drawId) => {
    set({ isLoading: true, error: null });
    try {
      await wishService.redeemDraw(drawId);
      await Promise.all([
        get().fetchInventory(),
        get().fetchWishes(),
      ]);
      set({ isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  // Adjust stock (剩余库存 +/- 1)
  adjustStock: async (wishId, delta) => {
    try {
      await wishService.adjustWishStock(wishId, delta);
      await get().fetchWishes();
    } catch (e) {
      set({ error: String(e) });
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

  // Fetch ledger
  fetchLedger: async (assetType, limit = 50, offset = 0) => {
    try {
      const result: GlowLedgerResult = await wishService.listGlowLedger({
        assetType,
        limit,
        offset,
      });
      set({ ledger: result.entries, ledgerTotal: result.total });
    } catch (e) {
      console.error('Failed to fetch ledger:', e);
    }
  },

  // UI Actions
  setSelectedLevel: (level) => set({ selectedLevel: level }),
  setShowAddModal: (show) => set({ showAddModal: show }),
  setEditingWish: (wish) => set({ editingWish: wish }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  clearError: () => set({ error: null }),
}));
