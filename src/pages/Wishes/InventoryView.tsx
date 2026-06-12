import { Gift, Package, CheckCircle } from 'lucide-react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import type { InventoryItem } from '@/types/wish';
import { WISH_LEVEL_NAMES } from '@/types/wish';
import { LEVEL_ICONS } from './config';
import { useState } from 'react';

interface InventoryViewProps {
  items: InventoryItem[];
  onRedeem: (drawId: string) => Promise<void>;
}

export function InventoryView({ items, onRedeem }: InventoryViewProps) {
  const appTheme = useAppTheme();
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const handleRedeem = async (drawId: string) => {
    setRedeemingId(drawId);
    try {
      await onRedeem(drawId);
    } finally {
      setRedeemingId(null);
    }
  };

  const LEVEL_COLORS: Record<number, string> = {
    1: '#7EB8A2',
    2: '#5A9A9E',
    3: '#C49A6C',
    4: '#B76E79',
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
      <div className="max-w-[700px] mx-auto space-y-3 pt-4">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <Package size={40} className="mx-auto mb-3" style={{ color: appTheme.inkMuted48 }} />
            <p className="text-sm" style={{ color: appTheme.inkMuted48 }}>仓库空空如也</p>
            <p className="text-xs mt-1" style={{ color: appTheme.inkMuted48 }}>去商店抽奖吧，抽中的心愿会出现在这里</p>
          </div>
        ) : (
          items.map((item) => {
            const levelColor = LEVEL_COLORS[item.wish_level] || appTheme.inkMuted48;
            const Icon = LEVEL_ICONS[item.wish_level] || Gift;
            const time = new Date(item.created_at).toLocaleString('zh-CN', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            const isRedeeming = redeemingId === item.draw_id;

            return (
              <div
                key={item.draw_id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: appTheme.surfacePearl }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${withAlpha(levelColor, 0.15)}` }}
                >
                  <Icon size={18} style={{ color: levelColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: appTheme.ink }}>
                    {item.wish_title}
                  </p>
                  <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                    Lv.{item.wish_level} · {WISH_LEVEL_NAMES[item.wish_level]} · {time}
                    {item.result_type === 'pity' && ' · 保底'}
                  </p>
                </div>
                <button
                  onClick={() => handleRedeem(item.draw_id)}
                  disabled={isRedeeming}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all btn-press disabled:opacity-50"
                  style={{
                    backgroundColor: withAlpha(appTheme.primary, 0.1),
                    color: appTheme.primary,
                  }}
                >
                  <CheckCircle size={14} />
                  {isRedeeming ? '核销中...' : '核销'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
