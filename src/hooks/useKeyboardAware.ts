import { useEffect } from 'react';
import { useIsMobile } from './useIsMobile';

/**
 * 移动端软键盘处理：
 * 1. 设置 --keyboard-height CSS 变量（= layoutViewportHeight - visualViewportHeight）
 *    让底部固定元素随键盘抬起
 * 2. 键盘弹出时自动滚动让聚焦的输入框保持可见
 */
export function useKeyboardAware() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    let previousHeight = viewport.height;

    const onResize = () => {
      const currentHeight = viewport.height;
      const keyboardHeight = Math.max(0, window.innerHeight - currentHeight);

      root.style.setProperty('--keyboard-height', `${keyboardHeight}px`);

      if (currentHeight < previousHeight - 60) {
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
          setTimeout(() => {
            active.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
        }
      }
      previousHeight = currentHeight;
    };

    viewport.addEventListener('resize', onResize);
    return () => viewport.removeEventListener('resize', onResize);
  }, [isMobile]);
}
