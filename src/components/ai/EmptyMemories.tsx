import { useRef } from 'react';
import { BookOpen } from 'lucide-react';
import { Fireflies } from '@/components/ui';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { motion } from 'motion/react';

const MEMORY_POEMS = [
  '萤火还在等待，等待被记住的故事',
  '记忆是飞舞的萤火，会在某个时刻亮起',
  '提灯会记住你提到的一切',
  '有些故事，值得被反复诉说',
  '记忆如萤火，微光却永恒',
  '你走过的每一步，都会化作星光',
  '等待第一只萤火，飞入夜的怀抱',
  '故事还在路上，萤火会接住它们',
];

export function EmptyMemories() {
  const appTheme = useAppTheme();
  const isMobile = useIsMobile();
  const emptyStateRef = useRef<HTMLDivElement>(null);
  const randomPoem = MEMORY_POEMS[Math.floor(Math.random() * MEMORY_POEMS.length)];

  return (
    <div
      ref={emptyStateRef}
      className="flex flex-col items-center justify-center h-full relative"
      style={{ color: appTheme.inkMuted48 }}
    >
      {/* 萤火虫背景 */}
      <Fireflies count={6} mouseTarget={emptyStateRef} />

      {/* 书本/记忆图标动画 */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative mb-6"
      >
        {/* 光晕 - 移动端不用 blur（Android WebView CPU 渲染导致卡顿） */}
        {!isMobile && (
          <div
            className="absolute inset-0 blur-2xl opacity-30"
            style={{
              background: `radial-gradient(circle, ${withAlpha('#A8E6CF', 0.4)} 0%, transparent 70%)`,
              transform: 'scale(1.5)',
            }}
          />
        )}
        <BookOpen
          size={56}
          className="relative z-10"
          style={{
            color: withAlpha('#A8E6CF', 0.7),
          }}
        />
      </motion.div>

      {/* 诗意文案 */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-base font-light mb-2 text-center px-6"
        style={{ color: appTheme.inkMuted80 }}
      >
        {randomPoem}
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="text-xs px-6 text-center"
        style={{ color: appTheme.inkMuted48 }}
      >
        当你在对话中提到值得记住的事<br />
        提灯会帮你捕捉那些飞舞的萤火
      </motion.p>

      {/* 微光提示 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="absolute bottom-20 flex items-center gap-2 text-[10px]"
        style={{ color: withAlpha('#A8E6CF', 0.5) }}
      >
        <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: '#A8E6CF' }} />
        <span>等待第一只萤火</span>
      </motion.div>
    </div>
  );
}
