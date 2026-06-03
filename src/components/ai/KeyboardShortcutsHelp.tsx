import { useState, useEffect } from 'react';
import { X, Keyboard, Command } from 'lucide-react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { motion, AnimatePresence } from 'motion/react';

interface ShortcutItem {
  keys: string[];
  description: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['⌘/Ctrl', 'Enter'], description: '发送消息' },
  { keys: ['/'], description: '聚焦输入框' },
  { keys: ['⌘/Ctrl', 'K'], description: '聚焦输入框（备选）' },
  { keys: ['⌘/Ctrl', 'N'], description: '新建对话' },
  { keys: ['⌘/Ctrl', '↑'], description: '上一个对话' },
  { keys: ['⌘/Ctrl', '↓'], description: '下一个对话' },
  { keys: ['Esc'], description: '关闭侧边栏/返回' },
];

export function KeyboardShortcutsHelp() {
  const appTheme = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(navigator.platform.toLowerCase().includes('mac'));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + / 显示快捷键帮助
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen(true);
      }
      // Esc 关闭帮助
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const formatKey = (key: string) => {
    if (key === '⌘/Ctrl') return isMac ? '⌘' : 'Ctrl';
    return key;
  };

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
        style={{ color: appTheme.inkMuted48 }}
        title="键盘快捷键 (Cmd/Ctrl + /)"
        aria-label="键盘快捷键"
      >
        <Keyboard size={14} />
        <span className="hidden sm:inline">快捷键</span>
      </button>

      {/* 弹窗 */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
              onClick={() => setIsOpen(false)}
            />

            {/* 内容 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-2xl overflow-hidden"
              style={{
                backgroundColor: appTheme.canvas,
                border: `1px solid ${appTheme.hairline}`,
              }}
            >
              {/* 头部 */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: `1px solid ${appTheme.hairline}` }}
              >
                <div className="flex items-center gap-2">
                  <Command size={18} style={{ color: appTheme.primary }} />
                  <span className="font-medium" style={{ color: appTheme.ink }}>
                    键盘快捷键
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                  style={{ color: appTheme.inkMuted48 }}
                  aria-label="关闭"
                >
                  <X size={16} />
                </button>
              </div>

              {/* 快捷键列表 */}
              <div className="p-4 space-y-2">
                {SHORTCUTS.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-lg"
                    style={{ backgroundColor: withAlpha(appTheme.ink, 0.03) }}
                  >
                    <span className="text-sm" style={{ color: appTheme.inkMuted80 }}>
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center">
                          <kbd
                            className="px-1.5 py-0.5 rounded text-xs font-mono"
                            style={{
                              backgroundColor: withAlpha(appTheme.ink, 0.08),
                              color: appTheme.inkMuted80,
                              border: `1px solid ${appTheme.hairline}`,
                            }}
                          >
                            {formatKey(key)}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="mx-1 text-xs" style={{ color: appTheme.inkMuted48 }}>
                              +
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 底部提示 */}
              <div
                className="px-4 py-3 text-xs text-center"
                style={{ color: appTheme.inkMuted48, borderTop: `1px solid ${appTheme.hairline}` }}
              >
                按 {isMac ? '⌘' : 'Ctrl'} + / 随时打开此帮助
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
