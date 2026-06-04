import { useState, useEffect, useCallback } from 'react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import * as scheduleService from '@/services/scheduleService';
import { getContrastColor } from './EventBlock';
import { Plus, X, Trash2 } from 'lucide-react';
import type { Schedule, CreateScheduleInput } from '@/types/schedule';

const COLOR_OPTIONS = ['#3A8FB7', '#58A968', '#C4784A', '#9B6FA6', '#C75C5C', '#D4A843'];

function getDaysRemaining(targetDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function toDateString(dateStr: string): string {
  // YYYY-MM-DD from ISO or YYYY-MM-DD string
  return dateStr.length >= 10 ? dateStr.slice(0, 10) : dateStr;
}

/** 倒数日创建/编辑弹窗 */
function CountdownForm({
  editing,
  onSubmit,
  onCancel,
  onDelete,
}: {
  editing: Schedule | null;
  onSubmit: (input: CreateScheduleInput & { id?: string }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const appTheme = useAppTheme();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [date, setDate] = useState(
    editing ? toDateString(editing.start_at) : toDateString(new Date().toISOString())
  );
  const [color, setColor] = useState(editing?.color ?? COLOR_OPTIONS[0]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      id: editing?.id,
      title: title.trim(),
      start_at: `${date}T00:00:00+08:00`,
      is_all_day: 1,
      color,
      event_type: 'countdown',
      source_type: 'manual',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onCancel}
    >
      <div
        className="w-[380px] rounded-2xl p-6 space-y-4"
        style={{ backgroundColor: appTheme.canvas }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium" style={{ color: appTheme.ink }}>
            {editing ? '编辑倒数日' : '新建倒数日'}
          </h3>
          <button onClick={onCancel} className="p-1 rounded-full" style={{ color: `${withAlpha(appTheme.ink, 0.53)}` }}>
            <X size={20} />
          </button>
        </div>

        <input
          type="text"
          placeholder="标题，如「生日」「考试」"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{
            backgroundColor: `${withAlpha(appTheme.primary, 0.08)}`,
            color: appTheme.ink,
            border: `1px solid ${withAlpha(appTheme.primary, 0.2)}`,
          }}
          autoFocus
        />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{
            backgroundColor: `${withAlpha(appTheme.primary, 0.08)}`,
            color: appTheme.ink,
            border: `1px solid ${withAlpha(appTheme.primary, 0.2)}`,
          }}
        />

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

        <div className="flex gap-2 pt-2">
          {editing && onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 rounded-xl text-sm flex items-center gap-1"
              style={{ color: appTheme.danger }}
            >
              <Trash2 size={16} /> 删除
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={handleSubmit}
            className="px-6 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: color, color: getContrastColor(color) }}
          >
            {editing ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 倒数日列表视图 */
export function CountdownList() {
  const appTheme = useAppTheme();
  const { countdowns, fetchCountdowns } = useScheduleStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);

  useEffect(() => {
    fetchCountdowns();
  }, [fetchCountdowns]);

  const handleCreate = useCallback(async (input: CreateScheduleInput & { id?: string }) => {
    if (input.id) {
      const { id, ...update } = input;
      await scheduleService.updateSchedule(id, update);
    } else {
      await scheduleService.createSchedule(input);
    }
    setShowForm(false);
    setEditing(null);
    fetchCountdowns();
  }, [fetchCountdowns]);

  const handleDelete = useCallback(async (id: string) => {
    await scheduleService.deleteSchedule(id);
    setShowForm(false);
    setEditing(null);
    fetchCountdowns();
  }, [fetchCountdowns]);

  // 排序：未过的在前按天数升序，已过的在后按天数降序
  const sorted = [...countdowns].sort((a, b) => {
    const da = getDaysRemaining(a.start_at);
    const db = getDaysRemaining(b.start_at);
    if (da >= 0 && db >= 0) return da - db;
    if (da < 0 && db < 0) return db - da;
    return da >= 0 ? -1 : 1;
  });

  if (sorted.length === 0 && !showForm) {
    return (
      <div className="w-full rounded-2xl p-12 text-center space-y-4" style={{ backgroundColor: appTheme.canvas }}>
        <p className="text-base" style={{ color: `${withAlpha(appTheme.ink, 0.35)}` }}>还没有倒数日</p>
        <p className="text-sm" style={{ color: `${withAlpha(appTheme.ink, 0.2)}` }}>标记一个值得等待的日子，让每一天都有盼头</p>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="mt-3 px-5 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2"
          style={{ backgroundColor: appTheme.primary, color: appTheme.ink }}
        >
          <Plus size={18} /> 创建第一个倒数日
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {sorted.map((item) => {
          const days = getDaysRemaining(item.start_at);
          const isExpired = days < 0;
          const isToday = days === 0;

          return (
            <button
              key={item.id}
              onClick={() => { setEditing(item); setShowForm(true); }}
              className="rounded-2xl p-5 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: appTheme.canvas,
                opacity: isExpired ? 0.5 : 1,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: item.color || COLOR_OPTIONS[0] }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: appTheme.ink }}>{item.title}</p>
                    <p className="text-xs mt-1" style={{ color: `${withAlpha(appTheme.ink, 0.53)}` }}>
                      {formatDate(item.start_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className="text-2xl font-bold tabular-nums"
                    style={{
                      color: isToday
                        ? '#D4A843'
                        : isExpired
                          ? `${withAlpha(appTheme.ink, 0.4)}`
                          : item.color || COLOR_OPTIONS[0],
                    }}
                  >
                    {isExpired ? `+${Math.abs(days)}` : isToday ? '今天' : days}
                  </p>
                  <p className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.4)}` }}>
                    {isExpired ? '天前' : isToday ? '' : '天'}
                  </p>
                </div>
              </div>
            </button>
          );
        })}

        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="rounded-2xl p-5 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            backgroundColor: `${withAlpha(appTheme.primary, 0.08)}`,
            border: `2px dashed ${withAlpha(appTheme.primary, 0.27)}`,
            color: `${withAlpha(appTheme.ink, 0.53)}`,
          }}
        >
          <Plus size={20} /> 新建倒数日
        </button>
      </div>

      {showForm && (
        <CountdownForm
          editing={editing}
          onSubmit={handleCreate}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onDelete={editing ? () => handleDelete(editing.id) : undefined}
        />
      )}
    </>
  );
}
