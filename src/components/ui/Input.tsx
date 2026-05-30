import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useAppTheme } from '@/stores/themeStore';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'search' | 'underline';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', variant = 'default', style, ...props }, ref) => {
    const appTheme = useAppTheme();
    const base = 'w-full px-4 py-2.5 text-[17px] transition-all focus:outline-none';

    const variantStyles: Record<string, React.CSSProperties> = {
      default: {
        backgroundColor: appTheme.canvas,
        color: appTheme.ink,
        border: `1px solid ${appTheme.hairline}`,
        borderRadius: 11,
      },
      search: {
        backgroundColor: appTheme.canvas,
        color: appTheme.ink,
        border: `1px solid ${appTheme.hairline}`,
        borderRadius: 9999,
      },
      underline: {
        backgroundColor: 'transparent',
        color: appTheme.ink,
        border: 'none',
        borderBottom: `2px solid ${appTheme.hairline}`,
        borderRadius: 0,
      },
    };

    return (
      <input
        ref={ref}
        className={`${base} ${className}`}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

// ========== Textarea ==========
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'filled' | 'plain';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', variant = 'default', style, ...props }, ref) => {
    const appTheme = useAppTheme();
    const base = 'w-full text-[17px] focus:outline-none resize-none';

    const variantStyles: Record<string, React.CSSProperties> = {
      default: {
        backgroundColor: appTheme.canvas,
        color: appTheme.ink,
        border: `1px solid ${appTheme.hairline}`,
        borderRadius: 18,
        padding: '16px',
      },
      filled: {
        backgroundColor: appTheme.canvasParchment,
        color: appTheme.ink,
        borderRadius: 12,
        padding: '16px',
      },
      plain: {
        backgroundColor: 'transparent',
        color: appTheme.ink,
        padding: '16px',
      },
    };

    return (
      <textarea
        ref={ref}
        className={`${base} ${className}`}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
