import { create } from 'zustand';
import type { PluginManifest } from '@/types/plugin';

interface PluginState {
  /** 已注册的插件，id → manifest */
  plugins: Record<string, PluginManifest>;
  /** 注册一个插件 */
  register: (manifest: PluginManifest) => void;
  /** 获取所有已注册插件列表 */
  getAll: () => PluginManifest[];
  /** 根据 id 获取插件 */
  getById: (id: string) => PluginManifest | undefined;
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: {},

  register: (manifest) => {
    set((state) => ({
      plugins: { ...state.plugins, [manifest.id]: manifest },
    }));
  },

  getAll: () => Object.values(get().plugins),

  getById: (id) => get().plugins[id],
}));
