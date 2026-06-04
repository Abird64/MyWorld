import { Ticket } from 'lucide-react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import type { GlowBalance } from '@/types/wish';

interface ShopModalProps {
  show: boolean;
  onClose: () => void;
  balance: GlowBalance | null;
  isLoading: boolean;
  buyTickets: (type: 'micro' | 'shimmer', count: number) => Promise<void>;
}

export function ShopModal({ show, onClose, balance, isLoading, buyTickets }: ShopModalProps) {
  const appTheme = useAppTheme();

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ backgroundColor: appTheme.canvas }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: appTheme.ink }}>
          奖券商店
        </h3>
        <div className="space-y-4">
          {/* 微光奖券 */}
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: `${withAlpha('#E8B959', 0.1)}`, border: `1px solid ${withAlpha('#E8B959', 0.3)}` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Ticket size={20} style={{ color: '#E8B959' }} />
                <span className="font-medium" style={{ color: '#E8B959' }}>微光奖券</span>
              </div>
              <span className="text-sm" style={{ color: appTheme.inkMuted48 }}>100 萤火/张</span>
            </div>
            <div className="flex gap-2">
              {[1, 5, 10].map((count) => (
                <button
                  key={count}
                  onClick={() => buyTickets('micro', count)}
                  disabled={isLoading || (balance?.glow_amount ?? 0) < count * 100}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                  style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.ink }}
                >
                  买 {count} 张
                </button>
              ))}
            </div>
          </div>
          {/* 拾光奖券 */}
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: `${withAlpha('#C49A6C', 0.1)}`, border: `1px solid ${withAlpha('#C49A6C', 0.3)}` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Ticket size={20} style={{ color: '#C49A6C' }} />
                <span className="font-medium" style={{ color: '#C49A6C' }}>拾光奖券</span>
              </div>
              <span className="text-sm" style={{ color: appTheme.inkMuted48 }}>500 萤火/张</span>
            </div>
            <div className="flex gap-2">
              {[1, 3, 5].map((count) => (
                <button
                  key={count}
                  onClick={() => buyTickets('shimmer', count)}
                  disabled={isLoading || (balance?.glow_amount ?? 0) < count * 500}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                  style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.ink }}
                >
                  买 {count} 张
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ backgroundColor: appTheme.surfacePearl, color: appTheme.ink }}
        >
          关闭
        </button>
      </div>
    </div>
  );
}
