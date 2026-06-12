import { Sparkle, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import type { Wish } from '@/types/wish';
import { WISH_LEVEL_NAMES } from '@/types/wish';
import { LEVEL_ICONS } from './config';

interface DrawResultModalProps {
  isDrawing: boolean;
  drawResult: {
    success: boolean;
    wish: Wish | null;
    is_pity: boolean;
    pity_count: number;
    message: string;
  } | null;
  cardFlipped: boolean;
  showResult: boolean;
  onClose: () => void;
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#7EB8A2',
  2: '#5A9A9E',
  3: '#C49A6C',
  4: '#B76E79',
};

export function DrawResultModal({ isDrawing, drawResult, cardFlipped, showResult, onClose }: DrawResultModalProps) {
  const appTheme = useAppTheme();

  return (
    <AnimatePresence>
      {isDrawing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Card Container with 3D flip */}
            <div
              className="relative w-72 h-96 cursor-pointer"
              style={{ perspective: '1000px' }}
              onClick={showResult ? onClose : undefined}
            >
              <motion.div
                className="absolute inset-0 w-full h-full rounded-2xl shadow-2xl"
                style={{
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                }}
                animate={{
                  rotateY: cardFlipped ? 180 : 0,
                }}
                transition={{
                  duration: 0.6,
                  ease: [0.4, 0, 0.2, 1],
                }}
              >
                {/* Card Front (Back of the card) */}
                <div
                  className="absolute inset-0 w-full h-full rounded-2xl flex flex-col items-center justify-center"
                  style={{
                    background: `repeating-linear-gradient(45deg, ${withAlpha(appTheme.ink, 0.1)} 0px, ${withAlpha(appTheme.ink, 0.1)} 10px, ${withAlpha(appTheme.ink, 0.05)} 10px, ${withAlpha(appTheme.ink, 0.05)} 20px)`,
                    border: `2px solid ${withAlpha(appTheme.ink, 0.2)}`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <Shuffle size={48} style={{ color: withAlpha(appTheme.ink, 0.3) }} />
                  <p className="mt-4 text-sm" style={{ color: appTheme.inkMuted48 }}>
                    抽取中...
                  </p>
                </div>

                {/* Card Back (The result) */}
                <div
                  className="absolute inset-0 w-full h-full rounded-2xl flex flex-col items-center justify-center p-6"
                  style={{
                    backgroundColor: drawResult?.wish
                      ? LEVEL_COLORS[drawResult.wish.level]
                      : appTheme.surfacePearl,
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  {drawResult?.wish ? (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                      >
                        {(() => {
                          const Icon = LEVEL_ICONS[drawResult.wish!.level];
                          return <Icon size={48} style={{ color: '#fff' }} />;
                        })()}
                      </motion.div>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-4 text-lg font-semibold text-center"
                        style={{ color: '#fff' }}
                      >
                        {drawResult.wish.title}
                      </motion.p>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mt-2 text-sm text-center"
                        style={{ color: 'rgba(255,255,255,0.8)' }}
                      >
                        Lv.{drawResult.wish.level} · {WISH_LEVEL_NAMES[drawResult.wish.level]}
                      </motion.p>
                      {drawResult.wish.description && (
                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                          className="mt-4 text-xs text-center line-clamp-3"
                          style={{ color: 'rgba(255,255,255,0.6)' }}
                        >
                          {drawResult.wish.description}
                        </motion.p>
                      )}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="mt-6 px-6 py-2 rounded-full text-sm font-medium text-center"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.25)',
                          color: '#fff',
                        }}
                      >
                        已入库
                      </motion.div>
                    </>
                  ) : (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring' }}
                      >
                        <Sparkle size={48} style={{ color: appTheme.inkMuted48 }} />
                      </motion.div>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="mt-4 text-sm text-center"
                        style={{ color: appTheme.inkMuted48 }}
                      >
                        {drawResult?.message || '这次没有抽中'}
                      </motion.p>
                    </>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Click to close hint */}
            {showResult && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-center mt-6 text-sm"
                style={{ color: appTheme.inkMuted48 }}
              >
                点击卡片关闭
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
