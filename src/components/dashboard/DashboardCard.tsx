import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { ChevronRight } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
  children: ReactNode;
}

export function DashboardCard({ title, icon: Icon, color, onClick, children }: DashboardCardProps) {
  const appTheme = useAppTheme();

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl transition-all btn-press"
      style={{
        backgroundColor: appTheme.canvas,
        border: `0.5px solid ${appTheme.hairline}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: withAlpha(color, 0.12) }}
          >
            <Icon size={15} style={{ color }} />
          </div>
          <span className="text-sm font-medium" style={{ color: appTheme.ink }}>{title}</span>
        </div>
        <ChevronRight size={14} style={{ color: appTheme.inkMuted48 }} />
      </div>
      {children}
    </button>
  );
}
