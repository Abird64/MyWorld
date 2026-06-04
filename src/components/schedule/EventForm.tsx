import { useState } from 'react';
import { Select } from '@/components/ui/Select';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';
import type { CreateScheduleInput } from '@/types/schedule';

interface EventFormProps {
  defaultStart?: string;
  defaultEnd?: string;
  onSubmit: (input: CreateScheduleInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const repeatOptions = [
  { id: 'none', label: '不重复' },
  { id: 'daily', label: '每天' },
  { id: 'weekly', label: '每周' },
  { id: 'monthly', label: '每月' },
  { id: 'yearly', label: '每年' },
];

const intervalLabels: Record<string, string> = {
  daily: '天',
  weekly: '周',
  monthly: '月',
  yearly: '年',
};

const weekDays = [
  { id: 'MO', label: '一' },
  { id: 'TU', label: '二' },
  { id: 'WE', label: '三' },
  { id: 'TH', label: '四' },
  { id: 'FR', label: '五' },
  { id: 'SA', label: '六' },
  { id: 'SU', label: '日' },
];

function toLocalDatetime(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(localDatetime: string, minutes: number): string {
  const d = new Date(localDatetime);
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildRrule(repeat: string, selectedDays: string[], interval: number): string | undefined {
  if (repeat === 'none') return undefined;
  const freq = repeat.toUpperCase();
  const parts: string[] = [`FREQ=${freq}`];
  if (interval > 1) {
    parts.push(`INTERVAL=${interval}`);
  }
  if (repeat === 'weekly' && selectedDays.length > 0) {
    parts.push(`BYDAY=${selectedDays.join(',')}`);
  }
  return parts.join(';');
}

export function EventForm({ defaultStart, defaultEnd, onSubmit, onCancel, isSubmitting }: EventFormProps) {
  const appTheme = useAppTheme();
  const { calendars } = useCalendarStore();
  const [title, setTitle] = useState('');
  const defaultStartVal = defaultStart ? toLocalDatetime(defaultStart) : toLocalDatetime(new Date().toISOString());
  const [startAt, setStartAt] = useState(defaultStartVal);
  const [endAt, setEndAt] = useState(
    defaultEnd ? toLocalDatetime(defaultEnd) : addMinutes(defaultStartVal, 40)
  );
  const [calendarId, setCalendarId] = useState<string | null>(
    calendars.find((c) => c.is_default)?.id ?? calendars[0]?.id ?? null
  );
  const [repeat, setRepeat] = useState('none');
  const [interval, setInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);
  const [isCancelHovered, setIsCancelHovered] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);

  // 开始时间变化时自动更新结束时间（+40 分钟）
  const handleStartChange = (val: string) => {
    setStartAt(val);
    setEndAt(addMinutes(val, 40));
  };

  // 切换重复类型：重置间隔为 1
  const handleRepeatChange = (id: string) => {
    setRepeat(id);
    if (id === 'none') {
      setInterval(1);
      setSelectedDays([]);
    }
  };

  // 切换星期选择
  const toggleDay = (dayId: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // 时间校验：结束时间必须晚于开始时间
    if (endAt) {
      const startDate = new Date(startAt);
      const endDate = new Date(endAt);
      if (endDate <= startDate) {
        setTimeError('结束时间必须晚于开始时间');
        return;
      }
    }
    setTimeError(null);

    const rrule = buildRrule(repeat, selectedDays, interval);

    onSubmit({
      title: title.trim(),
      start_at: new Date(startAt).toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : undefined,
      calendar_id: calendarId ?? undefined,
      source_type: 'manual',
      rrule,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <style>{`
        .event-form-input::placeholder { color: ${withAlpha(appTheme.ink, 0.3)}; }
      `}</style>
      <div
        className="rounded-2xl p-6 w-[95vw] sm:w-[380px]"
        style={{ backgroundColor: appTheme.canvas }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-medium mb-5 tracking-wider" style={{ color: appTheme.ink }}>新建日程</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 标题 */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="日程标题"
            className="event-form-input w-full px-4 py-3 rounded-xl focus:outline-none text-sm"
            style={{
              color: appTheme.ink,
              border: `1px solid ${withAlpha(appTheme.primary, 0.3)}`,
              backgroundColor: appTheme.canvasParchment,
            }}
            autoFocus
          />

          {/* 开始时间 */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>开始时间</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => { handleStartChange(e.target.value); setTimeError(null); }}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none text-sm"
              style={{
                color: appTheme.ink,
                border: `1px solid ${timeError ? 'rgba(201,112,112,0.6)' : withAlpha(appTheme.primary, 0.3)}`,
                backgroundColor: appTheme.canvasParchment,
              }}
            />
          </div>

          {/* 结束时间 */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>结束时间</label>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => { setEndAt(e.target.value); setTimeError(null); }}
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none text-sm"
              style={{
                color: appTheme.ink,
                border: `1px solid ${timeError ? 'rgba(201,112,112,0.6)' : withAlpha(appTheme.primary, 0.3)}`,
                backgroundColor: appTheme.canvasParchment,
              }}
            />
            {timeError && (
              <p className="text-xs mt-1" style={{ color: appTheme.danger }}>{timeError}</p>
            )}
          </div>

          {/* 日历 */}
          <div>
            <label className="text-xs mb-2 block" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>日历</label>
            <Select
              value={calendarId ?? ''}
              onChange={(v) => setCalendarId(v || null)}
              placeholder="无分类"
              options={calendars.map((cal) => ({ value: cal.id, label: cal.name }))}
            />
          </div>

          {/* 重复规则 */}
          <div>
            <label className="text-xs mb-2 block" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>重复</label>
            <div className="flex gap-2 flex-wrap">
              {repeatOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleRepeatChange(opt.id)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                    repeat === opt.id
                      ? ''
                      : 'hover:opacity-80'
                  }`}
                  style={
                    repeat === opt.id
                      ? { backgroundColor: appTheme.primary, color: appTheme.ink }
                      : {
                          color: `${withAlpha(appTheme.ink, 0.7)}`,
                          backgroundColor: appTheme.canvasParchment,
                        }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 间隔选择器：选中非 none 时显示 */}
            {repeat !== 'none' && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.6)}` }}>每隔</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={interval}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 1;
                    setInterval(Math.max(1, Math.min(99, v)));
                  }}
                  className="w-14 px-2 py-1 rounded-xl text-center text-sm outline-none"
                  style={{
                    color: appTheme.ink,
                    border: `1px solid ${withAlpha(appTheme.primary, 0.3)}`,
                    backgroundColor: appTheme.canvasParchment,
                  }}
                />
                <span className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.6)}` }}>
                  {intervalLabels[repeat]}
                </span>
              </div>
            )}

            {/* 每周：选择星期 */}
            {repeat === 'weekly' && (
              <div className="flex gap-1.5 mt-3">
                {weekDays.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`w-8 h-8 rounded-full text-xs transition-all ${
                      selectedDays.includes(day.id)
                        ? ''
                        : 'hover:opacity-80'
                    }`}
                    style={
                      selectedDays.includes(day.id)
                        ? { backgroundColor: appTheme.primary, color: appTheme.ink }
                        : {
                            color: `${withAlpha(appTheme.ink, 0.7)}`,
                            backgroundColor: appTheme.canvasParchment,
                          }
                    }
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2 rounded-full text-sm transition-colors"
              style={{
                color: `${withAlpha(appTheme.ink, 0.6)}`,
                backgroundColor: isCancelHovered ? `${withAlpha(appTheme.ink, 0.05)}` : 'transparent',
              }}
              onMouseEnter={() => setIsCancelHovered(true)}
              onMouseLeave={() => setIsCancelHovered(false)}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="px-5 py-2 rounded-full text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ color: appTheme.ink, backgroundColor: isSubmitHovered ? `${withAlpha(appTheme.primary, 0.8)}` : appTheme.primary }}
              onMouseEnter={() => setIsSubmitHovered(true)}
              onMouseLeave={() => setIsSubmitHovered(false)}
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
