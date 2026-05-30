import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { useAppTheme } from '@/stores/themeStore';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'xp-focus' | 'xp-creativity';
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-5 py-2.5 text-[17px]',
  lg: 'px-6 py-3 text-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', style, ...props }, ref) => {
    const appTheme = useAppTheme();
    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: appTheme.primary,
        color: appTheme.onPrimary,
      },
      secondary: {
        backgroundColor: 'transparent',
        color: appTheme.primary,
        border: `1px solid ${appTheme.primary}`,
      },
      ghost: {
        backgroundColor: 'transparent',
        color: appTheme.primary,
      },
      danger: {
        backgroundColor: appTheme.danger,
        color: appTheme.onPrimary,
      },
      'xp-focus': {
        backgroundColor: 'rgba(42, 140, 183, 0.14)',
        color: '#2A8CB7',
      },
      'xp-creativity': {
        backgroundColor: 'rgba(230, 184, 92, 0.14)',
        color: '#E6B85C',
      },
    };

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center rounded-full transition-all duration-200 active:scale-95 ${sizes[size]} ${className}`}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
