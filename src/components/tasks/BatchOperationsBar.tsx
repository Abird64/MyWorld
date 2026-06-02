import { useAppTheme, withAlpha } from '@/stores/themeStore';

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
  const txtLight = withAlpha(txt, 0.3);
  const txtMid = withAlpha(txt, 0.5);
  const txtBody = withAlpha(txt, 0.7);
  const txtHint = withAlpha(txt, 0.2);
  const bgSubtle = withAlpha(txt, 0.05);
  const bgHover = withAlpha(txt, 0.1);
  const borderColor = withAlpha(txt, 0.1);

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
              ? { backgroundColor: appTheme.primary, color: appTheme.onPrimary }
              : { backgroundColor: bgSubtle, color: txtHint }}
          >
            批量完成
          </button>
          <button
            onClick={onBatchDelete}
            disabled={selectedCount === 0}
            className="px-5 py-2.5 rounded-full text-sm transition-all"
            style={selectedCount > 0
              ? { backgroundColor: `${withAlpha(appTheme.danger, 0.13)}`, color: appTheme.danger }
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
