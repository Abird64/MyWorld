import { useAppTheme, withAlpha } from '@/stores/themeStore';
import type { XpSource } from '@/types/skill';

interface SourceBreakdownProps {
  sources: XpSource[];
}

const SOURCE_META: Record<string, { icon: string; name: string; color: string }> = {
  task: { icon: '☐', name: '完成任务', color: '#5856d6' },
  habit: { icon: '↻', name: '习惯打卡', color: '#34c759' },
  journal: { icon: '✎', name: '写日记', color: '#ff2d55' },
  ai_chat: { icon: '✦', name: 'AI 对话', color: '#0071e3' },
  pomodoro: { icon: '⏱', name: '番茄钟', color: '#ff9500' },
};

export function SourceBreakdown({ sources }: SourceBreakdownProps) {
  const appTheme = useAppTheme();

  if (sources.length === 0) {
    return (
      <p className="text-sm" style={{ color: appTheme.inkMuted48 }}>暂无经验来源数据</p>
    );
  }

  const maxXp = Math.max(...sources.map((s) => s.total_xp));

  return (
    <div className="space-y-3">
      {sources.map((src) => {
        const meta = SOURCE_META[src.source_type] || {
          icon: '●',
          name: src.source_type,
          color: appTheme.inkMuted48,
        };
        const pct = maxXp > 0 ? (src.total_xp / maxXp) * 100 : 0;

        return (
          <div key={src.source_type} className="flex items-center gap-3">
            <span className="w-8 text-center text-base flex-shrink-0" style={{ color: meta.color }}>
              {meta.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm" style={{ color: appTheme.ink }}>{meta.name}</span>
                <span className="text-xs font-medium" style={{ color: appTheme.inkMuted80 }}>
                  +{src.total_xp.toLocaleString()} 经验
                </span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.08)}` }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: meta.color }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
