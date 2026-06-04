import { useState } from 'react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { SKILL_COLORS, SKILL_ORDER } from '@/styles/theme';
import { X, Trash2, ChevronDown } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import type { HabitWithStreak, CreateHabitInput, UpdateHabitInput } from '@/types/habit';

const COLOR_OPTIONS = ['#3A8FB7', '#58A968', '#C4784A', '#9B6FA6', '#C75C5C', '#D4A843'];
const ICON_OPTIONS = ['✨', '📖', '🏃', '✍️', '🧘', '💪', '🎯', '⛰️', '🎨', '🎵', '💤', '🥗'];

interface CreateHabitModalProps {
  editing?: HabitWithStreak | null;
  onSubmit: (input: CreateHabitInput | (UpdateHabitInput & { id: string })) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function CreateHabitModal({ editing, onSubmit, onCancel, onDelete }: CreateHabitModalProps) {
  const appTheme = useAppTheme();
  const [name, setName] = useState(editing?.name ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? '✨');
  const [color, setColor] = useState(editing?.color ?? COLOR_OPTIONS[0]);
  const [frequencyType, setFrequencyType] = useState(editing?.frequency_type ?? 'daily');
  const [xpPerCheck, setXpPerCheck] = useState(editing?.xp_per_check?.toString() ?? '5');
  const [skillId, setSkillId] = useState(editing?.skill_id ?? '');
  const [expanded, setExpanded] = useState(!!editing);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const txt = appTheme.ink;
  const txtHint = withAlpha(txt, 0.35);
  const txtMid = withAlpha(txt, 0.5);
  const bgSubtle = withAlpha(txt, 0.05);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const base = {
      name: name.trim(),
      icon,
      color,
      frequency_type: frequencyType,
      xp_per_check: parseInt(xpPerCheck) || 5,
      skill_id: skillId || undefined,
    };
    if (editing) {
      onSubmit({ id: editing.id, ...base });
    } else {
      onSubmit(base);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center pb-24"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onCancel}
    >
      <div
        className="w-[95vw] sm:w-[420px] rounded-[18px] p-6 space-y-4"
        style={{ backgroundColor: appTheme.canvas }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium" style={{ color: txt }}>
            {editing ? '编辑习惯' : '新建习惯'}
          </h3>
          <button onClick={onCancel} className="p-1 rounded-full" style={{ color: withAlpha(txt, 0.5) }}>
            <X size={20} />
          </button>
        </div>

        {/* 名称 */}
        <input
          type="text"
          placeholder="习惯名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{
            backgroundColor: withAlpha(appTheme.primary, 0.08),
            color: txt,
            border: `1px solid ${withAlpha(appTheme.primary, 0.2)}`,
          }}
          autoFocus
        />

        {/* 图标选择 */}
        <div className="flex flex-wrap gap-2">
          {ICON_OPTIONS.map((ic) => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all"
              style={{
                backgroundColor: icon === ic ? withAlpha(color, 0.2) : bgSubtle,
                outline: icon === ic ? `2px solid ${color}` : 'none',
              }}
            >
              {ic}
            </button>
          ))}
        </div>

        {/* 频率 */}
        <div className="flex gap-2">
          {[
            { id: 'daily', label: '每天' },
            { id: 'weekly', label: '每周' },
            { id: 'custom', label: '自选' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFrequencyType(opt.id as 'daily' | 'weekly' | 'custom')}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: frequencyType === opt.id ? color : bgSubtle,
                color: frequencyType === opt.id ? appTheme.onPrimary : txt,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 颜色 */}
        <div className="flex gap-2 justify-center">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full transition-all"
              style={{
                backgroundColor: c,
                outline: color === c ? `2.5px solid ${txt}` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>

        {/* 展开更多选项 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-1 text-xs transition-colors"
          style={{ color: txtHint }}
        >
          <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? '收起选项' : '更多选项'}
        </button>

        {expanded && (
          <div className="space-y-3 pt-1">
            {/* 经验值 */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: bgSubtle }}>
              <span className="text-sm shrink-0" style={{ color: txtHint }}>每次打卡获得</span>
              <input
                type="number"
                min="0"
                value={xpPerCheck}
                onChange={(e) => setXpPerCheck(e.target.value)}
                placeholder="5"
                className="w-12 text-sm bg-transparent text-center focus:outline-none font-medium"
                style={{ color: txt }}
              />
              <span className="text-sm shrink-0" style={{ color: txtHint }}>经验</span>
            </div>

            {/* 关联技能 */}
            <Select
              value={skillId}
              onChange={setSkillId}
              placeholder="不关联技能"
              options={[
                { value: '', label: '不关联技能' },
                ...SKILL_ORDER.map((sid) => ({
                  value: sid,
                  label: SKILL_COLORS[sid].name,
                  color: SKILL_COLORS[sid].hex,
                })),
              ]}
            />
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-1">
          {editing && onDelete && (
            showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: appTheme.danger }}>确认删除？</span>
                <button
                  onClick={() => { onDelete(); setShowDeleteConfirm(false); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: appTheme.danger, color: appTheme.onPrimary }}
                >
                  确认
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ color: txtMid }}
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 rounded-xl text-sm flex items-center gap-1 transition-colors"
                style={{ color: appTheme.danger }}
              >
                <Trash2 size={16} /> 删除
              </button>
            )
          )}
          <div className="flex-1" />
          <button
            onClick={handleSubmit}
            className="px-6 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: color, color: appTheme.onPrimary }}
          >
            {editing ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
