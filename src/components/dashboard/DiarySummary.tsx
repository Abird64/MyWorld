import { useEffect, useState, useCallback } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    setLoading(true);
    setError(false);

    Promise.all([
      getJournalByDate(date).then((entry) => {
        if (entry.content && entry.content.trim().length > 0) {
          setWordCount(entry.content.length);
        }
      }),
      getAiDiary(date).then((ai) => setHasAiSummary(ai.exists)),
    ])
      .then(() => setLoading(false))
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasWritten = wordCount !== null && wordCount > 0;

  return (
    <DashboardCard
      title="日记"
      icon={BookOpen}
      color="#ff2d55"
      onClick={() => setActiveSubPage('diary')}
      variant="prominent"
      loading={loading}
      error={error}
      onRetry={load}
    >
      {!hasWritten ? (
        <p className="text-xs leading-relaxed" style={{ color: appTheme.inkMuted48 }}>
          今天的故事，还等着被记下
        </p>
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
          <p className="text-xs" style={{ color: hasAiSummary ? appTheme.primary : appTheme.inkMuted48 }}>
            {hasAiSummary ? '萤火已点亮' : '待总结'}
          </p>
        </div>
      )}
    </DashboardCard>
  );
}
