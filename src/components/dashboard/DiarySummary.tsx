import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { DashboardCard } from './DashboardCard';
import { getJournalByDate, getAiDiary } from '@/services/journalService';

export function DiarySummary() {
  const appTheme = useAppTheme();
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [hasAiSummary, setHasAiSummary] = useState(false);

  useEffect(() => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    getJournalByDate(date)
      .then((entry) => {
        if (entry.content && entry.content.trim().length > 0) {
          setWordCount(entry.content.length);
        }
      })
      .catch(() => {});

    getAiDiary(date)
      .then((ai) => setHasAiSummary(ai.exists))
      .catch(() => {});
  }, []);

  const hasWritten = wordCount !== null && wordCount > 0;

  return (
    <DashboardCard
      title="日记"
      icon={BookOpen}
      color="#ff2d55"
      onClick={() => setActiveSubPage('diary')}
    >
      {!hasWritten ? (
        <p className="text-xs" style={{ color: appTheme.inkMuted48 }}>今日还未写日记</p>
      ) : (
        <div className="space-y-1">
          <div className="flex items-end gap-1">
            <span
              className="text-2xl font-bold"
              style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
            >
              {wordCount}
            </span>
            <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>字</span>
          </div>
          <p className="text-xs" style={{ color: hasAiSummary ? '#34c759' : appTheme.inkMuted48 }}>
            {hasAiSummary ? '✓ 已总结' : '待总结'}
          </p>
        </div>
      )}
    </DashboardCard>
  );
}
