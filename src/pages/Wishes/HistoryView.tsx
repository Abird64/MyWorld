import { Gift, History, Shuffle } from 'lucide-react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import type { WishDraw } from '@/types/wish';

interface HistoryViewProps {
  draws: WishDraw[];
}

export function HistoryView({ draws }: HistoryViewProps) {
  const appTheme = useAppTheme();

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
      <div className="max-w-[700px] mx-auto space-y-3 pt-4">
        {draws.length === 0 ? (
          <div className="text-center py-16">
            <History size={40} className="mx-auto mb-3" style={{ color: appTheme.inkMuted48 }} />
            <p className="text-sm" style={{ color: appTheme.inkMuted48 }}>暂无抽奖记录</p>
            <p className="text-xs mt-1" style={{ color: appTheme.inkMuted48 }}>去抽奖吧，每次抽奖都会记录在这里</p>
          </div>
        ) : (
          draws.map((draw) => {
            const isWin = draw.result_type === 'wish' || draw.result_type === 'pity';
            const typeLabel = draw.draw_type === 'micro' ? '微光奖池' : '拾光奖池';
            const typeColor = draw.draw_type === 'micro' ? '#E8B959' : '#C49A6C';
            const time = new Date(draw.created_at).toLocaleString('zh-CN', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });

            return (
              <div
                key={draw.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: appTheme.surfacePearl }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${withAlpha(typeColor, 0.15)}` }}
                >
                  {isWin ? <Gift size={14} style={{ color: typeColor }} /> : <Shuffle size={14} style={{ color: appTheme.inkMuted48 }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: appTheme.ink }}>
                    {isWin ? '抽中心愿' : '未中'}
                    {draw.result_type === 'pity' && '（保底）'}
                  </p>
                  <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                    {time} · {typeLabel} · 消耗 {draw.cost} 券
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: isWin ? '#4CAF50' : appTheme.inkMuted48 }}
                  >
                    {isWin ? '中奖' : '未中'}
                  </span>
                  <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                    保底 {draw.pity_count}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
