/**
 * 同步完成后刷新所有数据 store
 * 使用动态导入避免循环依赖
 */
export async function refreshAllStores() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 并行刷新所有 store
  const tasks = [
    import('@/stores/taskStore').then(m => m.useTaskStore.getState().fetchTasks()).catch(() => {}),
    import('@/stores/scheduleStore').then(m => {
      const store = m.useScheduleStore.getState();
      const start = new Date(year, month - 1, 1).toISOString();
      const end = new Date(year, month, 0, 23, 59, 59).toISOString();
      store.fetchSchedules(start, end);
      store.fetchCountdowns();
    }).catch(() => {}),
    import('@/stores/journalStore').then(m => m.useJournalStore.getState().fetchTimelineEntries(year, month)).catch(() => {}),
    import('@/stores/contactStore').then(m => m.useContactStore.getState().fetchContacts()).catch(() => {}),
    import('@/stores/skillStore').then(m => {
      const store = m.useSkillStore.getState();
      store.fetchSkills();
      store.fetchActivity();
    }).catch(() => {}),
    import('@/stores/calendarStore').then(m => m.useCalendarStore.getState().fetchCalendars()).catch(() => {}),
    import('@/stores/habitStore').then(m => m.useHabitStore.getState().fetchAll()).catch(() => {}),
    import('@/stores/settingStore').then(m => m.useSettingStore.getState().loadAll()).catch(() => {}),
  ];

  await Promise.allSettled(tasks);
}
