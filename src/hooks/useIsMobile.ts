import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768;

// 编译时检测：Tauri Android 平台
let _isAndroid = false;
try {
  // Tauri 2 注入的内部对象，platform 字段在编译时确定
  _isAndroid = (window as any).__TAURI_INTERNALS__?.platform === 'android';
} catch {}

// 运行时检测：窗口宽度
const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

function getSnapshot() {
  return mql.matches;
}

function subscribe(callback: () => void) {
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

/** 是否为移动端（Android 或窄屏） */
export function useIsMobile(): boolean {
  const isNarrow = useSyncExternalStore(subscribe, getSnapshot);
  return _isAndroid || isNarrow;
}
