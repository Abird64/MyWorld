import { useEffect } from 'react';
import { useIsMobile } from './useIsMobile';

/**
 * 移动端软键盘处理：
 * 1. 设置 --keyboard-height CSS 变量
 * 2. 键盘弹出时添加 body.keyboard-open 类，隐藏 BottomTabBar
 * 3. 自动滚动让聚焦的输入框保持可见
 *
 * 前提：App 根容器必须用 height:100dvh（而非 height:100%），
 * 这样 adjustResize 缩小视口时布局才会跟着变。
 */
export function useKeyboardAware() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const body = document.body;

    // 记录「无键盘」状态下的最大 innerHeight，用于检测键盘弹出
    let maxInnerHeight = window.innerHeight;
    let hasInputFocus = false;
    let keyboardOpen = false;

    const setKeyboardOpen = (open: boolean) => {
      if (open === keyboardOpen) return;
      keyboardOpen = open;
      body.classList.toggle('keyboard-open', open);
    };

    const onResize = () => {
      const ih = window.innerHeight;

      // 无输入聚焦时，持续更新基准高度（适应屏幕旋转等）
      if (!hasInputFocus) {
        if (ih > maxInnerHeight) maxInnerHeight = ih;
        return;
      }

      // 有输入聚焦时，视口缩小 = 键盘弹出
      const shrink = maxInnerHeight - ih;
      if (shrink > 100) {
        root.style.setProperty('--keyboard-height', `${shrink}px`);
        setKeyboardOpen(true);
        // 延迟滚动，等布局稳定
        setTimeout(() => {
          const active = document.activeElement;
          if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
            active.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') {
        hasInputFocus = true;
      }
    };

    const onFocusOut = () => {
      hasInputFocus = false;
      root.style.setProperty('--keyboard-height', '0px');
      setKeyboardOpen(false);
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);

    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      root.style.setProperty('--keyboard-height', '0px');
      body.classList.remove('keyboard-open');
    };
  }, [isMobile]);
}
