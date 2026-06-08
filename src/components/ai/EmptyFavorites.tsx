import { useRef } from 'react';
import { Star } from 'lucide-react';
import { Fireflies } from '@/components/ui';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { motion } from 'motion/react';

const FAVORITE_POEMS = [
  '星光落在心里，便成了收藏',
  '有些光，值得被记住',
  '你点亮的每一颗星，都在这里',
  '收藏是光的延续',
  '那些温暖的对话，会一直在',
  '星光不语，却永远明亮',
  '把珍贵的话，放进夜的口袋',
];

export function EmptyFavorites() {
  const appTheme = useAppTheme();
  const isMobile = useIsMobile();
  const emptyStateRef = useRef<HTMLDivElement>(null);
  const randomPoem = FAVORITE_POEMS[Math.floor(Math.random() * FAVORITE_POEMS.length)];

  return (
    <div
      ref={emptyStateRef}
      className="flex flex-col items-center justify-center h-full relative"
      style={{ color: appTheme.inkMuted48 }}
    >
      {/* 萤火虫背景 */}
      <Fireflies count={5} mouseTarget={emptyStateRef} />

      {/* 星星图标动画 */}
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
              background: `radial-gradient(circle, ${withAlpha(appTheme.primary, 0.4)} 0%, transparent 70%)`,
              transform: 'scale(1.5)',
            }}
          />
        )}
        <Star
          size={56}
          className="relative z-10"
          style={{
            color: withAlpha(appTheme.primary, 0.6),
            fill: withAlpha(appTheme.primary, 0.15),
          }}
        />
      </motion.div>

      {/* 诗意文案 */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-base font-light mb-2"
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
        在对话中点击星星，将珍贵的瞬间收藏于此
      </motion.p>

      {/* 微光提示 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="absolute bottom-20 flex items-center gap-2 text-[10px]"
        style={{ color: withAlpha(appTheme.primary, 0.5) }}
      >
        <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: appTheme.primary }} />
        <span>等待第一颗星光</span>
      </motion.div>
    </div>
  );
}
