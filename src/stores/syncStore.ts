import { create } from 'zustand';
import * as syncService from '@/services/syncService';
import type { SyncResult, SyncStatus, TestConnectionParams } from '@/services/syncService';
import { refreshAllStores } from '@/utils/refreshAfterSync';

interface SyncState {
  /** 同步状态 */
  status: SyncStatus | null;
  /** 是否正在同步 */
  isSyncing: boolean;
  /** 上次同步结果 */
  lastResult: SyncResult | null;
  /** 错误信息 */
  error: string | null;

  /** 加载同步状态 */
  loadStatus: () => Promise<void>;
  /** 测试连接 */
  testConnection: (params: TestConnectionParams) => Promise<string>;
  /** 立即同步 */
  syncNow: () => Promise<SyncResult>;
  /** 清除错误 */
  clearError: () => void;
}

export const useSyncStore = create<SyncState>((set, _get) => ({
  status: null,
  isSyncing: false,
  lastResult: null,
  error: null,

  loadStatus: async () => {
    try {
      const status = await syncService.getSyncStatus();
      set({ status });
    } catch (e) {
      console.error('Failed to load sync status:', e);
    }
  },

  testConnection: async (params: TestConnectionParams) => {
    set({ error: null });
    try {
      const result = await syncService.testConnection(params);
      return result;
    } catch (e) {
      const msg = String(e);
      set({ error: msg });
      throw e;
    }
  },

  syncNow: async () => {
    if (_syncingLock) {
      return { success: false, db_action: 'skipped', journals_uploaded: 0, journals_downloaded: 0, errors: [], message: '同步正在进行中，跳过重复请求', bytes_uploaded: 0, bytes_downloaded: 0 };
    }
    _syncingLock = true;
    set({ isSyncing: true, error: null, lastResult: null });
    try {
      const result = await syncService.syncNow();
      set({ isSyncing: false, lastResult: result });
      const status = await syncService.getSyncStatus();
      set({ status });
      // 同步成功后刷新所有数据 store，让 UI 显示最新数据
      if (result.success) {
        refreshAllStores().catch((e) => console.error('[syncStore] refresh after sync failed:', e));
      }
      return result;
    } catch (e) {
      const msg = String(e);
      set({ isSyncing: false, error: msg });
      throw e;
    } finally {
      _syncingLock = false;
    }
  },

  clearError: () => set({ error: null }),
}));

// ========== 防抖自动同步 ==========
// 写操作后调用 triggerSync()，3 秒内多次写操作只触发一次同步
let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _syncingLock = false;

export function triggerSync() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    _syncTimer = null;
    // 双重检查：store 状态 + 模块级锁，防止并发同步
    if (_syncingLock || useSyncStore.getState().isSyncing) return;
    try {
      await useSyncStore.getState().syncNow();
    } catch (e) {
      console.error('[syncStore] triggerSync failed:', e);
    }
  }, 3000);
}
