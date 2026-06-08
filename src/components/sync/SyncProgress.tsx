/**
 * 同步进度显示组件
 * 显示同步的详细进度、上传/下载统计、冲突信息
 */
import { useState } from 'react';
import { Loader2, CheckCircle, AlertCircle, ArrowUp, ArrowDown, FileText, Database } from 'lucide-react';
import type { SyncResult } from '@/services/syncService';

interface SyncProgressProps {
  isSyncing: boolean;
  result: SyncResult | null;
  error: string | null;
  theme: {
    accent: string;
    text: string;
    textSub: string;
    danger: string;
    success: string;
    overlay: (opacity: number) => string;
    cardBorder: string;
  };
}

export function SyncProgress({ isSyncing, result, error, theme }: SyncProgressProps) {
  const [showDetails, setShowDetails] = useState(false);

  // 格式化字节大小
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 同步中状态
  if (isSyncing) {
    return (
      <div
        className="rounded-xl p-4 animate-pulse"
        style={{ backgroundColor: theme.overlay(0.04), border: `1px solid ${theme.cardBorder}` }}
      >
        <div className="flex items-center gap-3">
          <Loader2 size={20} className="animate-spin" style={{ color: theme.accent }} />
          <div className="flex-1">
            <div className="text-sm font-medium" style={{ color: theme.text }}>
              正在同步...
            </div>
            <div className="text-xs" style={{ color: theme.textSub }}>
              正在比较本地和远端数据变更
            </div>
          </div>
        </div>
        {/* 进度条 */}
        <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.overlay(0.08) }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              backgroundColor: theme.accent,
              width: '60%',
            }}
          />
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: `${theme.danger}15`, border: `1px solid ${theme.danger}` }}
      >
        <div className="flex items-center gap-3">
          <AlertCircle size={20} style={{ color: theme.danger }} />
          <div className="flex-1">
            <div className="text-sm font-medium" style={{ color: theme.danger }}>
              同步失败
            </div>
            <div className="text-xs" style={{ color: theme.textSub }}>
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 成功结果
  if (result?.success) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: `${theme.success}10`, border: `1px solid ${theme.success}30` }}
      >
        <div className="flex items-center gap-3">
          <CheckCircle size={20} style={{ color: theme.success }} />
          <div className="flex-1">
            <div className="text-sm font-medium" style={{ color: theme.success }}>
              同步成功
            </div>
            <div className="text-xs" style={{ color: theme.textSub }}>
              {result.message}
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ color: theme.accent }}
          >
            {showDetails ? '收起' : '详情'}
          </button>
        </div>

        {/* 统计信息 */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div
            className="rounded-lg p-3 flex items-center gap-2"
            style={{ backgroundColor: theme.overlay(0.04) }}
          >
            <Database size={14} style={{ color: theme.accent }} />
            <div>
              <div className="text-xs" style={{ color: theme.textSub }}>数据库操作</div>
              <div className="text-sm font-medium" style={{ color: theme.text }}>
                {result.db_action || '无变更'}
              </div>
            </div>
          </div>
          <div
            className="rounded-lg p-3 flex items-center gap-2"
            style={{ backgroundColor: theme.overlay(0.04) }}
          >
            <FileText size={14} style={{ color: theme.accent }} />
            <div>
              <div className="text-xs" style={{ color: theme.textSub }}>日记文件</div>
              <div className="text-sm font-medium" style={{ color: theme.text }}>
                ↑{result.journals_uploaded} ↓{result.journals_downloaded}
              </div>
            </div>
          </div>
        </div>

        {/* 传输统计 */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: theme.cardBorder }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <ArrowUp size={14} style={{ color: theme.accent }} />
                <span className="text-xs" style={{ color: theme.textSub }}>
                  上传: {formatBytes(result.bytes_uploaded)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowDown size={14} style={{ color: theme.accent }} />
                <span className="text-xs" style={{ color: theme.textSub }}>
                  下载: {formatBytes(result.bytes_downloaded)}
                </span>
              </div>
            </div>

            {/* 错误列表 */}
            {result.errors.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium mb-2" style={{ color: theme.danger }}>
                  同步警告 ({result.errors.length})
                </div>
                <div className="space-y-1">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <div
                      key={i}
                      className="text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: theme.overlay(0.04), color: theme.textSub }}
                    >
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
