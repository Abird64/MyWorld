import { type ReactNode } from 'react';
import { useAppTheme } from '@/stores/themeStore';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  bgColor?: string;
}

export function PageContainer({
  children,
  className = '',
  bgColor,
}: PageContainerProps) {
  const appTheme = useAppTheme();
  return (
    <div
      className={`h-full px-4 md:px-6 lg:px-8 flex flex-col overflow-hidden ${className}`}
      style={{ backgroundColor: bgColor ?? appTheme.canvas }}
    >
      {children}
    </div>
  );
}
