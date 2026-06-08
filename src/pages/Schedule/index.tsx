import { useState, useEffect, useCallback, useRef } from 'react';
import { PageContainer } from '@/components/layout';
import { NavBar } from '@/components/ui';
import { WeekView } from '@/components/schedule/WeekView';
import { MonthView } from '@/components/schedule/MonthView';
import { AgendaView } from '@/components/schedule/AgendaView';
import { DayView } from '@/components/schedule/DayView';

import { EventForm } from '@/components/schedule/EventForm';
import { EventDetail } from '@/components/schedule/EventDetail';

import { CalendarManagerModal } from '@/components/schedule/CalendarManagerModal';
import { ImportDialog } from '@/components/schedule/ImportDialog';
import { CountdownList } from '@/components/schedule/CountdownList';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { parseIcs } from '@/utils/icsParser';
import * as scheduleService from '@/services/scheduleService';

import { addExdate } from '@/services/scheduleService';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { Plus, Upload, X, Settings, MoreHorizontal } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekMonday, setWeekMonday] = useState(() => getWeekMonday(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [showForm, setShowForm] = useState(false);
  const [formDefaults, setFormDefaults] = useState<{ start?: string; end?: string }>({});
  const [selectedEvent, setSelectedEvent] = useState<Schedule | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importEvents, setImportEvents] = useState<ParsedIcsEvent[] | null>(null);
  const [showCalendarManager, setShowCalendarManager] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [crudError, setCrudError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { schedules, error, fetchSchedules, createSchedule, updateSchedule, deleteSchedule } = useScheduleStore();
  const { calendars, visibleCalendarIds, fetchCalendars, toggleCalendar } = useCalendarStore();

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

  // 加载数据：先日历后日程，确保 visibleCalendarIds 就绪后再过滤日程
  // 每次页面挂载 + 视图/日期变化都重新加载
  useEffect(() => {
    const load = async () => {
      await fetchCalendars();
      await fetchSchedules(rangeStart, rangeEnd);
    };
    load();
  }, [weekMonday.getTime(), viewMode, selectedDay.getTime()]);

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
    setIsSubmitting(true);
    setCrudError(null);
    try {
      await createSchedule(input);
      setShowForm(false);
      fetchSchedules(rangeStart, rangeEnd);
    } catch (err) {
      setCrudError('保存失败：' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [rangeStart, rangeEnd]);

  const handleEventClick = useCallback((event: Schedule) => {
    setSelectedEvent(event);
  }, []);

  const handleEventUpdate = useCallback(async (id: string, input: UpdateScheduleInput) => {
    setIsSubmitting(true);
    setCrudError(null);
    try {
      await updateSchedule(id, input);
      setSelectedEvent(null);
      fetchSchedules(rangeStart, rangeEnd);
    } catch (err) {
      setCrudError('更新失败：' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [rangeStart, rangeEnd]);

  const handleEventDelete = useCallback(async (id: string) => {
    setIsSubmitting(true);
    setCrudError(null);
    try {
      await deleteSchedule(id);
      setSelectedEvent(null);
      fetchSchedules(rangeStart, rangeEnd);
    } catch (err) {
      setCrudError('删除失败：' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [rangeStart, rangeEnd]);

  const handleUpdateInstance = useCallback(async (baseId: string, dateStr: string, input: UpdateScheduleInput) => {
    setIsSubmitting(true);
    setCrudError(null);
    try {
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
    } catch (err) {
      setCrudError('保存失败：' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [rangeStart, rangeEnd]);

  const handleDeleteInstance = useCallback(async (baseId: string, dateStr: string) => {
    setIsSubmitting(true);
    setCrudError(null);
    try {
      await addExdate(baseId, dateStr);
      setSelectedEvent(null);
      fetchSchedules(rangeStart, rangeEnd);
    } catch (err) {
      setCrudError('删除失败：' + String(err));
    } finally {
      setIsSubmitting(false);
    }
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
        return;
      }

      // 弹出导入对话框
      setImportEvents(events);
    } catch (err) {
      setImportResult('解析失败：' + String(err));
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
      fetchSchedules(rangeStart, rangeEnd);
    } catch (err) {
      setImportResult('导入失败：' + String(err));
    }
  }, [importEvents, rangeStart, rangeEnd]);

  // 键盘快捷键
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        setShowForm(false);
        setSelectedEvent(null);
        setImportEvents(null);
        setShowCalendarManager(false);
        setShowMoreMenu(false);
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleToday();
      }
      if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleCreateClick();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (viewMode === 'month') handlePrevMonth();
        else if (viewMode === 'day') handlePrevDay();
        else if (viewMode !== 'agenda') handlePrev();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (viewMode === 'month') handleNextMonth();
        else if (viewMode === 'day') handleNextDay();
        else if (viewMode !== 'agenda') handleNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, weekMonday, selectedDay, handlePrev, handleNext, handlePrevMonth, handleNextMonth, handlePrevDay, handleNextDay, handleToday, handleCreateClick]);

  return (
    <PageContainer className="relative">
      <NavBar title="日历" />

      <div className="flex-shrink-0 flex flex-col items-center px-4 sm:px-8 pt-6 pb-4 relative z-10">
        <div className="w-full max-w-[1000px] space-y-3">
          {/* ====== 工具栏：导航 + 视图切换 + 日历过滤 ====== */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* 左侧：日期导航 */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={viewMode === 'agenda' || viewMode === 'countdown' ? undefined : viewMode === 'month' ? handlePrevMonth : viewMode === 'day' ? handlePrevDay : handlePrev}
                  disabled={viewMode === 'agenda' || viewMode === 'countdown'}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                  style={{ backgroundColor: `${withAlpha(appTheme.primary, 0.3)}`, color: appTheme.ink, opacity: viewMode === 'agenda' || viewMode === 'countdown' ? 0.3 : 1 }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <span className="text-sm font-light tracking-wider whitespace-nowrap select-none" style={{ color: appTheme.ink }}>
                  {viewMode === 'agenda'
                    ? '近期'
                    : viewMode === 'countdown'
                      ? '倒数日'
                      : viewMode === 'week'
                        ? formatWeekLabel(weekMonday)
                        : viewMode === 'month'
                          ? `${currentYear}年${currentMonth + 1}月`
                          : `${selectedDay.getMonth() + 1}月${selectedDay.getDate()}日`}
                </span>
                <button
                  onClick={viewMode === 'agenda' || viewMode === 'countdown' ? undefined : viewMode === 'month' ? handleNextMonth : viewMode === 'day' ? handleNextDay : handleNext}
                  disabled={viewMode === 'agenda' || viewMode === 'countdown'}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                  style={{ backgroundColor: `${withAlpha(appTheme.primary, 0.3)}`, color: appTheme.ink, opacity: viewMode === 'agenda' || viewMode === 'countdown' ? 0.3 : 1 }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  onClick={handleToday}
                  disabled={viewMode === 'countdown'}
                  className="ml-1 px-3 py-1 rounded-full text-xs font-light transition-colors flex-shrink-0"
                  style={{ backgroundColor: `${withAlpha(appTheme.primary, 0.3)}`, color: appTheme.ink, opacity: viewMode === 'countdown' ? 0.3 : 1 }}
                >
                  今天
                </button>
              </div>

              {/* 中间：视图切换 pills */}
              <div className="flex items-center gap-0.5 rounded-full p-0.5 flex-shrink-0" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.05)}` }}>
                {(['day', 'week', 'month', 'agenda', 'countdown'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className="px-2.5 py-1 rounded-full text-xs transition-all"
                    style={{
                      backgroundColor: viewMode === mode ? appTheme.primary : 'transparent',
                      color: viewMode === mode ? appTheme.ink : appTheme.inkMuted48,
                    }}
                  >
                    {mode === 'day' ? '日' : mode === 'week' ? '周' : mode === 'month' ? '月' : mode === 'agenda' ? '近期' : '倒数日'}
                  </button>
                ))}
              </div>

              {/* 右侧：日历过滤 + 更多 */}
              <div className="flex items-center gap-1.5 ml-auto">
                {/* 日历过滤 pills */}
                {calendars.length > 0 ? (
                  <div className="flex items-center gap-1 overflow-x-auto min-w-0" style={{ scrollbarWidth: 'none' }}>
                    {calendars.map((cal) => {
                      const isVisible = visibleCalendarIds.has(cal.id);
                      return (
                        <button
                          key={cal.id}
                          onClick={() => { toggleCalendar(cal.id); fetchSchedules(rangeStart, rangeEnd); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-light transition-all whitespace-nowrap"
                          style={{
                            backgroundColor: isVisible ? `${withAlpha(cal.color, 0.1)}` : `${withAlpha(appTheme.ink, 0.05)}`,
                            color: isVisible ? cal.color : appTheme.inkMuted48,
                            border: `1px solid ${isVisible ? withAlpha(cal.color, 0.2) : withAlpha(appTheme.ink, 0.03)}`,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: isVisible ? cal.color : `${withAlpha(appTheme.ink, 0.2)}` }}
                          />
                          {cal.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCalendarManager(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors whitespace-nowrap"
                    style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.05)}`, color: appTheme.inkMuted48 }}
                  >
                    <Plus size={12} strokeWidth={1.5} />
                    新建日历
                  </button>
                )}

                {/* 更多菜单 */}
                <div className="relative flex-shrink-0 z-10">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      color: showMoreMenu ? appTheme.ink : `${withAlpha(appTheme.ink, 0.4)}`,
                      backgroundColor: showMoreMenu ? `${withAlpha(appTheme.ink, 0.08)}` : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (!showMoreMenu) e.currentTarget.style.color = appTheme.ink; }}
                    onMouseLeave={(e) => { if (!showMoreMenu) e.currentTarget.style.color = `${withAlpha(appTheme.ink, 0.4)}`; }}
                  >
                    <MoreHorizontal size={15} strokeWidth={1.5} />
                  </button>
                  {showMoreMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                      <div
                        className="absolute right-0 top-full mt-1.5 rounded-xl p-1.5 min-w-[130px] z-50"
                        style={{
                          backgroundColor: appTheme.canvasParchment,
                          border: `1px solid ${withAlpha(appTheme.ink, 0.12)}`,
                          boxShadow: `0 8px 24px ${withAlpha('#000000', 0.4)}`,
                        }}
                      >
                        <button
                          onClick={() => { handleImportIcs(); setShowMoreMenu(false); }}
                          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-colors"
                          style={{ color: appTheme.inkMuted80 }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${withAlpha(appTheme.ink, 0.06)}`)}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <Upload size={13} strokeWidth={1.5} />
                          导入 ICS
                        </button>
                        <button
                          onClick={() => { setShowCalendarManager(true); setShowMoreMenu(false); }}
                          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-colors"
                          style={{ color: appTheme.inkMuted80 }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${withAlpha(appTheme.ink, 0.06)}`)}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <Settings size={13} strokeWidth={1.5} />
                          管理日历
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

          {(importResult || error || crudError) && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm"
              style={{
                backgroundColor: (error || crudError) ? 'rgba(239,68,68,0.3)' : `${withAlpha(appTheme.ink, 0.06)}`,
                border: `1px solid ${(error || crudError) ? 'rgba(239,68,68,0.3)' : withAlpha(appTheme.ink, 0.1)}`,
                color: (error || crudError) ? 'rgb(254,202,202)' : appTheme.ink,
              }}
            >
              <span className="flex-1 text-center">{error || crudError || importResult}</span>
              <button
                onClick={() => { setImportResult(null); setCrudError(null); }}
                className="flex-shrink-0 p-0.5 rounded-full transition-colors hover:opacity-70"
                style={{ color: 'inherit' }}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col items-center px-4 sm:px-8 pb-4 relative schedule-scroll">
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
              schedules={filteredSchedules}
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
          isSubmitting={isSubmitting}
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
          isSubmitting={isSubmitting}
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
          className="fixed bottom-[72px] right-8 z-30 w-14 h-14 rounded-full text-white active:scale-95 transition-all flex items-center justify-center firefly-breath"
          style={{ backgroundColor: appTheme.primary }}
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}
    </PageContainer>
  );
}
