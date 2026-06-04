import { History, TrendingUp } from 'lucide-react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import type { GlowLedgerEntry } from '@/types/wish';
import { REASON_CONFIG } from './config';

interface LedgerViewProps {
  ledger: GlowLedgerEntry[];
  ledgerTotal: number;
  ledgerFilter: 'all' | 'glow' | 'micro_ticket' | 'shimmer_ticket';
  setLedgerFilter: (f: 'all' | 'glow' | 'micro_ticket' | 'shimmer_ticket') => void;
  fetchLedger: (assetType?: 'glow' | 'micro_ticket' | 'shimmer_ticket', limit?: number, offset?: number) => Promise<void>;
}

export function LedgerView({ ledger, ledgerTotal, ledgerFilter, setLedgerFilter, fetchLedger }: LedgerViewProps) {
  const appTheme = useAppTheme();

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
      <div className="max-w-[700px] mx-auto space-y-4 pt-4">
        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            ['all', '全部'],
            ['glow', '萤火'],
            ['micro_ticket', '微光券'],
            ['shimmer_ticket', '拾光券'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setLedgerFilter(key)}
              className="shrink-0 px-3 py-1.5 text-xs rounded-full transition-all"
              style={{
                backgroundColor: ledgerFilter === key ? appTheme.primary : appTheme.surfacePearl,
                color: ledgerFilter === key ? '#fff' : appTheme.inkMuted80,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Ledger list */}
        {ledger.length === 0 ? (
          <div className="text-center py-16">
            <History size={40} className="mx-auto mb-3" style={{ color: appTheme.inkMuted48 }} />
            <p className="text-sm" style={{ color: appTheme.inkMuted48 }}>暂无交易记录</p>
            <p className="text-xs mt-1" style={{ color: appTheme.inkMuted48 }}>完成日常任务、日记、番茄钟来获取萤火吧</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {ledger
              .filter((entry) => ledgerFilter === 'all' || entry.asset_type === ledgerFilter)
              .map((entry) => {
                const isIncome = entry.change_amount > 0;
                const reasonConfig = REASON_CONFIG[entry.reason as keyof typeof REASON_CONFIG] || {
                  icon: TrendingUp,
                  label: entry.reason,
                  color: '#888',
                };
                const Icon = reasonConfig.icon;
                const assetLabel = entry.asset_type === 'glow' ? '萤火' : entry.asset_type === 'micro_ticket' ? '微光券' : '拾光券';
                const time = new Date(entry.created_at).toLocaleString('zh-CN', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                });

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ backgroundColor: appTheme.surfacePearl }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${withAlpha(reasonConfig.color, 0.12)}` }}
                    >
                      <Icon size={15} style={{ color: reasonConfig.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: appTheme.ink }}>
                        {entry.source_desc || reasonConfig.label}
                      </p>
                      <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                        {time} · {assetLabel}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: isIncome ? '#4CAF50' : '#E53935' }}
                      >
                        {isIncome ? '+' : ''}{entry.change_amount.toLocaleString()}
                      </span>
                      <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>
                        {entry.balance_after.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {ledgerTotal > 50 && (
          <div className="text-center">
            <button
              onClick={() => fetchLedger(ledgerFilter === 'all' ? undefined : ledgerFilter, 50, ledger.length)}
              className="text-xs py-2 px-4 rounded-lg transition-colors"
              style={{ color: appTheme.primary, backgroundColor: `${withAlpha(appTheme.primary, 0.08)}` }}
            >
              加载更多
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
