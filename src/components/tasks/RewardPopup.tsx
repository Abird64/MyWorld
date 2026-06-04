import { useEffect } from 'react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { SKILL_COLORS } from '@/styles/theme';
import type { CompleteResult } from '@/types/task';

interface RewardPopupProps {
  result: CompleteResult | null;
  onClose: () => void;
  title?: string;
  showXp?: boolean;
}

export function RewardPopup({ result, onClose, title = '任务完成', showXp = true }: RewardPopupProps) {
  const appTheme = useAppTheme();

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [result, onClose]);

  if (!result) return null;

  const hasSkills = result.skill_xps.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 w-[280px] animate-in"
        style={{ backgroundColor: appTheme.canvas }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes reward-pop {
            0% { transform: scale(0.85); opacity: 0; }
            60% { transform: scale(1.03); }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-in { animation: reward-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        `}</style>

        <h3 className="text-center text-lg font-medium mb-4" style={{ color: appTheme.ink }}>
          {title}
        </h3>

        {/* 萤火 + XP 主奖励 */}
        <div className="flex items-center justify-center gap-6 mb-4">
          {result.glow_earned > 0 && (
            <div className="text-center">
              <div
                className="text-3xl font-bold"
                style={{ color: appTheme.primary, fontFamily: 'var(--font-display, system-ui)' }}
              >
                +{result.glow_earned}
              </div>
              <div className="text-xs mt-0.5" style={{ color: withAlpha(appTheme.primary, 0.7) }}>
                萤火
              </div>
            </div>
          )}
          {showXp && result.xp_earned > 0 && (
            <div className="text-center">
              <div
                className="text-3xl font-bold"
                style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
              >
                +{result.xp_earned}
              </div>
              <div className="text-xs mt-0.5" style={{ color: appTheme.inkMuted48 }}>经验</div>
            </div>
          )}
        </div>

        {/* 技能 XP 明细 */}
        {hasSkills && (
          <div
            className="rounded-xl px-4 py-3 space-y-1.5"
            style={{ backgroundColor: withAlpha(appTheme.ink, 0.04) }}
          >
            {result.skill_xps.map((s) => {
              const info = SKILL_COLORS[s.skill_id];
              return (
                <div key={s.skill_id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: info?.hex || '#888' }}
                    />
                    <span style={{ color: appTheme.inkMuted80 }}>
                      {info?.name || s.skill_name}
                    </span>
                  </div>
                  <span className="font-medium tabular-nums" style={{ color: appTheme.inkMuted80 }}>
                    +{s.xp}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
