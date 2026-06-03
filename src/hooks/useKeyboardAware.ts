import { useEffect } from 'react';
import { useIsMobile } from './useIsMobile';

/**
 * 移动端软键盘弹出时，自动滚动让聚焦的输入框保持可见。
 * 通过 visualViewport 监听视口高度变化来检测键盘。
 */
export function useKeyboardAware() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    let previousHeight = viewport.height;

    const onResize = () => {
      const currentHeight = viewport.height;
      // 键盘弹出时视口高度会缩小
      if (currentHeight < previousHeight - 100) {
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
          setTimeout(() => {
            active.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }
      previousHeight = currentHeight;
    };

    viewport.addEventListener('resize', onResize);
    return () => viewport.removeEventListener('resize', onResize);
  }, [isMobile]);
}
