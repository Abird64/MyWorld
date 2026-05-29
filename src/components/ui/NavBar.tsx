import { ChevronLeft } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { appTheme } from '@/styles/theme';
import { WindowControls } from '@/components/layout/WindowControls';

interface NavBarProps {
  title: string;
  navColor?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function NavBar({
  title,
  navColor = appTheme.surfaceBlack,
  showBack,
  onBack,
}: NavBarProps) {
  const goBack = useUIStore((s) => s.goBack);
  const activeSubPage = useUIStore((s) => s.activeSubPage);
  const shouldShowBack = showBack ?? !!activeSubPage;
  const handleBack = onBack ?? goBack;

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between px-4 flex-shrink-0"
      style={{
        height: 44,
        backgroundColor: navColor,
        borderBottom: '0.5px solid rgba(255,255,255,0.1)',
      }}
    >
      {/* 左侧 */}
      <div className="flex items-center gap-1 min-w-[80px]">
        {shouldShowBack && (
          <button
            onClick={handleBack}
            className="flex items-center gap-0.5 text-sm btn-press"
            style={{ color: appTheme.primaryOnDark }}
          >
            <ChevronLeft size={20} />
            <span>返回</span>
          </button>
        )}
        {!shouldShowBack && (
          <span className="text-[15px] font-semibold" style={{ color: appTheme.onDark }}>
            {title}
          </span>
        )}
      </div>

      {/* 中央 — 子页面标题 */}
      {shouldShowBack && (
        <span className="text-[15px] font-semibold" style={{ color: appTheme.onDark }}>
          {title}
        </span>
      )}

      {/* 右侧 — 窗口控制 */}
      <div className="min-w-[80px] flex justify-end">
        <WindowControls />
      </div>
    </div>
  );
}
