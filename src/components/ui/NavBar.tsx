import { ChevronLeft } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { WindowControls } from '@/components/layout/WindowControls';
import { useIsMobile } from '@/hooks/useIsMobile';

interface NavBarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function NavBar({ title, showBack, onBack }: NavBarProps) {
  const isMobile = useIsMobile();
  const appTheme = useAppTheme();
  const goBack = useUIStore((s) => s.goBack);
  const activeSubPage = useUIStore((s) => s.activeSubPage);
  const shouldShowBack = showBack ?? !!activeSubPage;
  const handleBack = onBack ?? goBack;

  return (
    <div
      {...(!isMobile && { 'data-tauri-drag-region': true })}
      className="relative flex items-center justify-center px-4 flex-shrink-0 safe-top"
      style={{
        minHeight: 44,
        backgroundColor: 'transparent',
        borderBottom: `0.5px solid ${appTheme.hairline}`,
      }}
    >
      {/* 左侧 — 返回按钮或占位 */}
      <div className="absolute left-4 flex items-center">
        {shouldShowBack && (
          <button
            onClick={handleBack}
            className="flex items-center gap-0.5 text-sm btn-press"
            style={{ color: appTheme.primary }}
          >
            <ChevronLeft size={20} />
            <span>返回</span>
          </button>
        )}
      </div>

      {/* 中央 — 标题始终居中 */}
      <span className="text-[15px] font-semibold" style={{ color: appTheme.ink }}>
        {title}
      </span>

      {/* 右侧 — 窗口控制（移动端隐藏） */}
      {!isMobile && (
        <div className="absolute right-4 flex justify-end">
          <WindowControls />
        </div>
      )}
    </div>
  );
}
