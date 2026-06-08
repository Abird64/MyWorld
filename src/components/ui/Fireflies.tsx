import { useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';

interface FireflyData {
  el: HTMLDivElement;
  x: number;
  y: number;
  heading: number;         // 当前朝向（弧度）
  headingNoise: number;    // 噪声偏移（每只不同）
  noiseSpeed: number;      // 噪声变化速率
  speed: number;           // 飞行速度（px/s）
  anchorX: number;
  anchorY: number;
  wanderTimer: number;
  wanderInterval: number;
  farWanderTimer: number;
  farWanderInterval: number;
}

interface FirefliesProps {
  count?: number;
  className?: string;
  /** 鼠标监听的目标元素（父容器），默认用自身 */
  mouseTarget?: React.RefObject<HTMLElement | null>;
}

export function Fireflies({ count = 7, className = '', mouseTarget }: FirefliesProps) {
  const isMobile = useIsMobile();
  const actualCount = isMobile ? Math.min(count, 3) : count;
  const containerRef = useRef<HTMLDivElement>(null);
  const firefliesRef = useRef<FireflyData[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const pageVisibleRef = useRef(true);

  // 监听页面可见性，隐藏时暂停动画
  useEffect(() => {
    const onVis = () => { pageVisibleRef.current = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const initFireflies = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    firefliesRef.current.forEach((f) => f.el.remove());
    firefliesRef.current = [];

    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height * 0.42;

    for (let i = 0; i < actualCount; i++) {
      const el = document.createElement('div');
      el.className = 'firefly-dot';

      const duration = 3 + Math.random() * 4;
      const delay = Math.random() * duration;
      el.style.animationDuration = `${duration}s`;
      el.style.animationDelay = `${-delay}s`;

      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 100;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      container.appendChild(el);

      firefliesRef.current.push({
        el,
        x,
        y,
        heading: Math.random() * Math.PI * 2,
        headingNoise: Math.random() * 1000,  // 噪声种子
        noiseSpeed: 0.3 + Math.random() * 0.4, // 每只转向速率不同
        speed: 8 + Math.random() * 6,          // 8~14 px/s，慢悠悠
        anchorX: x,
        anchorY: y,
        wanderTimer: Math.random() * 5000,
        wanderInterval: 5000 + Math.random() * 8000,
        farWanderTimer: 10000 + Math.random() * 25000,
        farWanderInterval: 25000 + Math.random() * 35000,
      });
    }
  }, [actualCount]);

  useEffect(() => {
    initFireflies();
    const handleResize = () => initFireflies();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      firefliesRef.current.forEach((f) => f.el.remove());
      firefliesRef.current = [];
    };
  }, [initFireflies]);

  // 移动端不需要鼠标追踪
  useEffect(() => {
    if (isMobile) return;
    const target = mouseTarget?.current || containerRef.current;
    if (!target) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = target.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    target.addEventListener('mousemove', onMouseMove, { passive: true });
    target.addEventListener('mouseleave', onMouseLeave);
    return () => {
      target.removeEventListener('mousemove', onMouseMove);
      target.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [mouseTarget, isMobile]);

  // 简单的平滑噪声：用 sin 近似，产生连续的曲线值
  const noise = (t: number, seed: number) => {
    return Math.sin(t * 1.1 + seed) * 0.6
         + Math.sin(t * 0.7 + seed * 2.3) * 0.3
         + Math.sin(t * 1.9 + seed * 0.7) * 0.1;
  };

  useEffect(() => {
    // 移动端跳过 rAF 循环，只使用 CSS 呼吸动画（省 CPU/GPU）
    if (isMobile) return;

    let lastTime = performance.now();

    const tick = (now: number) => {
      // 页面隐藏时暂停更新，但仍请求下一帧以便恢复
      if (!pageVisibleRef.current) {
        lastTime = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min(now - lastTime, 50);
      lastTime = now;
      timeRef.current += dt / 1000;
      const t = timeRef.current;

      const container = containerRef.current;
      if (!container) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height * 0.42;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const dtSec = dt / 1000;

      for (const f of firefliesRef.current) {
        // 1. 漫游：随机更换锚点
        f.wanderTimer -= dt;
        if (f.wanderTimer <= 0) {
          f.wanderTimer = f.wanderInterval;
          const a = Math.random() * Math.PI * 2;
          const d = 30 + Math.random() * 100;
          f.anchorX = cx + Math.cos(a) * d;
          f.anchorY = cy + Math.sin(a) * d;
        }

        // 2. 远行
        f.farWanderTimer -= dt;
        if (f.farWanderTimer <= 0) {
          f.farWanderTimer = f.farWanderInterval;
          const edge = Math.floor(Math.random() * 4);
          switch (edge) {
            case 0: f.anchorX = Math.random() * rect.width; f.anchorY = 20; break;
            case 1: f.anchorX = rect.width - 20; f.anchorY = Math.random() * rect.height; break;
            case 2: f.anchorX = Math.random() * rect.width; f.anchorY = rect.height - 20; break;
            case 3: f.anchorX = 20; f.anchorY = Math.random() * rect.height; break;
          }
        }

        // 3. 噪声驱动朝向转向（核心：产生曲线路径）
        const turnRate = noise(t * f.noiseSpeed, f.headingNoise);
        f.heading += turnRate * 1.5 * dtSec;

        // 4. 极弱的锚点偏航（不直接拉过去，只轻微偏向）
        const dxA = f.anchorX - f.x;
        const dyA = f.anchorY - f.y;
        const distA = Math.sqrt(dxA * dxA + dyA * dyA);
        if (distA > 60) {
          const targetAngle = Math.atan2(dxA, dxA);
          let angleDiff = targetAngle - f.heading;
          // 归一化到 [-PI, PI]
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          f.heading += angleDiff * 0.15 * dtSec;
        }

        // 5. 鼠标驱散：转向远离鼠标
        const dxM = f.x - mx;
        const dyM = f.y - my;
        const distM = Math.sqrt(dxM * dxM + dyM * dyM);
        if (distM < 120 && distM > 0) {
          const awayAngle = Math.atan2(dyM, dxM);
          let angleDiff = awayAngle - f.heading;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          const strength = (1 - distM / 120) * 3;
          f.heading += angleDiff * strength * dtSec;
        }

        // 6. 沿朝向匀速前进
        f.x += Math.cos(f.heading) * f.speed * dtSec;
        f.y += Math.sin(f.heading) * f.speed * dtSec;

        // 7. 边界弹回（碰到边缘就转向）
        if (f.x < 10) { f.x = 10; f.heading = Math.PI - f.heading + (Math.random() - 0.5) * 0.5; }
        if (f.x > rect.width - 10) { f.x = rect.width - 10; f.heading = Math.PI - f.heading + (Math.random() - 0.5) * 0.5; }
        if (f.y < 10) { f.y = 10; f.heading = -f.heading + (Math.random() - 0.5) * 0.5; }
        if (f.y > rect.height - 10) { f.y = rect.height - 10; f.heading = -f.heading + (Math.random() - 0.5) * 0.5; }

        // 8. 应用
        f.el.style.left = `${f.x}px`;
        f.el.style.top = `${f.y}px`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isMobile]);

  return (
    <>
      <style>{isMobile ? `
        .firefly-dot {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #A8E6CF;
          box-shadow: 0 0 6px 3px rgba(168, 230, 207, 0.3);
          pointer-events: none;
          opacity: 0.5;
        }
      ` : `
        .firefly-dot {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #A8E6CF;
          box-shadow: 0 0 6px 3px rgba(168, 230, 207, 0.4),
                      0 0 12px 6px rgba(168, 230, 207, 0.15);
          pointer-events: none;
          animation: fireflyBreathe 4s ease-in-out infinite;
        }

        @keyframes fireflyBreathe {
          0%, 100% { opacity: 0.2; box-shadow: 0 0 4px 2px rgba(168, 230, 207, 0.25); }
          50% { opacity: 0.85; box-shadow: 0 0 8px 4px rgba(168, 230, 207, 0.5), 0 0 16px 8px rgba(168, 230, 207, 0.15); }
        }
      `}</style>
      <div
        ref={containerRef}
        className={`pointer-events-auto ${className}`}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 1 }}
      />
    </>
  );
}
