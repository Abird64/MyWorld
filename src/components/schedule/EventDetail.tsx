import { useState } from 'react';
import { useAppTheme } from '@/stores/themeStore';
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

export function EventDetail({ event, onUpdate, onDelete, onUpdateInstance, onDeleteInstance, onClose }: EventDetailProps) {
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
  const [showScopeChoice, setShowScopeChoice] = useState<'edit' | 'delete' | null>(null);

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
    if (isRecurringInstance) {
      setShowScopeChoice('edit');
    } else {
      setIsEditing(true);
    }
  };

  const handleScopeChoice = (scope: EditScope) => {
    setShowScopeChoice(null);
    if (showScopeChoice === 'edit') {
      if (scope === 'this' && onUpdateInstance) {
        // 单次编辑：直接进入编辑模式，保存时再处理
        setIsEditing(true);
        // 标记当前编辑模式
        setEditScope('this');
      } else {
        // 编辑所有：用 baseId 进入编辑
        setIsEditing(true);
        setEditScope('all');
      }
    } else if (showScopeChoice === 'delete') {
      if (scope === 'this' && onDeleteInstance && recurringInfo) {
        onDeleteInstance(recurringInfo.baseId, recurringInfo.dateStr);
      } else {
        const targetId = isRecurringInstance && recurringInfo ? recurringInfo.baseId : event.id;
        onDelete(targetId);
      }
      setShowDeleteConfirm(false);
    }
  };

  const [editScope, setEditScope] = useState<EditScope>('all');

  const handleDeleteClick = () => {
    if (isRecurringInstance) {
      setShowScopeChoice('delete');
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleDelete = () => {
    onDelete(event.id);
    setShowDeleteConfirm(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <style>{`
        .event-detail-edit-btn { color: ${appTheme.ink}80; }
        .event-detail-edit-btn:hover { color: ${appTheme.ink}; }
        .event-detail-cancel-btn { background-color: transparent; }
        .event-detail-cancel-btn:hover { background-color: ${appTheme.ink}0D; }
        .event-detail-input::placeholder { color: ${appTheme.ink}4D; }
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
            <span className="text-xs" style={{ color: `${appTheme.ink}80` }}>
              {isTaskSync ? '任务同步' : eventCalendar?.name || '日程'}
            </span>
            {isRecurringInstance && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ color: `${appTheme.ink}99`, backgroundColor: `${appTheme.primary}4D` }}>
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
            {isRecurringInstance && editScope === 'this' && (
              <div className="text-[10px] rounded-lg px-3 py-1.5" style={{ color: `${appTheme.ink}80`, backgroundColor: `${appTheme.primary}1A` }}>
                仅修改 {recurringInfo?.dateStr} 这一天的实例
              </div>
            )}
            {isRecurringInstance && editScope === 'all' && (
              <div className="text-[10px] rounded-lg px-3 py-1.5" style={{ color: `${appTheme.ink}80`, backgroundColor: `${appTheme.primary}1A` }}>
                修改所有重复实例
              </div>
            )}

            {/* 标题 */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl focus:outline-none text-sm"
              style={{ color: appTheme.ink, border: `1px solid ${appTheme.primary}4D`, backgroundColor: inputBg }}
              autoFocus
            />

            {/* 时间 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: `${appTheme.ink}80` }}>开始</label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl focus:outline-none text-sm"
                  style={{ color: appTheme.ink, border: `1px solid ${appTheme.primary}4D`, backgroundColor: inputBg }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: `${appTheme.ink}80` }}>结束</label>
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl focus:outline-none text-sm"
                  style={{ color: appTheme.ink, border: `1px solid ${appTheme.primary}4D`, backgroundColor: inputBg }}
                />
              </div>
            </div>

            {/* 日历 */}
            <div>
              <label className="text-xs mb-2 block" style={{ color: `${appTheme.ink}80` }}>日历</label>
              <select
                value={calendarId ?? ''}
                onChange={(e) => setCalendarId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: inputBg,
                  border: `1px solid ${appTheme.primary}4D`,
                  color: appTheme.ink,
                }}
              >
                <option value="">无分类</option>
                {calendars.map((cal) => (
                  <option key={cal.id} value={cal.id} style={{ backgroundColor: appTheme.canvas, color: appTheme.ink }}>
                    {cal.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 地点 */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: `${appTheme.ink}80` }}>地点</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="可选"
                className="event-detail-input w-full px-4 py-2 rounded-xl focus:outline-none text-sm"
                style={{ color: appTheme.ink, border: `1px solid ${appTheme.primary}4D`, backgroundColor: inputBg }}
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: `${appTheme.ink}80` }}>描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选"
                rows={3}
                className="event-detail-input w-full px-4 py-2 rounded-xl focus:outline-none text-sm resize-none"
                style={{ color: appTheme.ink, border: `1px solid ${appTheme.primary}4D`, backgroundColor: inputBg }}
              />
            </div>

            {/* 按钮 */}
            <div className="flex justify-between pt-2">
              <button
                onClick={handleDeleteClick}
                className="px-4 py-2 rounded-full text-sm text-red-500/70 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                删除
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => { setIsEditing(false); setEditScope('all'); }}
                  className="event-detail-cancel-btn px-4 py-2 rounded-full text-sm transition-colors"
                  style={{ color: `${appTheme.ink}99` }}
                >
                  取消
                </button>
                <button
                  onClick={() => handleSave(editScope)}
                  disabled={!title.trim()}
                  className="px-4 py-2 rounded-full text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{ color: '#fff', backgroundColor: isSaveHovered ? `${appTheme.primary}CC` : appTheme.primary }}
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
            <div className="flex items-center gap-2 text-sm" style={{ color: `${appTheme.ink}B2` }}>
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
              <div className="text-sm" style={{ color: `${appTheme.ink}B2` }}>
                📍 {event.location}
              </div>
            )}

            {/* 描述 */}
            {event.description && (
              <div className="text-sm rounded-xl p-3" style={{ color: `${appTheme.ink}B2`, backgroundColor: surfaceBg }}>
                {event.description}
              </div>
            )}

            {/* 重复规则 */}
            {event.rrule && (
              <div className="text-xs rounded-lg px-3 py-2" style={{ color: `${appTheme.ink}80`, backgroundColor: appTheme.divider }}>
                重复: {event.rrule}
              </div>
            )}

            {/* 关闭按钮 */}
            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-full text-sm transition-colors"
                style={{ color: appTheme.ink, backgroundColor: isCloseHovered ? `${appTheme.primary}CC` : appTheme.primary }}
                onMouseEnter={() => setIsCloseHovered(true)}
                onMouseLeave={() => setIsCloseHovered(false)}
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {/* 重复事件范围选择 */}
        {showScopeChoice && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
            <div className="rounded-2xl p-5 w-[300px]" style={{ backgroundColor: appTheme.canvas }}>
              <h3 className="text-lg font-medium mb-3" style={{ color: appTheme.ink }}>
                {showScopeChoice === 'edit' ? '编辑范围' : '删除范围'}
              </h3>
              <p className="text-sm mb-4" style={{ color: `${appTheme.ink}B2` }}>
                这是一个重复事件，你想{showScopeChoice === 'edit' ? '修改' : '删除'}哪个范围？
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleScopeChoice('this')}
                  className="w-full px-4 py-3 rounded-xl text-sm text-left transition-colors"
                  style={{ border: `1px solid ${appTheme.primary}33`, backgroundColor: inputBg }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = appTheme.canvasParchment)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = inputBg)}
                >
                  <div className="font-medium" style={{ color: appTheme.ink }}>只{showScopeChoice === 'edit' ? '修改' : '删除'}这一次</div>
                  <div className="text-[10px] mt-0.5" style={{ color: `${appTheme.ink}80` }}>
                    仅影响 {recurringInfo?.dateStr} 这一天
                  </div>
                </button>
                <button
                  onClick={() => handleScopeChoice('all')}
                  className="w-full px-4 py-3 rounded-xl text-sm text-left transition-colors"
                  style={{ border: `1px solid ${appTheme.primary}33`, backgroundColor: inputBg }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = appTheme.canvasParchment)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = inputBg)}
                >
                  <div className="font-medium" style={{ color: appTheme.ink }}>{showScopeChoice === 'edit' ? '修改' : '删除'}所有实例</div>
                  <div className="text-[10px] mt-0.5" style={{ color: `${appTheme.ink}80` }}>
                    影响整个重复事件系列
                  </div>
                </button>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowScopeChoice(null)}
                  className="event-detail-cancel-btn px-4 py-2 rounded-full text-sm transition-colors"
                  style={{ color: `${appTheme.ink}99` }}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 删除确认（非重复事件） */}
        {showDeleteConfirm && !isRecurringInstance && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
            <div className="rounded-2xl p-5 w-[300px]" style={{ backgroundColor: appTheme.canvas }}>
              <h3 className="text-lg font-medium mb-3" style={{ color: appTheme.ink }}>确认删除</h3>
              <p className="text-sm mb-4" style={{ color: `${appTheme.ink}B2` }}>
                确定要删除「{event.title}」吗？
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="event-detail-cancel-btn px-4 py-2 rounded-full text-sm transition-colors"
                  style={{ color: `${appTheme.ink}99` }}
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
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
