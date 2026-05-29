import { type ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  maxWidth?: string;
  padding?: string;
}

export function Container({
  children,
  maxWidth = 'max-w-[980px]',
  padding = 'px-4 md:px-6',
}: ContainerProps) {
  return (
    <div className={`flex-1 flex flex-col items-center ${padding}`}>
      <div className={`w-full ${maxWidth}`}>
        {children}
      </div>
    </div>
  );
}

export function Section({ className = '' }: { className?: string }) {
  return <div className={`h-6 ${className}`} />;
}
