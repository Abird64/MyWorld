import { useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';

interface LanternSvgProps {
  className?: string;
  accentColor?: string;
  isDark?: boolean;
}

export function LanternSvg({ className, accentColor = '#4CAF76', isDark = true }: LanternSvgProps) {
  const eyeColor = isDark ? '#A8E6CF' : '#2D6B4F';
  const frameColor = isDark ? 'rgba(255,255,255,0.12)' : '#4A4A4A';
  const frameDim = isDark ? 'rgba(255,255,255,0.08)' : '#6A6A6A';
  const leftEyeRef = useRef<SVGLineElement>(null);
  const rightEyeRef = useRef<SVGLineElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    // 移动端不跟踪触摸/鼠标（没有光标指针，touchmove 追踪无意义且消耗性能）
    if (isMobile) return;

    const leftEye = leftEyeRef.current;
    const rightEye = rightEyeRef.current;
    const svg = svgRef.current;
    if (!leftEye || !rightEye || !svg) return;

    const leftEyeCenter = { x: 165, y: 280 };
    const rightEyeCenter = { x: 235, y: 280 };
    const eyesMidpoint = {
      x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
      y: leftEyeCenter.y,
    };

    let pendingClientX = 0;
    let pendingClientY = 0;
    let rafId = 0;

    function updateEyeLine(
      eyeElement: SVGLineElement,
      center: { x: number; y: number },
      mx: number,
      my: number
    ) {
      const dx = mx - eyesMidpoint.x;
      const dy = my - eyesMidpoint.y;
      const distanceToMid = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      const maxDist = 400;
      const clampedDist = Math.min(distanceToMid, maxDist);
      const distanceRatio = clampedDist / maxDist;

      const minLength = 4;
      const maxLength = 25;
      const eyeLength = minLength + distanceRatio * (maxLength - minLength);

      const maxOffsetX = 8;
      const maxOffsetY = 12;
      const offsetX = Math.cos(angle) * maxOffsetX * distanceRatio;
      const offsetY = Math.sin(angle) * maxOffsetY * distanceRatio;

      const eyeX = center.x + offsetX;
      const eyeY = center.y + offsetY;
      const halfLength = eyeLength / 2;

      eyeElement.setAttribute('x1', String(eyeX));
      eyeElement.setAttribute('y1', String(eyeY - halfLength));
      eyeElement.setAttribute('x2', String(eyeX));
      eyeElement.setAttribute('y2', String(eyeY + halfLength));
    }

    function updateEyes(clientX: number, clientY: number) {
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = 400 / rect.width;
      const scaleY = 500 / rect.height;
      const svgMouseX = (clientX - rect.left) * scaleX;
      const svgMouseY = (clientY - rect.top) * scaleY;
      updateEyeLine(leftEye!, leftEyeCenter, svgMouseX, svgMouseY);
      updateEyeLine(rightEye!, rightEyeCenter, svgMouseX, svgMouseY);
    }

    // 用 rAF 节流，避免每个 mousemove 事件都触发 getBoundingClientRect + SVG 写操作
    const scheduleUpdate = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          updateEyes(pendingClientX, pendingClientY);
        });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      pendingClientX = e.clientX;
      pendingClientY = e.clientY;
      scheduleUpdate();
    };

    document.addEventListener('mousemove', onMouseMove, { passive: true });

    // 眨眼
    let blinkTimer: ReturnType<typeof setTimeout>;
    function blink() {
      leftEye!.classList.add('blinking');
      rightEye!.classList.add('blinking');
      blinkTimer = setTimeout(() => {
        leftEye!.classList.remove('blinking');
        rightEye!.classList.remove('blinking');
      }, 250);
      setTimeout(blink, 3000 + Math.random() * 4000);
    }
    const startTimer = setTimeout(blink, 3000);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafId);
      clearTimeout(blinkTimer);
      clearTimeout(startTimer);
    };
  }, [isMobile]);

  return (
    <>
      <style>{`
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.9; }
        }
        @keyframes eyeBlink {
          0%, 45%, 55%, 100% { opacity: 0.9; }
          50% { opacity: 0.3; stroke-width: 5; }
        }
        .lantern-glow {
          animation: glowPulse 2s ease-in-out infinite;
        }
        @media (hover: none) and (pointer: coarse) {
          .lantern-glow {
            animation: none;
            opacity: 0.75;
          }
        }
        .eye-line.blinking {
          animation: eyeBlink 0.25s ease-in-out;
        }
      `}</style>
      <svg
        ref={svgRef}
        viewBox="0 0 400 500"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <clipPath id="ringClip">
            <rect x="0" y="0" width="400" height="155" />
          </clipPath>
          <radialGradient id="lanternGlow" cx="50%" cy="65%" r="35%">
            <stop offset="0%" stopColor={accentColor} stopOpacity={0.4} />
            <stop offset="50%" stopColor={accentColor} stopOpacity={0.15} />
            <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="lanternFill" cx="50%" cy="60%" r="50%">
            <stop offset="0%" stopColor={accentColor} stopOpacity={0.35} />
            <stop offset="60%" stopColor={accentColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={accentColor} stopOpacity={0.08} />
          </radialGradient>
          <clipPath id="glassClip">
            <path d="M145,180 L90,280 L145,430 L255,430 L310,280 L255,180 Z" />
          </clipPath>
        </defs>

        {/* 背景光晕 */}
        <ellipse cx="200" cy="290" rx="100" ry="120" fill="url(#lanternGlow)" className="lantern-glow" />

        {/* 灯体填充 */}
        <g clipPath="url(#glassClip)">
          <path
            d="M145,180 L90,280 L145,430 L255,430 L310,280 L255,180 Z"
            fill="url(#lanternFill)"
          />

          {/* 眼睛 */}
          <g>
            <line
              ref={leftEyeRef}
              className="eye-line"
              x1="165" y1="275" x2="165" y2="285"
              stroke={eyeColor} strokeWidth={12} strokeLinecap="round" opacity={0.9}
            />
            <line
              ref={rightEyeRef}
              className="eye-line"
              x1="235" y1="275" x2="235" y2="285"
              stroke={eyeColor} strokeWidth={12} strokeLinecap="round" opacity={0.9}
            />
          </g>
        </g>

        {/* 顶部提手圆环 */}
        <g clipPath="url(#ringClip)">
          <ellipse cx="200" cy="110" rx="75" ry="75" fill="none" stroke={frameColor} strokeWidth={3} />
          <ellipse cx="200" cy="110" rx="58" ry="58" fill="none" stroke={frameColor} strokeWidth={2} />
        </g>

        {/* 顶部连接方块 */}
        <rect x="175" y="140" width="50" height="15" fill="none" stroke={frameColor} strokeWidth={3} />
        <rect x="130" y="155" width="140" height="25" fill="none" stroke={frameColor} strokeWidth={3} />

        {/* 灯体外框 */}
        <path d="M130,180 L70,280 L130,430" fill="none" stroke={frameColor} strokeWidth={3} />
        <path d="M270,180 L330,280 L270,430" fill="none" stroke={frameColor} strokeWidth={3} />
        <path d="M145,180 L90,280 L145,430" fill="none" stroke={frameDim} strokeWidth={2} />
        <path d="M255,180 L310,280 L255,430" fill="none" stroke={frameDim} strokeWidth={2} />

        {/* 玻璃罩边框 */}
        <line x1="130" y1="180" x2="145" y2="180" stroke={frameColor} strokeWidth={3} />
        <line x1="255" y1="180" x2="270" y2="180" stroke={frameColor} strokeWidth={3} />

        {/* 底部横条 */}
        <rect x="120" y="430" width="160" height="18" fill="none" stroke={frameColor} strokeWidth={3} />
        <rect x="100" y="448" width="200" height="22" fill="none" stroke={frameColor} strokeWidth={3} />
      </svg>
    </>
  );
}
