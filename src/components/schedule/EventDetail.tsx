import { useState } from 'react';
import { Select } from '@/components/ui/Select';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';
import type { Schedule, UpdateScheduleInput } from '@/types/schedule';

interface EventDetailProps {
  event: Schedule;
  onUpdate: (id: string, input: UpdateScheduleInput) => void;
  onDelete: (id: string) => void;
  /** 编辑重复事件的单次实例：baseId, dateStr, 修改内容 */
  onUpdateInstance?: (baseId: string, dateStr: string, input: UpdateScheduleInput) => void;
  /** 删除重复事件的单次实例：baseId, dateStr */
  onDeleteInstance?: (baseId: string, dateStr: string) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

function toLocalDatetime(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 判断是否为重复事件的展开实例（ID 格式: {baseId}_{YYYY-MM-DD}） */
function parseRecurringInstanceId(id: string): { baseId: string; dateStr: string } | null {
  // nanoid 不含下划线，所以最后一个 _ 后面是日期
  const lastUnderscore = id.lastIndexOf('_');
  if (lastUnderscore <= 0) return null;

  const baseId = id.substring(0, lastUnderscore);
  const dateStr = id.substring(lastUnderscore + 1);

  // 验证日期格式 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { baseId, dateStr };
  }
  return null;
}

type EditScope = 'this' | 'all';

export function EventDetail({ event, onUpdate, onDelete, onUpdateInstance, onDeleteInstance, onClose, isSubmitting }: EventDetailProps) {
  const appTheme = useAppTheme();
  const { calendars, getCalendarById } = useCalendarStore();
  const inputBg = appTheme.canvasParchment;
  const surfaceBg = appTheme.divider;
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [startAt, setStartAt] = useState(toLocalDatetime(event.start_at));
  const [endAt, setEndAt] = useState(event.end_at ? toLocalDatetime(event.end_at) : '');
  const [calendarId, setCalendarId] = useState<string | null>(event.calendar_id ?? null);
  const [location, setLocation] = useState(event.location || '');
  const [description, setDescription] = useState(event.description || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaveHovered, setIsSaveHovered] = useState(false);
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const [deleteScope, setDeleteScope] = useState<EditScope>('all');

  const isTaskSync = event.source_type === 'task_sync';
  const bgColor = event.color || appTheme.primary;
  const eventCalendar = getCalendarById(event.calendar_id ?? null);

  // 判断是否为重复事件实例
  const recurringInfo = parseRecurringInstanceId(event.id);
  const isRecurringInstance = recurringInfo !== null && !event.rrule;

  const handleSave = (scope?: EditScope) => {
    const input: UpdateScheduleInput = {
      title: title.trim(),
      start_at: new Date(startAt).toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : undefined,
      calendar_id: calendarId ?? undefined,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    };

    if (isRecurringInstance && scope === 'this' && onUpdateInstance && recurringInfo) {
      // 只修改这一次：添加 exdate 到父事件，创建独立事件
      onUpdateInstance(recurringInfo.baseId, recurringInfo.dateStr, input);
    } else {
      // 修改所有（或非重复事件）
      const targetId = isRecurringInstance && recurringInfo ? recurringInfo.baseId : event.id;
      onUpdate(targetId, input);
    }
    setIsEditing(false);
  };

  const handleEditClick = () => {
    setEditScope('this');
    setIsEditing(true);
  };

  const [editScope, setEditScope] = useState<EditScope>('this');

  const handleDeleteClick = () => {
    setDeleteScope('all');
    setShowDeleteConfirm(true);
  };

  const handleDelete = () => {
    if (isRecurringInstance && deleteScope === 'this' && onDeleteInstance && recurringInfo) {
      onDeleteInstance(recurringInfo.baseId, recurringInfo.dateStr);
    } else {
      const targetId = isRecurringInstance && recurringInfo ? recurringInfo.baseId : event.id;
      onDelete(targetId);
    }
    setShowDeleteConfirm(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <style>{`
        .event-detail-edit-btn { color: ${withAlpha(appTheme.ink, 0.5)}; }
        .event-detail-edit-btn:hover { color: ${appTheme.ink}; }
        .event-detail-cancel-btn { background-color: transparent; }
        .event-detail-cancel-btn:hover { background-color: ${withAlpha(appTheme.ink, 0.05)}; }
        .event-detail-input::placeholder { color: ${withAlpha(appTheme.ink, 0.3)}; }
      `}</style>
      <div
        className="rounded-2xl p-6 w-[400px] max-h-[80vh] overflow-y-auto"
        style={{ backgroundColor: appTheme.canvas }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: bgColor }}
            />
            <span className="text-xs" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>
              {isTaskSync ? '任务同步' : eventCalendar?.name || '日程'}
            </span>
            {isRecurringInstance && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ color: `${withAlpha(appTheme.ink, 0.6)}`, backgroundColor: `${withAlpha(appTheme.primary, 0.3)}` }}>
                重复
              </span>
            )}
          </div>
          {!isTaskSync && (
            <button
              onClick={handleEditClick}
              className="event-detail-edit-btn text-xs transition-colors"
            >
              {isEditing ? '取消' : '编辑'}
            </button>
          )}
        </div>

        {isEditing ? (
          /* 编辑模式 */
          <div className="space-y-4">
            {isRecurringInstance && (
              <div className="flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.04)}` }}>
                <button
                  onClick={() => setEditScope('this')}
                  className="flex-1 px-3 py-1.5 rounded-md text-xs transition-all"
                  style={{
                    backgroundColor: editScope === 'this' ? `${withAlpha(appTheme.primary, 0.15)}` : 'transparent',
                    color: editScope === 'this' ? appTheme.primary : `${withAlpha(appTheme.ink, 0.5)}`,
                  }}
                >
                  仅此一次
                </button>
                <button
                  onClick={() => setEditScope('all')}
                  className="flex-1 px-3 py-1.5 rounded-md text-xs transition-all"
                  style={{
                    backgroundColor: editScope === 'all' ? `${withAlpha(appTheme.primary, 0.15)}` : 'transparent',
                    color: editScope === 'all' ? appTheme.primary : `${withAlpha(appTheme.ink, 0.5)}`,
                  }}
                >
                  所有实例
                </button>
              </div>
            )}
            {isRecurringInstance && editScope === 'this' && recurringInfo && (
              <div className="text-[10px] -mt-2 px-1" style={{ color: `${withAlpha(appTheme.ink, 0.35)}` }}>
                仅影响 {recurringInfo.dateStr} 这一天
              </div>
            )}

            {/* 标题 */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl focus:outline-none text-sm"
              style={{ color: appTheme.ink, border: `1px solid ${withAlpha(appTheme.primary, 0.3)}`, backgroundColor: inputBg }}
              autoFocus
            />

            {/* 时间 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>开始</label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl focus:outline-none text-sm"
                  style={{ color: appTheme.ink, border: `1px solid ${withAlpha(appTheme.primary, 0.3)}`, backgroundColor: inputBg }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>结束</label>
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl focus:outline-none text-sm"
                  style={{ color: appTheme.ink, border: `1px solid ${withAlpha(appTheme.primary, 0.3)}`, backgroundColor: inputBg }}
                />
              </div>
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

            {/* 地点 */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>地点</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="可选"
                className="event-detail-input w-full px-4 py-2 rounded-xl focus:outline-none text-sm"
                style={{ color: appTheme.ink, border: `1px solid ${withAlpha(appTheme.primary, 0.3)}`, backgroundColor: inputBg }}
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选"
                rows={3}
                className="event-detail-input w-full px-4 py-2 rounded-xl focus:outline-none text-sm resize-none"
                style={{ color: appTheme.ink, border: `1px solid ${withAlpha(appTheme.primary, 0.3)}`, backgroundColor: inputBg }}
              />
            </div>

            {/* 按钮 */}
            <div className="flex justify-between pt-2">
              <button
                onClick={handleDeleteClick}
                className="px-4 py-2 rounded-full text-sm transition-colors"
                style={{ color: `${withAlpha(appTheme.danger, 0.7)}` }}
                onMouseEnter={(e) => { e.currentTarget.style.color = appTheme.danger; e.currentTarget.style.backgroundColor = `${withAlpha(appTheme.danger, 0.08)}`; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = `${withAlpha(appTheme.danger, 0.7)}`; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                删除
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => { setIsEditing(false); setEditScope('this'); }}
                  className="event-detail-cancel-btn px-4 py-2 rounded-full text-sm transition-colors"
                  style={{ color: `${withAlpha(appTheme.ink, 0.6)}` }}
                >
                  取消
                </button>
                <button
                  onClick={() => handleSave(editScope)}
                  disabled={!title.trim() || isSubmitting}
                  className="px-4 py-2 rounded-full text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{ color: appTheme.onPrimary, backgroundColor: isSaveHovered ? `${withAlpha(appTheme.primary, 0.8)}` : appTheme.primary }}
                  onMouseEnter={() => setIsSaveHovered(true)}
                  onMouseLeave={() => setIsSaveHovered(false)}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* 查看模式 */
          <div className="space-y-4">
            {/* 标题 */}
            <h2 className="text-xl font-medium" style={{ color: appTheme.ink }}>{event.title}</h2>

            {/* 时间 */}
            <div className="flex items-center gap-2 text-sm" style={{ color: `${withAlpha(appTheme.ink, 0.7)}` }}>
              <span>{formatDateTime(event.start_at)}</span>
              {event.end_at && (
                <>
                  <span>→</span>
                  <span>{formatDateTime(event.end_at)}</span>
                </>
              )}
            </div>

            {/* 地点 */}
            {event.location && (
              <div className="text-sm" style={{ color: `${withAlpha(appTheme.ink, 0.7)}` }}>
                📍 {event.location}
              </div>
            )}

            {/* 描述 */}
            {event.description && (
              <div className="text-sm rounded-xl p-3" style={{ color: `${withAlpha(appTheme.ink, 0.7)}`, backgroundColor: surfaceBg }}>
                {event.description}
              </div>
            )}

            {/* 重复规则 */}
            {event.rrule && (
              <div className="text-xs rounded-lg px-3 py-2" style={{ color: `${withAlpha(appTheme.ink, 0.5)}`, backgroundColor: appTheme.divider }}>
                重复: {humanizeRrule(event.rrule)}
              </div>
            )}

            {/* 关闭按钮 */}
            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-full text-sm transition-colors"
                style={{ color: appTheme.ink, backgroundColor: isCloseHovered ? `${withAlpha(appTheme.primary, 0.8)}` : appTheme.primary }}
                onMouseEnter={() => setIsCloseHovered(true)}
                onMouseLeave={() => setIsCloseHovered(false)}
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {/* 删除确认 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
            <div className="rounded-2xl p-5 w-[300px]" style={{ backgroundColor: appTheme.canvas }}>
              <h3 className="text-lg font-medium mb-3" style={{ color: appTheme.ink }}>确认删除</h3>
              <p className="text-sm mb-4" style={{ color: `${withAlpha(appTheme.ink, 0.7)}` }}>
                确定要删除「{event.title}」吗？
              </p>
              {isRecurringInstance && (
                <div className="flex items-center gap-1 rounded-lg p-1 mb-4" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.04)}` }}>
                  <button
                    onClick={() => setDeleteScope('this')}
                    className="flex-1 px-3 py-1.5 rounded-md text-xs transition-all"
                    style={{
                      backgroundColor: deleteScope === 'this' ? `${withAlpha(appTheme.danger, 0.15)}` : 'transparent',
                      color: deleteScope === 'this' ? appTheme.danger : `${withAlpha(appTheme.ink, 0.5)}`,
                    }}
                  >
                    仅此一次
                  </button>
                  <button
                    onClick={() => setDeleteScope('all')}
                    className="flex-1 px-3 py-1.5 rounded-md text-xs transition-all"
                    style={{
                      backgroundColor: deleteScope === 'all' ? `${withAlpha(appTheme.danger, 0.15)}` : 'transparent',
                      color: deleteScope === 'all' ? appTheme.danger : `${withAlpha(appTheme.ink, 0.5)}`,
                    }}
                  >
                    所有实例
                  </button>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="event-detail-cancel-btn px-4 py-2 rounded-full text-sm transition-colors"
                  style={{ color: `${withAlpha(appTheme.ink, 0.6)}` }}
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-full text-sm transition-colors"
                  style={{ backgroundColor: appTheme.danger, color: appTheme.onPrimary }}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const FREQ_LABELS: Record<string, string> = {
  DAILY: '天', WEEKLY: '周', MONTHLY: '月', YEARLY: '年',
};
const DAY_LABELS: Record<string, string> = {
  MO: '周一', TU: '周二', WE: '周三', TH: '周四', FR: '周五', SA: '周六', SU: '周日',
};

function humanizeRrule(rrule: string): string {
  try {
    const parts = rrule.split(';');
    const map: Record<string, string> = {};
    for (const p of parts) {
      const [k, v] = p.split('=');
      if (k && v) map[k] = v;
    }
    const freq = FREQ_LABELS[map.FREQ] || map.FREQ || '';
    const interval = map.INTERVAL ? parseInt(map.INTERVAL) : 1;
    const intervalText = interval > 1 ? `每${interval}${freq}` : `每${freq}`;

    if (map.BYDAY) {
      const days = map.BYDAY.split(',').map((d) => DAY_LABELS[d] || d).join('、');
      return `${intervalText}的${days}`;
    }
    return intervalText;
  } catch {
    return rrule;
  }
}
