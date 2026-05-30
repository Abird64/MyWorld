import { useState, useEffect } from 'react';
import { useCalendarStore } from '@/stores/calendarStore';
import { useAppTheme } from '@/stores/themeStore';
import { X, Plus, Trash2 } from 'lucide-react';

const PRESET_COLORS = [
  '#3A8FB7', '#4A90D9', '#58A968', '#D4A843', '#D98B58',
  '#8A6DA7', '#E65C5C', '#F2C94C', '#6C9EBF', '#BF8A6C',
  '#5BC0BE', '#E76F51', '#264653', '#2A9D8F', '#E9C46A',
];

interface Props {
  onClose: () => void;
}

export function CalendarManagerModal({ onClose }: Props) {
  const appTheme = useAppTheme();
  const { calendars, fetchCalendars, createCalendar, updateCalendar, deleteCalendar } = useCalendarStore();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3A8FB7');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // 打开时刷新日历列表
  useEffect(() => {
    fetchCalendars();
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { setError('请输入日历名称'); return; }
    if (calendars.some((c) => c.name === name)) { setError('日历名称已存在'); return; }
    try {
      await createCalendar(name, newColor);
      setNewName('');
      setError('');
    } catch (e) {
      setError(String(e));
    }
  };

  const handleStartEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
    setError('');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) { setError('请输入日历名称'); return; }
    try {
      await updateCalendar(editingId, name, editColor);
      setEditingId(null);
      setError('');
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCalendar(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      setError(String(e));
      setDeleteTarget(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl p-6 w-[420px] max-h-[85vh] overflow-y-auto" style={{ backgroundColor: appTheme.canvas }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-light tracking-wider" style={{ color: appTheme.ink }}>管理日历</h3>
          <button onClick={onClose} style={{ color: `${appTheme.ink}66` }}>
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-full text-xs text-center mb-3" style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {/* Calendar list */}
        <div className="space-y-2 mb-4 max-h-[260px] overflow-y-auto">
          {calendars.map((cal) => (
            <div key={cal.id} className={`px-3 py-2 rounded-xl ${editingId === cal.id ? '' : 'flex items-center gap-2'}`} style={{ backgroundColor: `${appTheme.primary}1A` }}>
              {editingId === cal.id ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-transparent border-b text-sm px-1 py-0.5"
                    style={{ borderColor: appTheme.primary, color: appTheme.ink }}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {PRESET_COLORS.slice(0, 10).map((c) => (
                        <button
                          key={c}
                          className="w-5 h-5 rounded-full border transition-transform"
                          style={{ backgroundColor: c, borderColor: editColor === c ? appTheme.ink : 'transparent', transform: editColor === c ? 'scale(1.3)' : 'scale(1)' }}
                          onClick={() => setEditColor(c)}
                        />
                      ))}
                    </div>
                    <button onClick={handleSaveEdit} className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: appTheme.primary, color: appTheme.ink }}>保存</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
                  <span className="flex-1 text-sm font-light" style={{ color: appTheme.ink }}>{cal.name}</span>
                  <button
                    onClick={() => handleStartEdit(cal.id, cal.name, cal.color)}
                    className="text-xs px-2 py-1 rounded-full transition-opacity hover:opacity-80"
                    style={{ color: `${appTheme.ink}80` }}
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: cal.id, name: cal.name })}
                    className="text-xs p-1 rounded-full transition-opacity hover:opacity-80"
                    style={{ color: '#E65C5C' }}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </>
              )}
            </div>
          ))}
          {calendars.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm mb-2" style={{ color: `${appTheme.ink}80` }}>还没有日历</p>
              <p className="text-xs" style={{ color: `${appTheme.ink}4D` }}>在下方创建你的第一个日历</p>
            </div>
          )}
        </div>

        {/* Create new - 新建日历区域 */}
        <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: `${appTheme.primary}1A`, border: `1px dashed ${appTheme.primary}66` }}>
          <p className="text-xs font-medium" style={{ color: `${appTheme.ink}99` }}>新建日历</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="输入日历名称..."
            className="w-full bg-transparent border-b text-sm px-1 py-1 placeholder:font-light"
            style={{ borderColor: appTheme.primary, color: appTheme.ink }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {PRESET_COLORS.slice(0, 8).map((c) => (
                <button
                  key={c}
                  className="w-5 h-5 rounded-full border transition-transform"
                  style={{ backgroundColor: c, borderColor: newColor === c ? appTheme.ink : 'transparent', transform: newColor === c ? 'scale(1.3)' : 'scale(1)' }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-light transition-all hover:opacity-90"
              style={{ backgroundColor: appTheme.primary, color: appTheme.ink }}
            >
              <Plus size={14} strokeWidth={2} />
              创建
            </button>
          </div>
        </div>

        <div className="mt-3 text-center text-xs" style={{ color: `${appTheme.ink}4D` }}>
          编辑模式下可选用更多颜色
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="rounded-2xl p-5 w-[300px]" style={{ backgroundColor: appTheme.canvas }}>
            <h3 className="text-lg font-medium mb-3" style={{ color: appTheme.ink }}>确认删除</h3>
            <p className="text-sm mb-4" style={{ color: `${appTheme.ink}B2` }}>
              确定要删除日历「{deleteTarget.name}」吗？关联的日程将变为"未分类"。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-full text-sm transition-colors"
                style={{ color: `${appTheme.ink}99` }}
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
