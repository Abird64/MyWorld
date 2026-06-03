import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsOptions {
  /** 发送消息 (Cmd/Ctrl+Enter) */
  onSend?: () => void;
  /** 关闭/返回 (Esc) */
  onClose?: () => void;
  /** 聚焦输入框 (/ 或 Cmd+K) */
  onFocusInput?: () => void;
  /** 新建对话 (Cmd+N) */
  onNewConversation?: () => void;
  /** 上一个对话 (Cmd+Up) */
  onPrevConversation?: () => void;
  /** 下一个对话 (Cmd+Down) */
  onNextConversation?: () => void;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 提灯页面键盘快捷键钩子
 *
 * 快捷键映射:
 * - Cmd/Ctrl + Enter: 发送消息
 * - Esc: 关闭侧边栏/返回
 * - / 或 Cmd/Ctrl + K: 聚焦输入框
 * - Cmd/Ctrl + N: 新建对话
 * - Cmd/Ctrl + ↑: 上一个对话
 * - Cmd/Ctrl + ↓: 下一个对话
 */
export function useKeyboardShortcuts(options: KeyboardShortcutsOptions) {
  const {
    onSend,
    onClose,
    onFocusInput,
    onNewConversation,
    onPrevConversation,
    onNextConversation,
    enabled = true,
  } = options;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // 忽略在输入框、文本域或内容编辑区域中的快捷键（除非是发送）
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    const isCmdOrCtrl = e.metaKey || e.ctrlKey;

    // Cmd/Ctrl + Enter: 发送消息
    if (isCmdOrCtrl && e.key === 'Enter' && onSend) {
      e.preventDefault();
      onSend();
      return;
    }

    // Esc: 关闭/返回
    if (e.key === 'Escape' && onClose) {
      e.preventDefault();
      onClose();
      return;
    }

    // 在输入框内时，不处理其他快捷键
    if (isInput) return;

    // / 或 Cmd/Ctrl + K: 聚焦输入框
    if ((e.key === '/' || (isCmdOrCtrl && e.key === 'k')) && onFocusInput) {
      e.preventDefault();
      onFocusInput();
      return;
    }

    // Cmd/Ctrl + N: 新建对话
    if (isCmdOrCtrl && e.key === 'n' && onNewConversation) {
      e.preventDefault();
      onNewConversation();
      return;
    }

    // Cmd/Ctrl + ↑: 上一个对话
    if (isCmdOrCtrl && e.key === 'ArrowUp' && onPrevConversation) {
      e.preventDefault();
      onPrevConversation();
      return;
    }

    // Cmd/Ctrl + ↓: 下一个对话
    if (isCmdOrCtrl && e.key === 'ArrowDown' && onNextConversation) {
      e.preventDefault();
      onNextConversation();
      return;
    }
  }, [
    enabled,
    onSend,
    onClose,
    onFocusInput,
    onNewConversation,
    onPrevConversation,
    onNextConversation,
  ]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

/**
 * 显示快捷键提示
 */
export function getShortcutLabel(action: string): string {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const modifier = isMac ? '⌘' : 'Ctrl';

  const labels: Record<string, string> = {
    send: `${modifier} + Enter`,
    close: 'Esc',
    focus: '/',
    newConversation: `${modifier} + N`,
    prevConversation: `${modifier} + ↑`,
    nextConversation: `${modifier} + ↓`,
  };

  return labels[action] || '';
}
