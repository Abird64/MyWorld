import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useThemeStore } from '@/stores/themeStore';
import { useIsMobile } from '@/hooks/useIsMobile';

export function WindowControls() {
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState<number | null>(null);
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';

  if (isMobile) return null;

  const appWindow = getCurrentWindow();

  const buttons = [
    {
      id: 0,
      color: '#28C840',
      label: '最小化',
      action: () => appWindow.minimize(),
    },
    {
      id: 1,
      color: '#FEBC2E',
      label: '恢复',
      action: () => appWindow.toggleMaximize(),
    },
    {
      id: 2,
      color: '#FF5F57',
      label: '关闭',
      action: () => appWindow.close(),
    },
  ];

  const iconStroke = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';

  return (
    <div className="flex items-center gap-2">
      {buttons.map((btn) => (
        <button
          key={btn.id}
          title={btn.label}
          className="w-4 h-4 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center"
          style={{
            backgroundColor: btn.color,
          }}
          onMouseEnter={() => setHovered(btn.id)}
          onMouseLeave={() => setHovered(null)}
          onClick={btn.action}
        >
          {hovered === btn.id && (
            <svg
              width="7"
              height="7"
              viewBox="0 0 10 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {btn.id === 0 && (
                <path
                  d="M1 5H9"
                  stroke={iconStroke}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              )}
              {btn.id === 1 && (
                <rect
                  x="2"
                  y="2"
                  width="6"
                  height="6"
                  rx="0.5"
                  stroke={iconStroke}
                  strokeWidth="1.5"
                  fill="none"
                />
              )}
              {btn.id === 2 && (
                <path
                  d="M2 2L8 8M8 2L2 8"
                  stroke={iconStroke}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              )}
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
