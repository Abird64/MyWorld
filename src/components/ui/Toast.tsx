import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppTheme, withAlpha } from '@/stores/themeStore';

interface ToastProps {
  message: string;
  visible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, visible, onClose, duration = 2800 }: ToastProps) {
  const appTheme = useAppTheme();
  const [show, setShow] = useState(false);
  const [text, setText] = useState(message);

  useEffect(() => {
    if (!visible) return;
    setText(message);
    setShow(true);
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [visible, message, duration, onClose]);

  if (!visible && !show) return null;

  return createPortal(
    <div
      className="fixed bottom-24 z-[60] px-5 py-3 rounded-full text-sm transition-all duration-300"
      style={{
        left: '50%',
        backgroundColor: appTheme.canvas,
        color: appTheme.ink,
        border: `0.5px solid ${appTheme.hairline}`,
        boxShadow: `0 4px 24px ${withAlpha(appTheme.ink, 0.1)}`,
        opacity: show ? 1 : 0,
        transform: show ? 'translateX(-50%)' : 'translateX(-50%) translateY(16px)',
      }}
    >
      {text}
    </div>,
    document.body
  );
}
