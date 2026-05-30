/**
 * 同步服务 - 封装 WebDAV 同步相关的 Tauri 命令调用
 */
import { tauriInvoke } from './tauri';

export interface SyncResult {
  success: boolean;
  db_action: string;
  journals_uploaded: number;
  journals_downloaded: number;
  errors: string[];
  message: string;
  bytes_uploaded: number;
  bytes_downloaded: number;
}

export interface SyncStatus {
  enabled: boolean;
  configured: boolean;
  in_progress: boolean;
  last_sync_time: string | null;
}

/** 测试 WebDAV 连接 */
export async function testConnection(
  url: string,
  username: string,
  password: string
): Promise<string> {
  return tauriInvoke<string>('sync_test_connection', {
    url,
    username,
    password,
  });
}

/** 立即同步 */
export async function syncNow(): Promise<SyncResult> {
  return tauriInvoke<SyncResult>('sync_now');
}

/** 获取同步状态 */
export async function getSyncStatus(): Promise<SyncStatus> {
  return tauriInvoke<SyncStatus>('sync_get_status');
}
