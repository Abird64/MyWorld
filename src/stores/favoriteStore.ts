/**
 * 收藏夹状态管理
 */
import { create } from 'zustand';
import type { AiFavorite } from '@/types/favorite';
import * as favoriteService from '@/services/favoriteService';
import { triggerSync } from '@/stores/syncStore';

interface FavoriteState {
  favorites: AiFavorite[];
  isLoading: boolean;
  favoritedIds: Set<string>; // message_id 集合，用于 toggle 判断
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (content: string, role: string, messageId: string, conversationTitle?: string) => Promise<boolean>;
  deleteFavorite: (id: string) => Promise<void>;
  deleteAllFavorites: () => Promise<void>;
  isFavorited: (messageId: string) => boolean;
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favorites: [],
  isLoading: false,
  favoritedIds: new Set(),

  fetchFavorites: async () => {
    set({ isLoading: true });
    try {
      const favorites = await favoriteService.listFavorites();
      const favoritedIds = new Set<string>();
      for (const f of favorites) {
        if (f.message_id) favoritedIds.add(f.message_id);
      }
      set({ favorites, favoritedIds });
    } catch (e) {
      console.error('Failed to fetch favorites:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  toggleFavorite: async (content, role, messageId, conversationTitle) => {
    const { favoritedIds, favorites } = get();
    if (favoritedIds.has(messageId)) {
      // 取消收藏
      try {
        await favoriteService.deleteFavoriteByMessageId(messageId);
        const newIds = new Set(favoritedIds);
        newIds.delete(messageId);
        set({
          favoritedIds: newIds,
          favorites: favorites.filter((f) => f.message_id !== messageId),
        });
        triggerSync();
        return false;
      } catch (e) {
        console.error('Failed to unfavorite:', e);
        return true;
      }
    } else {
      // 添加收藏
      try {
        const fav = await favoriteService.addFavorite(content, role, conversationTitle, messageId);
        const newIds = new Set(favoritedIds);
        newIds.add(messageId);
        set({
          favoritedIds: newIds,
          favorites: [fav, ...favorites],
        });
        triggerSync();
        return true;
      } catch (e) {
        console.error('Failed to favorite:', e);
        return false;
      }
    }
  },

  deleteFavorite: async (id) => {
    try {
      await favoriteService.deleteFavorite(id);
      const { favorites } = get();
      const fav = favorites.find((f) => f.id === id);
      const newIds = new Set(get().favoritedIds);
      if (fav?.message_id) newIds.delete(fav.message_id);
      set({
        favorites: favorites.filter((f) => f.id !== id),
        favoritedIds: newIds,
      });
      triggerSync();
    } catch (e) {
      console.error('Failed to delete favorite:', e);
    }
  },

  deleteAllFavorites: async () => {
    try {
      await favoriteService.deleteAllFavorites();
      set({ favorites: [], favoritedIds: new Set() });
      triggerSync();
    } catch (e) {
      console.error('Failed to delete all favorites:', e);
    }
  },

  isFavorited: (messageId) => {
    return get().favoritedIds.has(messageId);
  },
}));
