import { type ReactNode, type CSSProperties } from 'react';
import { useAppTheme } from '@/stores/themeStore';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  bgColor?: string;
  style?: CSSProperties;
}

export function PageContainer({
  children,
  className = '',
  bgColor,
  style,
}: PageContainerProps) {
  const appTheme = useAppTheme();
  return (
    <div
      className={`h-full px-4 md:px-6 lg:px-8 flex flex-col overflow-hidden ${className}`}
      style={{ backgroundColor: bgColor ?? appTheme.canvas, ...style }}
    >
      {children}
    </div>
  );
}
