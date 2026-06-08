/**
 * 冲突解决对话框
 * 当同步检测到数据冲突时显示，让用户选择保留哪个版本
 */
import { useState } from 'react';
import { AlertTriangle, FileText, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react';

export interface ConflictItem {
  id: string;
  table: string;
  rowId: string;
  localValue: string;
  remoteValue: string;
  localTime: string;
  remoteTime: string;
  description: string;
}

interface ConflictResolverProps {
  conflicts: ConflictItem[];
  isOpen: boolean;
  onResolve: (resolutions: Record<string, 'local' | 'remote'>) => void;
  onCancel: () => void;
  theme: {
    accent: string;
    text: string;
    textSub: string;
    danger: string;
    warning: string;
    canvas: string;
    cardBorder: string;
    overlay: (opacity: number) => string;
  };
}

export function ConflictResolver({
  conflicts,
  isOpen,
  onResolve,
  onCancel,
  theme,
}: ConflictResolverProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Record<string, 'local' | 'remote'>>({});

  if (!isOpen || conflicts.length === 0) return null;

  const current = conflicts[currentIndex];
  const resolvedCount = Object.keys(resolutions).length;
  const totalCount = conflicts.length;

  const handleSelect = (choice: 'local' | 'remote') => {
    setResolutions({ ...resolutions, [current.id]: choice });
    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleResolveAll = () => {
    // 自动选择剩余未处理的冲突（默认选择较新的）
    const autoResolutions: Record<string, 'local' | 'remote'> = { ...resolutions };
    conflicts.forEach((c) => {
      if (!autoResolutions[c.id]) {
        // 比较时间，选择较新的
        const localTime = new Date(c.localTime).getTime();
        const remoteTime = new Date(c.remoteTime).getTime();
        autoResolutions[c.id] = localTime >= remoteTime ? 'local' : 'remote';
      }
    });
    onResolve(autoResolutions);
  };

  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: theme.overlay(0.5) }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ backgroundColor: theme.canvas, border: `1px solid ${theme.cardBorder}` }}
      >
        {/* 标题 */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${theme.warning}20` }}
          >
            <AlertTriangle size={20} style={{ color: theme.warning }} />
          </div>
          <div>
            <h3 className="text-base font-medium" style={{ color: theme.text }}>
              同步冲突
            </h3>
            <p className="text-xs" style={{ color: theme.textSub }}>
              检测到 {conflicts.length} 处数据冲突，请选择保留哪个版本
            </p>
          </div>
        </div>

        {/* 进度指示器 */}
        <div className="flex items-center gap-2 mb-4">
          {conflicts.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-colors"
              style={{
                backgroundColor:
                  i < currentIndex
                    ? theme.accent
                    : i === currentIndex
                      ? theme.warning
                      : theme.overlay(0.1),
              }}
            />
          ))}
        </div>

        {/* 当前冲突 */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ backgroundColor: theme.overlay(0.04), border: `1px solid ${theme.cardBorder}` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText size={14} style={{ color: theme.textSub }} />
            <span className="text-xs" style={{ color: theme.textSub }}>
              {current.table} · {current.rowId}
            </span>
          </div>
          <div className="text-sm mb-4" style={{ color: theme.text }}>
            {current.description}
          </div>

          {/* 两个版本对比 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 本地版本 */}
            <button
              onClick={() => handleSelect('local')}
              className={`rounded-lg p-3 text-left transition-all ${
                resolutions[current.id] === 'local'
                  ? 'ring-2'
                  : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: theme.overlay(0.06),
                border: `1px solid ${resolutions[current.id] === 'local' ? theme.accent : theme.cardBorder}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: theme.accent }}
                />
                <span className="text-xs font-medium" style={{ color: theme.text }}>
                  本地版本
                </span>
                {resolutions[current.id] === 'local' && (
                  <Check size={12} style={{ color: theme.accent }} />
                )}
              </div>
              <div className="text-xs mb-1" style={{ color: theme.textSub }}>
                {current.localValue}
              </div>
              <div className="flex items-center gap-1 text-xs" style={{ color: theme.textSub }}>
                <Clock size={10} />
                {formatTime(current.localTime)}
              </div>
            </button>

            {/* 远端版本 */}
            <button
              onClick={() => handleSelect('remote')}
              className={`rounded-lg p-3 text-left transition-all ${
                resolutions[current.id] === 'remote'
                  ? 'ring-2'
                  : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: theme.overlay(0.06),
                border: `1px solid ${resolutions[current.id] === 'remote' ? theme.accent : theme.cardBorder}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: theme.warning }}
                />
                <span className="text-xs font-medium" style={{ color: theme.text }}>
                  远端版本
                </span>
                {resolutions[current.id] === 'remote' && (
                  <Check size={12} style={{ color: theme.accent }} />
                )}
              </div>
              <div className="text-xs mb-1" style={{ color: theme.textSub }}>
                {current.remoteValue}
              </div>
              <div className="flex items-center gap-1 text-xs" style={{ color: theme.textSub }}>
                <Clock size={10} />
                {formatTime(current.remoteTime)}
              </div>
            </button>
          </div>
        </div>

        {/* 导航 */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
            style={{ color: theme.text }}
          >
            <ChevronLeft size={14} /> 上一条
          </button>
          <span className="text-xs" style={{ color: theme.textSub }}>
            {currentIndex + 1} / {conflicts.length}
          </span>
          <button
            onClick={() => setCurrentIndex(Math.min(conflicts.length - 1, currentIndex + 1))}
            disabled={currentIndex === conflicts.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
            style={{ color: theme.text }}
          >
            下一条 <ChevronRight size={14} />
          </button>
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: theme.overlay(0.08), color: theme.text }}
          >
            取消同步
          </button>
          <button
            onClick={handleResolveAll}
            disabled={resolvedCount < totalCount}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: theme.accent, color: '#fff' }}
          >
            {resolvedCount < totalCount
              ? `自动解决 (${resolvedCount}/${totalCount})`
              : '确认并继续'}
          </button>
        </div>
      </div>
    </div>
  );
}
