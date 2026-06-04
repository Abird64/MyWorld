import { forwardRef, type HTMLAttributes } from 'react';
import { useAppTheme } from '@/stores/themeStore';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'task' | 'diary' | 'relation' | 'list';
  size?: 'sm' | 'md' | 'lg';
  padding?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', size = 'md', padding = true, children, ...props }, ref) => {
    const appTheme = useAppTheme();
    const pad = padding
      ? size === 'sm' ? 'p-4'
        : size === 'lg' ? 'p-8'
        : 'p-6'
      : '';

    const { style: incomingStyle, ...restProps } = props;

    return (
      <div
        ref={ref}
        className={`${pad} ${className}`}
        style={{
          backgroundColor: appTheme.canvas,
          borderRadius: 18,
          border: `0.5px solid ${appTheme.hairline}`,
          ...(incomingStyle || {}),
        }}
        {...restProps}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
