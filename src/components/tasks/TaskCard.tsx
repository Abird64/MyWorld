import { Check, Circle, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDate, isOverdue } from '@/utils/dateFormat';
import { useAppTheme } from '@/stores/themeStore';
import type { Task } from '@/types/task';

interface TaskCardProps {
  task: Task;
  multiSelectMode: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  subtasks: Task[];
  onClick: (task: Task) => void;
  onToggleSelect: (id: string) => void;
  onQuickComplete: (e: React.MouseEvent, id: string) => void;
  onToggleSubtasks: (id: string) => void;
  onSubtaskClick: (subtask: Task) => void;
  onSubtaskComplete: (e: React.MouseEvent, id: string) => void;
}

export function TaskCard({
  task,
  multiSelectMode,
  isSelected,
  isExpanded,
  subtasks,
  onClick,
  onToggleSelect,
  onQuickComplete,
  onToggleSubtasks,
  onSubtaskClick,
  onSubtaskComplete,
}: TaskCardProps) {
  const appTheme = useAppTheme();
  const completed = task.status === 'completed';
  const txtMid = appTheme.ink + '80';
  const bgSubtle = appTheme.ink + '0D';

  const priorityConfig: Record<string, { label: string; color: string }> = {
    high: { label: '紧急', color: '#E74C3C' },
    medium: { label: '重要', color: '#F39C12' },
    low: { label: '一般', color: appTheme.primary },
  };

  return (
    <div>
      <div
        className="rounded-[18px] p-4 cursor-pointer relative group h-[130px] overflow-hidden"
        style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}
        onClick={() => {
          if (multiSelectMode) {
            onToggleSelect(task.id);
          } else {
            onClick(task);
          }
        }}
      >
        <div className="flex items-start gap-4">
          {/* 多选 checkbox */}
          {multiSelectMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect(task.id); }}
              className="flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center mt-5 transition-colors"
              style={{
                borderColor: isSelected ? appTheme.primary : '#ccc',
                backgroundColor: isSelected ? appTheme.primary : 'transparent',
              }}
            >
              {isSelected && <Check size={14} className="text-white" />}
            </button>
          )}
          {/* 左侧圆形图标 */}
          <div className="w-[48px] h-[48px] flex-shrink-0 flex items-center justify-center relative">
            <div
              className="w-full h-full rounded-full flex items-center justify-center transition-colors"
              style={{
                backgroundColor: completed ? '#D1FAE5' : '#E0F2FE',
                border: `2px solid ${completed ? '#6EE7B7' : '#93C5FD'}`,
              }}
            >
              {completed && <Check size={20} style={{ color: '#6EE7B7' }} />}
            </div>
            {/* 快速完成按钮 */}
            {!completed && (
              <button
                onClick={(e) => onQuickComplete(e, task.id)}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: appTheme.primary }}>
                  <Check size={16} className="text-white" />
                </div>
              </button>
            )}
          </div>

          {/* 右侧信息 */}
          <div className="flex-1 min-w-0">
            <h3
              className="text-lg font-normal mb-1 truncate"
              style={{ color: completed ? appTheme.ink + '80' : appTheme.ink, textDecoration: completed ? 'line-through' : 'none' }}
            >
              {task.title}
            </h3>
            <p className="text-sm mb-2" style={{ color: appTheme.ink + '99' }}>
              {task.scheduled_at ? formatDate(task.scheduled_at) : formatDate(task.created_at)}
            </p>

            {/* 优先级 + XP + 标签 */}
            <div className="flex items-center gap-3">
              {task.priority && task.priority !== 'none' && priorityConfig[task.priority] && (
                <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: priorityConfig[task.priority].color }}>
                  {priorityConfig[task.priority].label}
                </span>
              )}
              {task.xp_earned > 0 && (
                <span className="inline-flex items-center gap-1.5 text-sm text-[#4A90D9]">
                  <Circle size={14} fill="#4A90D9" />
                  XP+{task.xp_earned}
                </span>
              )}
              {!completed && task.deadline && isOverdue(task.deadline) && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">已过期</span>
              )}
              {task.tags && <TagBadges tagsStr={task.tags} txtMid={txtMid} bgSubtle={bgSubtle} />}
            </div>
          </div>
        </div>

        {/* 子任务展开/收起按钮 */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSubtasks(task.id); }}
          className="absolute bottom-3 right-4 flex items-center gap-1 text-xs transition-colors"
          style={{ color: appTheme.ink + '4D' }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          子任务
        </button>
      </div>

      {/* 展开的子任务列表 */}
      {isExpanded && subtasks.length > 0 && (
        <div className="mt-1 ml-8 space-y-1">
          {subtasks.map((sub) => (
            <div
              key={sub.id}
              onClick={() => onSubtaskClick(sub)}
              className="rounded-[18px] px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors"
              style={{ backgroundColor: appTheme.canvasParchment }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onSubtaskComplete(e, sub.id); }}
                className="flex-shrink-0"
              >
                {sub.status === 'completed'
                  ? <Check size={14} style={{ color: appTheme.primary }} />
                  : <Circle size={14} style={{ color: appTheme.ink + '33' }} />}
              </button>
              <span
                className="text-sm truncate"
                style={{ color: sub.status === 'completed' ? appTheme.ink + '66' : appTheme.ink + 'B3', textDecoration: sub.status === 'completed' ? 'line-through' : 'none' }}
              >
                {sub.title}
              </span>
            </div>
          ))}
        </div>
      )}
      {isExpanded && subtasks.length === 0 && (
        <div className="mt-1 ml-8">
          <p className="text-xs px-4 py-2" style={{ color: appTheme.ink + '4D' }}>暂无子任务</p>
        </div>
      )}
    </div>
  );
}

function TagBadges({ tagsStr, txtMid, bgSubtle }: { tagsStr: string; txtMid: string; bgSubtle: string }) {
  try {
    const tags: string[] = JSON.parse(tagsStr);
    return tags.slice(0, 2).map((tag, i) => (
      <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: bgSubtle, color: txtMid }}>{tag}</span>
    ));
  } catch {
    return null;
  }
}
