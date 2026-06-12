import { ChevronRight } from 'lucide-react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import type { Wish } from '@/types/wish';
import { WISH_LEVELS } from '@/types/wish';
import { LEVEL_ICONS } from './config';

interface PityModalProps {
  show: boolean;
  onClose: () => void;
  pityType: 'micro' | 'shimmer';
  wishes: Wish[];
  claimPityWish: (type: 'micro' | 'shimmer', wishId: string) => Promise<unknown>;
  onClaimed: () => void;
}

export function PityModal({ show, onClose, pityType, wishes, claimPityWish, onClaimed }: PityModalProps) {
  const appTheme = useAppTheme();

  if (!show) return null;

  const poolWishes = wishes.filter((w) => {
    const inPool = pityType === 'micro' ? (w.level === 1 || w.level === 2) : (w.level === 3 || w.level === 4);
    const hasStock = w.quantity === -1 || w.achieved_count < w.quantity;
    return inPool && hasStock;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 max-h-[70vh] flex flex-col"
        style={{ backgroundColor: appTheme.canvas }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1" style={{ color: appTheme.ink }}>
          自选心愿
        </h3>
        <p className="text-xs mb-4" style={{ color: appTheme.inkMuted48 }}>
          {pityType === 'micro' ? '微光奖池 · Lv.1-2' : '拾光奖池 · Lv.3-4'} · 免费任选一个
        </p>
        <div className="flex-1 overflow-y-auto space-y-2">
          {poolWishes.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: appTheme.inkMuted48 }}>
              暂无可选心愿，请先添加
            </p>
          ) : (
            poolWishes.map((wish) => {
              const levelConfig = WISH_LEVELS[wish.level];
              const Icon = LEVEL_ICONS[wish.level];
              return (
                <button
                  key={wish.id}
                  onClick={async () => {
                    try {
                      await claimPityWish(pityType, wish.id);
                      onClose();
                      onClaimed();
                    } catch (e) {
                      console.error('Claim pity failed:', e);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:opacity-80"
                  style={{ backgroundColor: appTheme.surfacePearl }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${withAlpha(levelConfig.color, 0.15)}` }}
                  >
                    <Icon size={14} style={{ color: levelConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: appTheme.ink }}>{wish.title}</p>
                    <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                      {levelConfig.name}
                    </p>
                  </div>
                  <ChevronRight size={16} style={{ color: appTheme.inkMuted48 }} />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
