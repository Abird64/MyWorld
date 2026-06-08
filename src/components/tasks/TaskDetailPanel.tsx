import { useState, useEffect, useRef } from 'react';
import { X, Check, Circle, Trash2, Plus, Timer, Sparkles } from 'lucide-react';
import { SKILL_COLORS, SKILL_ORDER } from '@/styles/theme';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { MindfulStart } from '@/components/pomodoro/MindfulStart';
import * as skillService from '@/services/skillService';
import { formatDateTime } from '@/utils/dateFormat';
import type { Task } from '@/types/task';

interface TaskDetailPanelProps {
  task: Task;
  detailSubtasks: Task[];
  onClose: () => void;
  onSave: (id: string, data: SaveData) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onUncomplete: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddSubtask: (title: string) => Promise<void>;
  onCompleteSubtask: (subtaskId: string) => Promise<void>;
  onDeleteSubtask: (subtaskId: string) => Promise<void>;
}

export interface SaveData {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  deadline?: string;
  scheduled_at?: string;
  estimated_minutes?: number;
  notes?: string;
  tags?: string;
  skillXps: Record<string, number>;
}

export function TaskDetailPanel({
  task,
  detailSubtasks,
  onClose,
  onSave,
  onComplete,
  onUncomplete,
  onDelete,
  onAddSubtask,
  onCompleteSubtask,
  onDeleteSubtask,
}: TaskDetailPanelProps) {
  const appTheme = useAppTheme();
  const { startFocus, phase } = usePomodoroStore();
  const [showMindful, setShowMindful] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority || '');
  const [deadline, setDeadline] = useState(task.deadline ? task.deadline.slice(0, 16) : '');
  const [scheduledAt, setScheduledAt] = useState(task.scheduled_at ? task.scheduled_at.slice(0, 16) : '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimated_minutes ? String(task.estimated_minutes) : '');
  const [notes, setNotes] = useState(task.notes || '');
  const [tags, setTags] = useState<string[]>(task.tags ? safeParse(task.tags) : []);
  const [newTagInput, setNewTagInput] = useState('');
  const [skillXps, setSkillXps] = useState<Record<string, number>>({});
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status);
    setPriority(task.priority || '');
    setDeadline(task.deadline ? task.deadline.slice(0, 16) : '');
    setScheduledAt(task.scheduled_at ? task.scheduled_at.slice(0, 16) : '');
    setEstimatedMinutes(task.estimated_minutes ? String(task.estimated_minutes) : '');
    setNotes(task.notes || '');
    setTags(task.tags ? safeParse(task.tags) : []);
    setNewTagInput('');
    setSubtaskTitle('');
    setSkillXps({});
    skillService.getTaskSkills(task.id).then((ts) => {
      const xpMap: Record<string, number> = {};
      ts.forEach((s) => { xpMap[s.skill_id] = s.xp_amount; });
      setSkillXps(xpMap);
    }).catch((e) => console.error('[TaskDetailPanel] Failed to load task skills:', e));
  }, [task.id]);

  // 首次加载标记：task 切换时重置，等数据同步完再开启自动保存
  const initialLoadRef = useRef(true);
  useEffect(() => {
    initialLoadRef.current = true;
    const timer = setTimeout(() => { initialLoadRef.current = false; }, 300);
    return () => clearTimeout(timer);
  }, [task.id]);

  // Refs for latest values (used by unmount flush to avoid stale closures)
  const skillXpsRef = useRef(skillXps);
  skillXpsRef.current = skillXps;
  const textSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef({ title, description, status, priority, deadline, scheduledAt, estimatedMinutes, notes, tags });
  formRef.current = { title, description, status, priority, deadline, scheduledAt, estimatedMinutes, notes, tags };

  // 自动保存：文本字段 600ms 防抖
  useEffect(() => {
    if (initialLoadRef.current) return;
    const timer = setTimeout(() => {
      textSaveTimerRef.current = null;
      const f = formRef.current;
      onSave(task.id, {
        title: f.title.trim() || task.title,
        description: f.description.trim() || undefined,
        status: f.status !== task.status ? f.status : undefined,
        priority: f.priority || undefined,
        deadline: f.deadline || undefined,
        scheduled_at: f.scheduledAt || undefined,
        estimated_minutes: f.estimatedMinutes ? parseInt(f.estimatedMinutes) : undefined,
        notes: f.notes.trim() || undefined,
        tags: f.tags.length > 0 ? JSON.stringify(f.tags) : undefined,
        skillXps: skillXpsRef.current,
      });
    }, 600);
    textSaveTimerRef.current = timer;
    return () => { clearTimeout(timer); textSaveTimerRef.current = null; };
  }, [title, description, status, priority, deadline, scheduledAt, estimatedMinutes, notes, tags]);

  // 属性加成：200ms 防抖，单独保存（不触发 updateTask）
  const skillSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (initialLoadRef.current) return;
    const timer = setTimeout(() => {
      skillSaveTimerRef.current = null;
      const entries = Object.entries(skillXpsRef.current)
        .filter(([_, v]) => v > 0)
        .map(([skill_id, xp_amount]) => ({ skill_id, xp_amount }));
      skillService.setTaskSkills(task.id, entries).catch(console.error);
    }, 200);
    skillSaveTimerRef.current = timer;
    return () => { clearTimeout(timer); skillSaveTimerRef.current = null; };
  }, [skillXps]);

  // 面板关闭时立即刷新所有待保存数据
  useEffect(() => {
    return () => {
      // Flush text field save
      if (textSaveTimerRef.current) {
        clearTimeout(textSaveTimerRef.current);
        textSaveTimerRef.current = null;
        const f = formRef.current;
        onSave(task.id, {
          title: f.title.trim() || task.title,
          description: f.description.trim() || undefined,
          status: f.status !== task.status ? f.status : undefined,
          priority: f.priority || undefined,
          deadline: f.deadline || undefined,
          scheduled_at: f.scheduledAt || undefined,
          estimated_minutes: f.estimatedMinutes ? parseInt(f.estimatedMinutes) : undefined,
          notes: f.notes.trim() || undefined,
          tags: f.tags.length > 0 ? JSON.stringify(f.tags) : undefined,
          skillXps: skillXpsRef.current,
        });
      }
      // Flush skill XP save
      if (skillSaveTimerRef.current) {
        clearTimeout(skillSaveTimerRef.current);
        skillSaveTimerRef.current = null;
        const entries = Object.entries(skillXpsRef.current)
          .filter(([_, v]) => v > 0)
          .map(([skill_id, xp_amount]) => ({ skill_id, xp_amount }));
        skillService.setTaskSkills(task.id, entries).catch(console.error);
      }
    };
  }, [task.id]);

  const handleAddSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    await onAddSubtask(subtaskTitle.trim());
    setSubtaskTitle('');
  };

  const statusOptions = [
    { value: 'pending', label: '待办', color: '#999' },
    { value: 'in_progress', label: '进行中', color: '#2A8CB7' },
    { value: 'completed', label: '已完成', color: appTheme.primary },
    { value: 'cancelled', label: '已取消', color: appTheme.danger },
  ] as const;

  const priorityOptions = [
    { value: '', label: '无', color: '#999' },
    { value: 'high', label: '紧急', color: appTheme.danger },
    { value: 'medium', label: '重要', color: appTheme.warning },
    { value: 'low', label: '一般', color: appTheme.primary },
  ];

  // 动态颜色常量
  const txt = appTheme.ink;
  const txtDim = withAlpha(txt, 0.8);       // 80%
  const txtMid = withAlpha(txt, 0.5);       // 50%
  const txtLight = withAlpha(txt, 0.3);     // 30%
  const txtHint = withAlpha(txt, 0.35);     // 35%
  const txtMeta = withAlpha(txt, 0.4);      // 40%
  const txtBody = withAlpha(txt, 0.7);      // 70%
  const bgSubtle = withAlpha(txt, 0.05);     // 5%
  const bgHover = withAlpha(txt, 0.1);      // 10%
  const bgSubdued = withAlpha(txt, 0.03);    // 3%
  const borderColor = withAlpha(txt, 0.08);  // 8%

  return (
    <>
      <style>{`
        #task-detail-panel .focus-ring-accent:focus { outline: none; box-shadow: 0 0 0 2px ${withAlpha(appTheme.primary, 0.3)}; }
        #task-detail-panel .btn-accent { background-color: ${appTheme.primary}; }
        #task-detail-panel .btn-accent:hover { background-color: ${withAlpha(appTheme.primary, 0.87)}; }
        #task-detail-panel input::placeholder,
        #task-detail-panel textarea::placeholder { color: ${txtHint}; }
      `}</style>
      <div id="task-detail-panel" className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[480px] flex flex-col animate-slide-in" style={{ backgroundColor: appTheme.canvas }}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor }}>
          <h2 className="text-xl" style={{ color: txtDim }}>任务详情</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: bgSubtle }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = bgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bgSubtle)}
          >
            <X size={16} style={{ color: txtMid }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 标题 */}
          <Field label="标题" txtMeta={txtMeta}>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus-ring-accent"
              style={{ color: txt, backgroundColor: bgSubtle }} />
          </Field>

          {/* 状态 */}
          <Field label="状态" txtMeta={txtMeta}>
            <div className="flex gap-2">
              {statusOptions.map((s) => (
                <button key={s.value} onClick={() => setStatus(s.value)}
                  className="px-4 py-1.5 rounded-full text-sm transition-all"
                  style={status === s.value
                    ? { backgroundColor: s.color, color: appTheme.onPrimary }
                    : { color: txtMid, backgroundColor: bgSubtle }}>
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          {/* 描述 */}
          <Field label="描述" txtMeta={txtMeta}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="添加描述..."
              className="w-full text-base rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus-ring-accent resize-none"
              style={{ color: txt, backgroundColor: bgSubtle }} />
          </Field>

          {/* 优先级 */}
          <Field label="优先级" txtMeta={txtMeta}>
            <div className="flex gap-2">
              {priorityOptions.map((p) => (
                <button key={p.value} onClick={() => setPriority(p.value)}
                  className="px-4 py-1.5 rounded-full text-sm transition-all"
                  style={priority === p.value
                    ? { backgroundColor: p.color, color: appTheme.onPrimary }
                    : { color: txtMid, backgroundColor: bgSubtle }}>
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          {/* 计划开始时间 */}
          <Field label="计划开始" txtMeta={txtMeta}>
            <div className="flex gap-2">
              <input type="date"
                value={scheduledAt.split('T')[0] || ''}
                onChange={(e) => { const t = scheduledAt.split('T')[1] || ''; setScheduledAt(e.target.value ? `${e.target.value}T${t || '00:00'}` : ''); }}
                className="date-input flex-1 text-base rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus-ring-accent"
                style={{ color: txt, backgroundColor: bgSubtle }} />
              <input type="time"
                value={scheduledAt.split('T')[1] || ''}
                onChange={(e) => { const d = scheduledAt.split('T')[0] || ''; if (d) setScheduledAt(`${d}T${e.target.value || '00:00'}`); }}
                className="time-input w-32 text-base rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus-ring-accent"
                style={{ color: txt, backgroundColor: bgSubtle }} />
            </div>
          </Field>

          {/* 截止时间 */}
          <Field label="截止时间" txtMeta={txtMeta}>
            <div className="flex gap-2">
              <input type="date"
                value={deadline.split('T')[0] || ''}
                onChange={(e) => { const t = deadline.split('T')[1] || ''; setDeadline(e.target.value ? `${e.target.value}T${t || '00:00'}` : ''); }}
                className="date-input flex-1 text-base rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus-ring-accent"
                style={{ color: txt, backgroundColor: bgSubtle }} />
              <input type="time"
                value={deadline.split('T')[1] || ''}
                onChange={(e) => { const d = deadline.split('T')[0] || ''; if (d) setDeadline(`${d}T${e.target.value || '00:00'}`); }}
                className="time-input w-32 text-base rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus-ring-accent"
                style={{ color: txt, backgroundColor: bgSubtle }} />
            </div>
          </Field>

          {/* 预估耗时 */}
          <Field label="预估耗时（分钟）" txtMeta={txtMeta}>
            <input type="number" min="0" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} placeholder="如 30"
              className="w-full text-base rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus-ring-accent"
              style={{ color: txt, backgroundColor: bgSubtle }} />
          </Field>

          {/* 备注 */}
          <Field label="备注" txtMeta={txtMeta}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="添加备注..."
              className="w-full text-base rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus-ring-accent resize-none"
              style={{ color: txt, backgroundColor: bgSubtle }} />
          </Field>

          {/* 标签 */}
          <Field label="标签" txtMeta={txtMeta}>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                    style={{ backgroundColor: bgSubtle, color: txtBody }}>
                    {tag}
                    <button onClick={() => setTags(tags.filter((_, j) => j !== i))}
                      className="transition-colors"
                      style={{ color: txtLight }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = txtMid)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = txtLight)}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTagInput.trim()) {
                    e.preventDefault();
                    const tag = newTagInput.trim();
                    if (!tags.includes(tag)) setTags([...tags, tag]);
                    setNewTagInput('');
                  }
                }}
                placeholder="输入标签，回车添加"
                className="flex-1 text-sm rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus-ring-accent"
                style={{ color: txt, backgroundColor: bgSubtle }} />
            </div>
          </Field>

          {/* 属性加成 */}
          <Field label="属性加成" txtMeta={txtMeta}>
            <div className="grid grid-cols-3 gap-3">
              {SKILL_ORDER.map((skillId) => {
                const info = SKILL_COLORS[skillId];
                return (
                  <div key={skillId} className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: bgSubtle }}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: info.hex }} />
                    <span className="text-sm shrink-0" style={{ color: txtMid }}>{info.name}</span>
                    <input type="number" min="0" value={skillXps[skillId] || ''}
                      onChange={(e) => setSkillXps((prev) => ({ ...prev, [skillId]: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-12 text-sm bg-transparent text-center focus:outline-none"
                      style={{ color: txt }} />
                  </div>
                );
              })}
            </div>
          </Field>

          {/* 状态信息 */}
          <div className="flex gap-4 text-sm pt-2" style={{ color: txtMeta }}>
            <span>创建: {formatDateTime(task.created_at)}</span>
            {task.completed_at && <span>完成: {formatDateTime(task.completed_at)}</span>}
          </div>

          {/* 子任务 */}
          <Field label="子任务" txtMeta={txtMeta}>
            {detailSubtasks.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {detailSubtasks.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 group"
                    style={{ backgroundColor: bgSubdued }}>
                    <button onClick={() => onCompleteSubtask(sub.id)} className="flex-shrink-0">
                      {sub.status === 'completed'
                        ? <Check size={14} style={{ color: appTheme.primary }} />
                        : <Circle size={14} style={{ color: txtHint }} />}
                    </button>
                    <span className="flex-1 text-sm truncate"
                      style={{
                        color: sub.status === 'completed' ? txtMeta : txtBody,
                        textDecoration: sub.status === 'completed' ? 'line-through' : 'none',
                      }}>
                      {sub.title}
                    </span>
                    <button onClick={() => onDeleteSubtask(sub.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: txtHint }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = txtHint)}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(); }}
                placeholder="添加子任务..."
                className="flex-1 text-sm rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus-ring-accent"
                style={{ color: txt, backgroundColor: bgSubtle }} />
              <button onClick={handleAddSubtask} disabled={!subtaskTitle.trim()}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                style={subtaskTitle.trim()
                  ? { backgroundColor: appTheme.primary, color: appTheme.onPrimary }
                  : { backgroundColor: bgSubtle, color: txtHint }}>
                <Plus size={16} />
              </button>
            </div>
          </Field>
        </div>

        {/* 底部操作 */}
        <div className="p-6 border-t space-y-3" style={{ borderColor }}>
          {/* 番茄钟 + 正念启动 */}
          {task.status !== 'completed' && task.status !== 'cancelled' && phase === 'idle' && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowMindful(true)}
                className="flex-1 py-2.5 rounded-2xl text-sm transition-colors flex items-center justify-center gap-2"
                style={{
                  backgroundColor: withAlpha(SKILL_COLORS.creativity.hex, 0.1),
                  color: SKILL_COLORS.creativity.hex,
                }}
              >
                <Sparkles size={15} />
                正念启动
              </button>
              <button
                onClick={() => startFocus(task.id, task.title)}
                className="flex-1 py-2.5 rounded-2xl text-sm transition-colors flex items-center justify-center gap-2"
                style={{
                  backgroundColor: withAlpha(SKILL_COLORS.focus.hex, 0.1),
                  color: SKILL_COLORS.focus.hex,
                }}
              >
                <Timer size={15} />
                番茄钟
              </button>
            </div>
          )}
          <div className="flex gap-3">
            {task.status !== 'completed' ? (
              <button onClick={() => onComplete(task.id)}
                className="flex-1 py-3 rounded-2xl text-white text-base transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: '#4CAF50' }}>
                <Check size={16} />
                完成任务
              </button>
            ) : (
              <button onClick={() => onUncomplete(task.id)}
                className="flex-1 py-3 rounded-2xl text-white text-base transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: appTheme.warning }}>
                <Circle size={16} />
                取消完成
              </button>
            )}
            <button onClick={() => setShowDeleteConfirm(true)}
              className="py-3 px-4 rounded-2xl text-base transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: withAlpha(appTheme.danger, 0.1), color: appTheme.danger }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = withAlpha(appTheme.danger, 0.18))}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = withAlpha(appTheme.danger, 0.1))}>
              <Trash2 size={16} />
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
    {showDeleteConfirm && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowDeleteConfirm(false)}>
        <div className="rounded-2xl p-6 mx-4 w-[320px]" style={{ backgroundColor: appTheme.canvas }} onClick={(e) => e.stopPropagation()}>
          <p className="text-base mb-6" style={{ color: txtDim }}>这个任务一旦删除，就不能回来了。确定吗？</p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2.5 rounded-2xl text-sm transition-colors"
              style={{ color: txtMid, backgroundColor: bgSubtle }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = bgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bgSubtle)}>
              取消
            </button>
            <button onClick={() => { onDelete(task.id); setShowDeleteConfirm(false); }}
              className="flex-1 py-2.5 rounded-2xl text-sm transition-colors"
              style={{ backgroundColor: appTheme.danger, color: '#fff' }}>
              确认删除
            </button>
          </div>
        </div>
      </div>
    )}
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

function Field({ label, children, txtMeta }: { label: string; children: React.ReactNode; txtMeta: string }) {
  return (
    <div>
      <label className="block text-sm mb-1.5" style={{ color: txtMeta }}>{label}</label>
      {children}
    </div>
  );
}

function safeParse(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}
