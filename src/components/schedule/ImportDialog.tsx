import { useState, useEffect } from 'react';
import { Select } from '@/components/ui/Select';
import { useCalendarStore } from '@/stores/calendarStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import * as calendarService from '@/services/calendarService';
import type { Calendar } from '@/types/schedule';
import { X } from 'lucide-react';

interface ImportDialogProps {
  eventCount: number;
  onConfirm: (calendarId: string | null) => void;
  onCancel: () => void;
}

export function ImportDialog({ eventCount, onConfirm, onCancel }: ImportDialogProps) {
  const appTheme = useAppTheme();
  const { calendars } = useCalendarStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calendarService.getDefaultCalendar().then((cal: Calendar) => {
      setSelectedId(cal.id);
      setLoading(false);
    }).catch(() => {
      // 无默认日历时选第一个
      if (calendars.length > 0) {
        setSelectedId(calendars[0].id);
      }
      setLoading(false);
    });
  }, [calendars]);

  const handleConfirm = () => {
    onConfirm(selectedId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="rounded-2xl p-6 w-[380px]" style={{ backgroundColor: appTheme.canvas }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-light tracking-wider" style={{ color: appTheme.ink }}>导入日程</h3>
          <button onClick={onCancel} style={{ color: `${withAlpha(appTheme.ink, 0.4)}` }}>
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <p className="text-sm mb-4" style={{ color: `${withAlpha(appTheme.ink, 0.6)}` }}>
          将导入 <span style={{ color: appTheme.primary, fontWeight: 500 }}>{eventCount}</span> 条新日程，请选择导入到哪个日历：
        </p>

        {loading ? (
          <div className="text-center py-4 text-sm" style={{ color: `${withAlpha(appTheme.ink, 0.4)}` }}>加载中...</div>
        ) : (
          <Select
            value={selectedId ?? ''}
            onChange={(v) => setSelectedId(v || null)}
            placeholder="无分类"
            options={calendars.map((cal) => ({ value: cal.id, label: cal.name }))}
            className="mb-4"
          />
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-full text-sm transition-opacity hover:opacity-80"
            style={{ backgroundColor: `${withAlpha(appTheme.primary, 0.2)}`, color: appTheme.ink }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-1.5 rounded-full text-sm font-light transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: appTheme.primary, color: appTheme.ink }}
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
}
