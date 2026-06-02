interface LanternIconProps {
  size?: number;
  color?: string;
  className?: string;
}

/** 极简提灯轮廓图标，用于底部 Tab */
export function LanternIcon({ size = 22, color = 'currentColor', className }: LanternIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* 提手 */}
      <path d="M9 4.5a3 3 0 0 1 6 0" />
      {/* 连接 */}
      <line x1="12" y1="4.5" x2="12" y2="6" />
      <rect x="9.5" y="6" width="5" height="2" rx="0.5" />
      {/* 灯体 */}
      <path d="M8.5 8 L6 13 L8.5 19 L15.5 19 L18 13 L15.5 8 Z" />
      {/* 眼睛 */}
      <line x1="10.5" y1="12.5" x2="10.5" y2="14" strokeWidth={1.8} />
      <line x1="13.5" y1="12.5" x2="13.5" y2="14" strokeWidth={1.8} />
      {/* 底座 */}
      <line x1="7.5" y1="19" x2="16.5" y2="19" />
      <line x1="7" y1="20.5" x2="17" y2="20.5" />
    </svg>
  );
}
