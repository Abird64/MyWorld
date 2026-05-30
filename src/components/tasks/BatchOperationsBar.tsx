import { useAppTheme } from '@/stores/themeStore';

interface BatchOperationsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchComplete: () => void;
  onBatchDelete: () => void;
  onCancel: () => void;
}

export function BatchOperationsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBatchComplete,
  onBatchDelete,
  onCancel,
}: BatchOperationsBarProps) {
  const appTheme = useAppTheme();
  const allSelected = selectedCount > 0 && selectedCount === totalCount;
  const txt = appTheme.ink;
  const txtLight = txt + '4D';
  const txtMid = txt + '80';
  const txtBody = txt + 'B3';
  const txtHint = txt + '33';
  const bgSubtle = txt + '0D';
  const bgHover = txt + '1A';
  const borderColor = txt + '1A';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t" style={{ backgroundColor: appTheme.canvas, borderColor }}>
      <div className="max-w-[1000px] mx-auto px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="text-sm transition-colors"
            style={{ color: txtMid }}
            onMouseEnter={(e) => (e.currentTarget.style.color = txtBody)}
            onMouseLeave={(e) => (e.currentTarget.style.color = txtMid)}
          >
            {allSelected ? '取消全选' : '全选'}
          </button>
          <span className="text-sm" style={{ color: txtLight }}>已选 {selectedCount} 项</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBatchComplete}
            disabled={selectedCount === 0}
            className="px-5 py-2.5 rounded-full text-sm transition-all"
            style={selectedCount > 0
              ? { backgroundColor: '#2A8CB7', color: '#fff' }
              : { backgroundColor: bgSubtle, color: txtHint }}
          >
            批量完成
          </button>
          <button
            onClick={onBatchDelete}
            disabled={selectedCount === 0}
            className="px-5 py-2.5 rounded-full text-sm transition-all"
            style={selectedCount > 0
              ? { backgroundColor: '#fef2f2', color: '#ef4444' }
              : { backgroundColor: bgSubtle, color: txtHint }}
          >
            批量删除
          </button>
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-full text-sm transition-colors"
            style={{ color: txtMid, backgroundColor: bgSubtle }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = bgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bgSubtle)}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
