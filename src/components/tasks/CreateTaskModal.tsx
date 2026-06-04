import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { SKILL_COLORS, SKILL_ORDER } from '@/styles/theme';
import { useAppTheme, withAlpha } from '@/stores/themeStore';

interface CreateTaskModalProps {
  show: boolean;
  onClose: () => void;
  onCreate: (data: CreateTaskData) => Promise<void>;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: string;
  scheduled_at?: string;
  deadline?: string;
  estimated_minutes?: number;
  glow_reward?: number;
  tags?: string;
  skillXps: Record<string, number>;
}

export function CreateTaskModal({ show, onClose, onCreate }: CreateTaskModalProps) {
  const appTheme = useAppTheme();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [glowReward, setGlowReward] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [description, setDescription] = useState('');
  const [skillXps, setSkillXps] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (show) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [show]);

  if (!show) return null;

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('');
    setScheduledAt('');
    setDeadline('');
    setEstimatedMinutes('');
    setGlowReward('');
    setTags([]);
    setTagInput('');
    setSkillXps({});
    setExpanded(false);
  };

  const handleCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onCreate({
        title: trimmed,
        description: description.trim() || undefined,
        priority: priority || undefined,
        scheduled_at: scheduledAt || undefined,
        deadline: deadline || undefined,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
        glow_reward: glowReward ? parseInt(glowReward) : undefined,
        tags: tags.length > 0 ? JSON.stringify(tags) : undefined,
        skillXps,
      });
      reset();
      onClose();
    } finally {
      setSending(false);
    }
  };

  // 动态颜色
  const txt = appTheme.ink;
  const txtHint = withAlpha(txt, 0.35);
  const txtLight = withAlpha(txt, 0.3);
  const txtMid = withAlpha(txt, 0.5);
  const txtBody = withAlpha(txt, 0.7);
  const bgSubtle = withAlpha(txt, 0.05);
  const bgHover = withAlpha(txt, 0.1);
  const bgDisabled = withAlpha(txt, 0.1);
  const borderSubtle = withAlpha(txt, 0.1);

  return (
    <>
      <style>{`
        #create-task-modal .focus-accent:focus { border-color: ${appTheme.primary}; outline: none; }
        #create-task-modal .focus-ring-accent:focus { outline: none; box-shadow: 0 0 0 2px ${withAlpha(appTheme.primary, 0.3)}; }
        #create-task-modal .btn-create { background-color: ${appTheme.primary}; }
        #create-task-modal .btn-create:hover { background-color: ${withAlpha(appTheme.primary, 0.87)}; }
        #create-task-modal .input-focus-accent:focus { border-color: ${appTheme.primary}; outline: none; }
        #create-task-modal input::placeholder,
        #create-task-modal textarea::placeholder { color: ${txtHint}; }
      `}</style>
      <div id="create-task-modal" className="fixed inset-0 z-50 flex items-end justify-center pb-32">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full max-w-[600px] rounded-[18px] p-8 mx-4" style={{ backgroundColor: appTheme.canvas }}>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="输入任务名称..."
          className="w-full text-xl bg-transparent border-b pb-3 mb-5 focus:outline-none focus-accent"
          style={{ color: txt, borderColor: borderSubtle }}
        />

        {/* 截止时间 + 优先级 */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: bgSubtle }}>
            <span className="text-sm shrink-0" style={{ color: txtLight }}>截止</span>
            <input
              type="date"
              value={deadline.split('T')[0] || ''}
              onChange={(e) => {
                const time = deadline.split('T')[1] || '';
                setDeadline(e.target.value ? `${e.target.value}T${time || '00:00'}` : '');
              }}
              className="date-input text-sm w-32" style={{ color: txt }}
            />
            <input
              type="time"
              value={deadline.split('T')[1] || ''}
              onChange={(e) => {
                const date = deadline.split('T')[0] || '';
                if (date) setDeadline(`${date}T${e.target.value || '00:00'}`);
              }}
              className="time-input text-sm w-20" style={{ color: txt }}
            />
          </div>
          <div className="flex gap-2 ml-auto">
            {[
              { value: 'high', label: '紧急', color: appTheme.danger },
              { value: 'medium', label: '重要', color: appTheme.warning },
              { value: 'low', label: '一般', color: appTheme.primary },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPriority(priority === p.value ? '' : p.value)}
                className="px-4 py-2 rounded-full text-sm transition-all"
                style={priority === p.value
                  ? { backgroundColor: p.color, color: appTheme.onPrimary }
                  : { color: txtMid, backgroundColor: bgSubtle }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 展开/收起按钮 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-sm transition-colors mb-4"
          style={{ color: txtLight }}
          onMouseEnter={(e) => (e.currentTarget.style.color = txtMid)}
          onMouseLeave={(e) => (e.currentTarget.style.color = txtLight)}
        >
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? '收起' : '更多选项'}
        </button>

        {/* 展开区域 */}
        {expanded && (
          <div className="space-y-4 mb-5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: bgSubtle }}>
                <span className="text-sm shrink-0" style={{ color: txtLight }}>开始</span>
                <input
                  type="date"
                  value={scheduledAt.split('T')[0] || ''}
                  onChange={(e) => {
                    const time = scheduledAt.split('T')[1] || '';
                    setScheduledAt(e.target.value ? `${e.target.value}T${time || '00:00'}` : '');
                  }}
                  className="date-input text-sm w-32" style={{ color: txt }}
                />
                <input
                  type="time"
                  value={scheduledAt.split('T')[1] || ''}
                  onChange={(e) => {
                    const date = scheduledAt.split('T')[0] || '';
                    if (date) setScheduledAt(`${date}T${e.target.value || '00:00'}`);
                  }}
                  className="time-input text-sm w-20" style={{ color: txt }}
                />
              </div>
              <div className="flex items-center gap-1.5 rounded-xl px-3 py-2.5" style={{ backgroundColor: bgSubtle }}>
                <span className="text-sm" style={{ color: txtLight }}>预计</span>
                <input
                  type="number"
                  min="0"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  placeholder="30"
                  className="w-12 text-sm bg-transparent text-center focus:outline-none"
                  style={{ color: txt }}
                />
                <span className="text-sm" style={{ color: txtLight }}>分钟</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 ml-auto" style={{ backgroundColor: bgSubtle }}>
                <span className="text-sm" style={{ color: txtLight }}>萤火</span>
                <input
                  type="number"
                  min="0"
                  value={glowReward}
                  onChange={(e) => setGlowReward(e.target.value)}
                  placeholder="自动"
                  className="w-12 text-sm bg-transparent text-center focus:outline-none"
                  style={{ color: txt }}
                />
              </div>
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="添加描述..."
              className="w-full text-sm rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus-ring-accent resize-none"
              style={{ color: txt, backgroundColor: bgSubtle }}
            />

            {/* 标签 */}
            <div>
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
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    const tag = tagInput.trim();
                    if (!tags.includes(tag)) setTags([...tags, tag]);
                    setTagInput('');
                  }
                }}
                placeholder="输入标签，回车添加"
                className="w-full text-sm rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus-ring-accent"
                style={{ color: txt, backgroundColor: bgSubtle }}
              />
            </div>

            {/* 属性加成 */}
            <div>
              <label className="block text-sm mb-2" style={{ color: txtLight }}>属性加成</label>
              <div className="grid grid-cols-3 gap-3">
                {SKILL_ORDER.map((skillId) => {
                  const info = SKILL_COLORS[skillId];
                  return (
                    <div key={skillId} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: bgSubtle }}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: info.hex }} />
                      <span className="text-sm shrink-0" style={{ color: txtMid }}>{info.name}</span>
                      <input
                        type="number"
                        min="0"
                        value={skillXps[skillId] || ''}
                        onChange={(e) => setSkillXps((prev) => ({ ...prev, [skillId]: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                        className="w-12 text-sm bg-transparent text-center focus:outline-none"
                        style={{ color: txt }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-base transition-colors"
            style={{ color: txtMid, backgroundColor: bgSubtle }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = bgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bgSubtle)}
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || sending}
            className="flex-1 py-3 rounded-2xl text-base font-medium transition-all"
            style={title.trim() && !sending
              ? { backgroundColor: appTheme.primary, color: appTheme.onPrimary }
              : { backgroundColor: bgDisabled, color: txtLight }}
          >
            创建
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
