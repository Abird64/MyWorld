import { useState } from 'react';
import { Sparkles, Play, Wind } from 'lucide-react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useUIStore } from '@/stores/uiStore';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { isOverdue } from '@/utils/dateFormat';
import { MindfulStart } from '@/components/pomodoro/MindfulStart';
import type { Task } from '@/types/task';

interface RecommendCardProps {
  recommendation: { task: Task; reason: string } | null;
  state: 'loading' | 'ready' | 'empty' | 'all-done';
  onRetry?: () => void;
}

export function RecommendCard({ recommendation, state }: RecommendCardProps) {
  const appTheme = useAppTheme();
  const setActiveSubPage = useUIStore((s) => s.setActiveSubPage);
  const startFocus = usePomodoroStore((s) => s.startFocus);
  const warmColor = '#D4A76A';
  const [showMindful, setShowMindful] = useState(false);

  if (state === 'loading') {
    return (
      <div
        className="w-full rounded-2xl animate-pulse mb-4 flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}
        role="status"
        aria-label="正在推荐任务"
      >
        <div className="rounded-lg flex-shrink-0" style={{ backgroundColor: appTheme.hairline, width: 28, height: 28 }} />
        <div className="flex-1 min-w-0">
          <div className="rounded h-4" style={{ backgroundColor: appTheme.hairline, width: '70%' }} />
        </div>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div
        className="w-full rounded-2xl mb-4 flex items-center gap-2 px-4 py-3"
        style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}
      >
        <Sparkles size={14} style={{ color: warmColor, flexShrink: 0 }} aria-hidden="true" />
        <span className="text-sm" style={{ color: appTheme.inkMuted48 }}>
          今天还没有任务，想记点什么？
        </span>
        <button
          onClick={() => setActiveSubPage('tasks')}
          className="text-sm font-medium transition-colors flex-shrink-0 ml-auto"
          style={{ color: appTheme.primary }}
        >
          去创建
        </button>
      </div>
    );
  }

  if (state === 'all-done' || !recommendation) {
    return (
      <div
        className="w-full rounded-2xl mb-4 flex items-center gap-2 px-4 py-3"
        style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}
      >
        <Sparkles size={14} style={{ color: warmColor, flexShrink: 0 }} aria-hidden="true" />
        <span className="text-sm" style={{ color: appTheme.inkMuted48 }}>
          今天的事都做完了。坐下来，喝杯水。
        </span>
      </div>
    );
  }

  const { task, reason } = recommendation;
  const hasDeadlineBadge = task.deadline && isOverdue(task.deadline);

  return (
    <>
      <button
        onClick={() => setActiveSubPage('tasks')}
        className="w-full text-left rounded-2xl mb-4 transition-all btn-press flex items-center gap-2.5 px-4 py-3"
        style={{
          backgroundColor: appTheme.canvas,
          border: `0.5px solid ${appTheme.hairline}`,
        }}
        aria-label={`推荐任务：${task.title}`}
      >
        <Sparkles size={14} style={{ color: warmColor, flexShrink: 0 }} aria-hidden="true" />

        {/* 文案：理由 + 任务名 */}
        <span className="text-sm leading-relaxed min-w-0 flex-1">
          <span style={{ color: appTheme.inkMuted80 }}>{reason}</span>
          <span style={{ color: appTheme.inkMuted48 }} className="mx-1.5">·</span>
          <span
            className="font-medium inline-block"
            style={{
              color: warmColor,
              backgroundColor: withAlpha(warmColor, 0.15),
              padding: '1px 8px',
              borderRadius: '5px',
            }}
          >
            {task.title}
          </span>
        </span>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {hasDeadlineBadge && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: withAlpha(appTheme.danger, 0.12), color: appTheme.danger }}
            >
              逾期
            </span>
          )}
          {task.priority === 'high' && !hasDeadlineBadge && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: withAlpha(appTheme.danger, 0.12), color: appTheme.danger }}
            >
              高优先
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMindful(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.97]"
            style={{
              backgroundColor: withAlpha(warmColor, 0.12),
              color: warmColor,
            }}
            aria-label={`正念启动：${task.title}`}
          >
            <Wind size={12} />
            正念
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              startFocus(task.id, task.title);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.97]"
            style={{
              backgroundColor: withAlpha(warmColor, 0.15),
              color: warmColor,
            }}
            aria-label={`开始专注：${task.title}`}
          >
            <Play size={12} className="fill-current" />
            专注
          </button>
        </div>
      </button>

      <MindfulStart
        open={showMindful}
        onClose={() => setShowMindful(false)}
        taskTitle={task.title}
        taskDescription={task.description || undefined}
        taskId={task.id}
      />
    </>
  );
}
