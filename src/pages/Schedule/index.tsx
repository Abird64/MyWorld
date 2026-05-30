import { useState, useEffect, useCallback, useRef } from 'react';
import { PageContainer } from '@/components/layout';
import { NavBar } from '@/components/ui';
import { WeekView } from '@/components/schedule/WeekView';
import { MonthView } from '@/components/schedule/MonthView';
import { AgendaView } from '@/components/schedule/AgendaView';
import { DayView } from '@/components/schedule/DayView';
import { DateNavigator } from '@/components/schedule/DateNavigator';
import { EventForm } from '@/components/schedule/EventForm';
import { EventDetail } from '@/components/schedule/EventDetail';
import { CalendarList } from '@/components/schedule/CalendarList';
import { CalendarManagerModal } from '@/components/schedule/CalendarManagerModal';
import { ImportDialog } from '@/components/schedule/ImportDialog';
import { CountdownList } from '@/components/schedule/CountdownList';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { parseIcs } from '@/utils/icsParser';
import * as scheduleService from '@/services/scheduleService';
import { startNotificationChecker, stopNotificationChecker, setNotificationEnabled } from '@/services/notificationService';
import { useSettingStore } from '@/stores/settingStore';
import { addExdate } from '@/services/scheduleService';
import { useAppTheme } from '@/stores/themeStore';
import { Plus } from 'lucide-react';
import type { Schedule, CreateScheduleInput, UpdateScheduleInput } from '@/types/schedule';
import type { ParsedIcsEvent } from '@/utils/icsParser';

type ViewMode = 'week' | 'month' | 'agenda' | 'day' | 'countdown';

/** 获取某天所在周的周一 */
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatWeekLabel(weekMonday: Date): string {
  const end = new Date(weekMonday);
  end.setDate(end.getDate() + 6);
  const sm = weekMonday.getMonth() + 1;
  const sd = weekMonday.getDate();
  const em = end.getMonth() + 1;
  const ed = end.getDate();
  if (sm === em) return `${sm}.${sd} - ${ed}`;
  return `${sm}.${sd} - ${em}.${ed}`;
}

export function SchedulePage() {
  const appTheme = useAppTheme();
  const getSetting = useSettingStore((s) => s.get);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekMonday, setWeekMonday] = useState(() => getWeekMonday(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [showForm, setShowForm] = useState(false);
  const [formDefaults, setFormDefaults] = useState<{ start?: string; end?: string }>({});
  const [selectedEvent, setSelectedEvent] = useState<Schedule | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importEvents, setImportEvents] = useState<ParsedIcsEvent[] | null>(null);
  const [showCalendarManager, setShowCalendarManager] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { schedules, error, fetchSchedules, createSchedule, updateSchedule, deleteSchedule } = useScheduleStore();
  const { visibleCalendarIds, fetchCalendars } = useCalendarStore();

  const currentMonth = weekMonday.getMonth();
  const currentYear = weekMonday.getFullYear();

  const rangeStart = viewMode === 'month'
    ? new Date(currentYear, currentMonth, 1).toISOString()
    : viewMode === 'agenda'
      ? new Date().toISOString()
      : weekMonday.toISOString();

  const rangeEnd = viewMode === 'month'
    ? new Date(currentYear, currentMonth + 1, 1).toISOString()
    : viewMode === 'agenda'
      ? (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })().toISOString()
      : (() => { const d = new Date(weekMonday); d.setDate(d.getDate() + 7); return d; })().toISOString();

  // 初始化加载日历表
  useEffect(() => {
    fetchCalendars();
  }, []);

  useEffect(() => {
    fetchSchedules(rangeStart, rangeEnd);
  }, [weekMonday.getTime(), viewMode, selectedDay.getTime()]);

  useEffect(() => {
    const notifyEnabled = getSetting('notification.task_reminder') === 'true';
    setNotificationEnabled(notifyEnabled);
    startNotificationChecker(
      () => schedules,
      (event) => {
        console.log(`[日程提醒] ${event.title}`);
      }
    );
    return () => {
      stopNotificationChecker();
    };
  }, [schedules, getSetting]);

  // 按日历可见性筛选
  const filteredSchedules = schedules.filter((s) => {
    if (!s.calendar_id) return true; // null calendar_id 始终可见
    return visibleCalendarIds.has(s.calendar_id);
  });

  const handlePrev = useCallback(() => {
    const prev = new Date(weekMonday);
    prev.setDate(prev.getDate() - 7);
    setWeekMonday(prev);
  }, [weekMonday]);

  const handleNext = useCallback(() => {
    const next = new Date(weekMonday);
    next.setDate(next.getDate() + 7);
    setWeekMonday(next);
  }, [weekMonday]);

  const handleToday = useCallback(() => {
    const today = new Date();
    setWeekMonday(getWeekMonday(today));
    setSelectedDay(today);
  }, []);

  const handlePrevMonth = useCallback(() => {
    const prev = new Date(currentYear, currentMonth - 1, 1);
    setWeekMonday(prev);
  }, [currentYear, currentMonth]);

  const handleNextMonth = useCallback(() => {
    const next = new Date(currentYear, currentMonth + 1, 1);
    setWeekMonday(next);
  }, [currentYear, currentMonth]);

  const [previousView, setPreviousView] = useState<ViewMode>('week');

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDay(date);
    setPreviousView('month');
    setViewMode('day');
  }, []);

  const handleBackFromDay = useCallback(() => {
    if (previousView === 'month') {
      setViewMode('month');
    } else {
      setWeekMonday(getWeekMonday(selectedDay));
      setViewMode('week');
    }
  }, [selectedDay, previousView]);

  const handlePrevDay = useCallback(() => {
    const prev = new Date(selectedDay);
    prev.setDate(prev.getDate() - 1);
    setSelectedDay(prev);
  }, [selectedDay]);

  const handleNextDay = useCallback(() => {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + 1);
    setSelectedDay(next);
  }, [selectedDay]);

  const handleCreateClick = useCallback(() => {
    setFormDefaults({});
    setShowForm(true);
  }, []);

  const handleFormSubmit = useCallback(async (input: CreateScheduleInput) => {
    await createSchedule(input);
    setShowForm(false);
    fetchSchedules(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd]);

  const handleEventClick = useCallback((event: Schedule) => {
    setSelectedEvent(event);
  }, []);

  const handleEventUpdate = useCallback(async (id: string, input: UpdateScheduleInput) => {
    await updateSchedule(id, input);
    setSelectedEvent(null);
    fetchSchedules(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd]);

  const handleEventDelete = useCallback(async (id: string) => {
    await deleteSchedule(id);
    setSelectedEvent(null);
    fetchSchedules(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd]);

  const handleUpdateInstance = useCallback(async (baseId: string, dateStr: string, input: UpdateScheduleInput) => {
    await addExdate(baseId, dateStr);
    await createSchedule({
      title: input.title || '',
      description: input.description,
      start_at: input.start_at || '',
      end_at: input.end_at,
      category: input.category,
      location: input.location,
    });
    setSelectedEvent(null);
    fetchSchedules(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd]);

  const handleDeleteInstance = useCallback(async (baseId: string, dateStr: string) => {
    await addExdate(baseId, dateStr);
    setSelectedEvent(null);
    fetchSchedules(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd]);

  // 导入 ICS：第一步 → 选文件并解析
  const handleImportIcs = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const events = parseIcs(content);

      if (events.length === 0) {
        setImportResult('未找到有效日程');
        setTimeout(() => setImportResult(null), 3000);
        return;
      }

      // 弹出导入对话框
      setImportEvents(events);
    } catch (err) {
      setImportResult('解析失败：' + String(err));
      setTimeout(() => setImportResult(null), 3000);
    }

    e.target.value = '';
  }, []);

  // 导入 ICS：第二步 → 选择日历并确认
  const handleImportConfirm = useCallback(async (calendarId: string | null) => {
    if (!importEvents) return;
    setImportEvents(null);

    try {
      const result = await scheduleService.importIcsEvents(importEvents, calendarId ?? undefined);
      setImportResult(`导入 ${result.imported} 个，跳过 ${result.skipped} 个`);
      setTimeout(() => setImportResult(null), 3000);
      fetchSchedules(rangeStart, rangeEnd);
    } catch (err) {
      setImportResult('导入失败：' + String(err));
      setTimeout(() => setImportResult(null), 3000);
    }
  }, [importEvents, rangeStart, rangeEnd]);

  return (
    <PageContainer className="relative">
      <style>{`
        .schedule-scroll::-webkit-scrollbar { display: none; }
        .schedule-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>
      <NavBar title="日历" />

      <div className="flex-shrink-0 flex flex-col items-center px-4 sm:px-8 pt-6 pb-4 relative z-10">
        <div className="w-full max-w-[1000px] space-y-4">
          {/* 视图切换 — 固定在顶部 */}
          <div className="flex items-center">
            <div className="flex items-center gap-1 rounded-full p-1 flex-shrink-0" style={{ backgroundColor: `${appTheme.ink}0D` }}>
              {(['day', 'week', 'month', 'agenda', 'countdown'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="px-3 py-1 rounded-full text-sm transition-all"
                  style={{
                    backgroundColor: viewMode === mode ? appTheme.primary : 'transparent',
                    color: viewMode === mode ? appTheme.ink : appTheme.inkMuted48,
                  }}
                >
                  {mode === 'day' ? '日' : mode === 'week' ? '周' : mode === 'month' ? '月' : mode === 'agenda' ? '近期' : '倒数日'}
                </button>
              ))}
            </div>
          </div>

          {/* 日历勾选 — 仅非倒数日视图 */}
          {viewMode !== 'countdown' && (
            <CalendarList onRefresh={() => fetchSchedules(rangeStart, rangeEnd)} onManage={() => setShowCalendarManager(true)} />
          )}

          {viewMode !== 'countdown' && (
            <DateNavigator
              weekLabel={viewMode === 'agenda'
                ? '近期'
                : viewMode === 'week'
                  ? formatWeekLabel(weekMonday)
                  : viewMode === 'month'
                    ? `${currentYear}年${currentMonth + 1}月`
                    : `${selectedDay.getMonth() + 1}月${selectedDay.getDate()}日`
              }
              onPrev={viewMode === 'agenda' ? undefined : viewMode === 'month' ? handlePrevMonth : viewMode === 'day' ? handlePrevDay : handlePrev}
              onNext={viewMode === 'agenda' ? undefined : viewMode === 'month' ? handleNextMonth : viewMode === 'day' ? handleNextDay : handleNext}
              onToday={handleToday}
              onImportIcs={handleImportIcs}
            />
          )}

          {(importResult || error) && (
            <div className="px-4 py-2 rounded-full text-sm text-center"
              style={{
                backgroundColor: error ? 'rgba(239,68,68,0.3)' : appTheme.primary,
                color: error ? 'rgb(254,202,202)' : appTheme.ink,
              }}
            >
              {error || importResult}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col items-center px-4 sm:px-8 pb-4 relative z-10 schedule-scroll">
        <div className="w-full max-w-[1000px]">
          {viewMode === 'week' ? (
            <WeekView
              weekStart={weekMonday}
              schedules={filteredSchedules}
              onEventClick={handleEventClick}
            />
          ) : viewMode === 'month' ? (
            <MonthView
              year={currentYear}
              month={currentMonth}
              schedules={filteredSchedules}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
            />
          ) : viewMode === 'day' ? (
            <DayView
              date={selectedDay}
              schedules={schedules}
              onEventClick={handleEventClick}
              onBack={handleBackFromDay}
              backLabel={previousView === 'month' ? '返回月视图' : '返回周视图'}
            />
          ) : viewMode === 'countdown' ? (
            <CountdownList />
          ) : (
            <AgendaView
              schedules={filteredSchedules}
              onEventClick={handleEventClick}
            />
          )}
        </div>
      </div>

      {showForm && (
        <EventForm
          defaultStart={formDefaults.start}
          defaultEnd={formDefaults.end}
          onSubmit={handleFormSubmit}
          onCancel={() => setShowForm(false)}
        />
      )}

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onUpdate={handleEventUpdate}
          onDelete={handleEventDelete}
          onUpdateInstance={handleUpdateInstance}
          onDeleteInstance={handleDeleteInstance}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* 导入对话框 */}
      {importEvents && (
        <ImportDialog
          eventCount={importEvents.length}
          onConfirm={handleImportConfirm}
          onCancel={() => setImportEvents(null)}
        />
      )}

      {/* 日历管理弹窗 */}
      {showCalendarManager && (
        <CalendarManagerModal onClose={() => {
          setShowCalendarManager(false);
          useCalendarStore.getState().fetchCalendars();
          fetchSchedules(rangeStart, rangeEnd);
        }} />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".ics"
        onChange={handleFileChange}
        className="hidden"
      />

      {viewMode !== 'countdown' && (
        <button
          onClick={handleCreateClick}
          className="fixed bottom-[72px] right-8 z-30 w-14 h-14 rounded-full text-white active:scale-95 transition-all flex items-center justify-center"
          style={{ backgroundColor: appTheme.primary }}
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}
    </PageContainer>
  );
}
