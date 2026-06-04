import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { ChevronRight, AlertCircle } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
  children: ReactNode;
  variant?: 'standard' | 'prominent';
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

export function DashboardCard({ title, icon: Icon, color, onClick, children, variant = 'standard', loading, error, onRetry }: DashboardCardProps) {
  const appTheme = useAppTheme();
  const isProminent = variant === 'prominent';

  const skeletonHeight = isProminent ? 28 : 24;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl transition-all btn-press"
      style={{
        backgroundColor: appTheme.canvas,
        border: `0.5px solid ${error ? appTheme.danger : appTheme.hairline}`,
        padding: isProminent ? '20px' : '16px',
      }}
      aria-label={`查看${title}`}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: isProminent ? '16px' : '12px' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: error ? withAlpha(appTheme.danger, 0.12) : withAlpha(color, 0.12),
              width: isProminent ? 36 : 28,
              height: isProminent ? 36 : 28,
              borderRadius: isProminent ? 12 : 8,
            }}
            aria-hidden="true"
          >
            {error ? (
              <AlertCircle size={isProminent ? 19 : 15} style={{ color: appTheme.danger }} />
            ) : (
              <Icon size={isProminent ? 19 : 15} style={{ color }} />
            )}
          </div>
          <span
            className="font-medium"
            style={{ color: appTheme.ink, fontSize: isProminent ? 15 : 14 }}
          >
            {title}
          </span>
        </div>
        <ChevronRight size={14} style={{ color: appTheme.inkMuted48 }} aria-hidden="true" />
      </div>
      {loading ? (
        <div className="animate-pulse" role="status" aria-label="加载中">
          <div
            className="rounded"
            style={{ backgroundColor: appTheme.hairline, width: '45%', height: skeletonHeight }}
          />
        </div>
      ) : error ? (
        <button
          onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
          className="text-xs text-left"
          style={{ color: appTheme.danger }}
          aria-label="重新加载"
        >
          加载失败，点击重试
        </button>
      ) : (
        children
      )}
    </button>
  );
}
