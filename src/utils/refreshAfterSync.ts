/**
 * 同步完成后刷新所有数据 store
 * 使用动态导入避免循环依赖
 */
export async function refreshAllStores() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 先加载日历表，确保 schedule 过滤时 visibleCalendarIds 已就绪
  // （避免 fetchSchedules 先完成导致带 calendar_id 的日程被过滤掉）
  await import('@/stores/calendarStore').then(m => m.useCalendarStore.getState().fetchCalendars()).catch((e: unknown) => console.error('[refreshAfterSync] calendarStore', e));
  await import('@/stores/settingStore').then(m => m.useSettingStore.getState().loadAll()).catch((e: unknown) => console.error('[refreshAfterSync] settingStore', e));

  // 并行刷新其余 store
  const tasks = [
    import('@/stores/taskStore').then(m => m.useTaskStore.getState().fetchTasks()).catch((e: unknown) => console.error('[refreshAfterSync] taskStore', e)),
    import('@/stores/scheduleStore').then(m => {
      const store = m.useScheduleStore.getState();
      const start = new Date(year, month - 1, 1).toISOString();
      const end = new Date(year, month, 0, 23, 59, 59).toISOString();
      store.fetchSchedules(start, end);
      store.fetchCountdowns();
    }).catch((e: unknown) => console.error('[refreshAfterSync] scheduleStore', e)),
    import('@/stores/journalStore').then(m => m.useJournalStore.getState().fetchTimelineEntries(year, month)).catch((e: unknown) => console.error('[refreshAfterSync] journalStore', e)),
    import('@/stores/contactStore').then(m => m.useContactStore.getState().fetchContacts()).catch((e: unknown) => console.error('[refreshAfterSync] contactStore', e)),
    import('@/stores/skillStore').then(m => {
      const store = m.useSkillStore.getState();
      store.fetchSkills();
      store.fetchActivity();
    }).catch((e: unknown) => console.error('[refreshAfterSync] skillStore', e)),
    import('@/stores/habitStore').then(m => m.useHabitStore.getState().fetchAll()).catch((e: unknown) => console.error('[refreshAfterSync] habitStore', e)),
  ];

  await Promise.allSettled(tasks);
}
