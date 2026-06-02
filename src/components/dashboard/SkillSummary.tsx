import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useSkillStore } from '@/stores/skillStore';
import { useUIStore } from '@/stores/uiStore';
import { useAppTheme } from '@/stores/themeStore';
import { DashboardCard } from './DashboardCard';

export function SkillSummary() {
  const appTheme = useAppTheme();
  const { skills, activity, fetchSkills, fetchActivity } = useSkillStore();
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);

  useEffect(() => {
    fetchSkills();
    fetchActivity();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayXp = activity.find((a) => a.day === today)?.total_xp ?? 0;

  return (
    <DashboardCard
      title="成长"
      icon={Sparkles}
      color="#ff9500"
      onClick={() => setActiveSubPage('skills')}
    >
      <div className="flex items-end gap-1">
        <span
          className="text-2xl font-bold"
          style={{ color: appTheme.ink, fontFamily: 'var(--font-display, system-ui)' }}
        >
          +{todayXp}
        </span>
        <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>今日经验</span>
      </div>
      {skills.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {skills.map((s) => (
            <span
              key={s.id}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: appTheme.canvasParchment, color: appTheme.inkMuted80 }}
            >
              {s.name} Lv.{s.level}
            </span>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
