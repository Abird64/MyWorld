import { useState } from 'react';
import { useAppTheme } from '@/stores/themeStore';
import { X, Trash2 } from 'lucide-react';
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

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (editing) {
      onSubmit({ id: editing.id, name: name.trim(), icon, color, frequency_type: frequencyType });
    } else {
      onSubmit({ name: name.trim(), icon, color, frequency_type: frequencyType });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onCancel}
    >
      <div
        className="w-[95vw] sm:w-[400px] rounded-2xl p-6 space-y-4"
        style={{ backgroundColor: appTheme.canvas }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium" style={{ color: appTheme.ink }}>
            {editing ? '编辑习惯' : '新建习惯'}
          </h3>
          <button onClick={onCancel} className="p-1 rounded-full" style={{ color: `${appTheme.ink}88` }}>
            <X size={20} />
          </button>
        </div>

        {/* 图标选择 */}
        <div className="flex flex-wrap gap-2">
          {ICON_OPTIONS.map((ic) => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all"
              style={{
                backgroundColor: icon === ic ? `${color}33` : `${appTheme.primary}10`,
                outline: icon === ic ? `2px solid ${color}` : 'none',
              }}
            >
              {ic}
            </button>
          ))}
        </div>

        {/* 名称 */}
        <input
          type="text"
          placeholder="习惯名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{
            backgroundColor: `${appTheme.primary}15`,
            color: appTheme.ink,
            border: `1px solid ${appTheme.primary}33`,
          }}
          autoFocus
        />

        {/* 频率 */}
        <div className="flex gap-2">
          {[
            { id: 'daily', label: '每天' },
            { id: 'weekly', label: '每周' },
            { id: 'custom', label: '自选' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFrequencyType(opt.id)}
              className="flex-1 px-3 py-2 rounded-xl text-sm transition-all"
              style={{
                backgroundColor: frequencyType === opt.id ? color : `${appTheme.primary}15`,
                color: frequencyType === opt.id ? '#fff' : appTheme.ink,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 颜色 */}
        <div className="flex gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full transition-all"
              style={{
                backgroundColor: c,
                outline: color === c ? `2px solid ${appTheme.ink}` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          {editing && onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 rounded-xl text-sm flex items-center gap-1"
              style={{ color: '#C75C5C' }}
            >
              <Trash2 size={16} /> 删除
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={handleSubmit}
            className="px-6 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: color, color: '#fff' }}
          >
            {editing ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
