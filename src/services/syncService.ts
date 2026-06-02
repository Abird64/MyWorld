/**
 * 同步服务 - 封装同步相关的 Tauri 命令调用
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
  storage_type: string;
}

export interface TestConnectionParams {
  storageType: string;
  url: string;
  username: string;
  password: string;
  r2AccountId: string;
  r2AccessKey: string;
  r2SecretKey: string;
  r2Bucket: string;
}

/** 测试连接（支持 WebDAV 和 R2） */
export async function testConnection(params: TestConnectionParams): Promise<string> {
  return tauriInvoke<string>('sync_test_connection', {
    storage_type: params.storageType,
    url: params.url,
    username: params.username,
    password: params.password,
    r2_account_id: params.r2AccountId,
    r2_access_key: params.r2AccessKey,
    r2_secret_key: params.r2SecretKey,
    r2_bucket: params.r2Bucket,
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

/** 启用/禁用同步（启用时自动生成唯一设备 ID） */
export async function setSyncEnabled(enabled: boolean): Promise<void> {
  return tauriInvoke<void>('sync_set_enabled', { enabled });
}
