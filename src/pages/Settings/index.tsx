import { useEffect, useState } from 'react';
import { NavBar } from '@/components/ui';
import { useSettingStore } from '@/stores/settingStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useAppTheme, useThemeMode, useThemeHelpers, withAlpha } from '@/stores/themeStore';
import { PageContainer } from '@/components/layout';
import { BUILTIN_PROMPTS } from '@/utils/builtinPrompts';
import type { PromptTemplate } from '@/utils/builtinPrompts';
import { Plus, Pencil, Trash2, X, Check, Download, AlertTriangle, RefreshCw } from 'lucide-react';
import * as scheduleService from '@/services/scheduleService';
import { useSyncStore } from '@/stores/syncStore';
import { invoke } from '@tauri-apps/api/core';
import { Select } from '@/components/ui/Select';
import { Section, ToggleRow, InputRow, PluginSection, type SettingsStyles } from './components';
import { SyncSection, AiSection } from './sections';

export function SettingsPage() {
  const appTheme = useAppTheme();
  const { rgba } = useThemeHelpers();
  const s: SettingsStyles = {
    card: appTheme.canvas,
    cardBorder: appTheme.hairline,
    text: appTheme.ink,
    textSub: rgba(0.6),
    accent: appTheme.primary,
    accentDim: rgba(0.2),
    danger: appTheme.danger,
    dangerDim: rgba(0.12),
    inputBg: rgba(0.04),
    inputBorder: rgba(0.2),
    overlay: (opacity: number) => rgba(opacity),
  };
  const { mode, setMode } = useThemeMode();
  const settings = useSettingStore();
  const { calendars, fetchCalendars } = useCalendarStore();
  const syncStore = useSyncStore();
  const [appVersion, setAppVersion] = useState('…');

  // Accordion
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['appearance']));

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // 导出对话框
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportCalendarId, setExportCalendarId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // 清除数据对话框
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearCategories, setClearCategories] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 自定义锦囊
  const [customPrompts, setCustomPrompts] = useState<PromptTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', prompt: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', prompt: '' });
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const calendarId = exportCalendarId ?? undefined;
      const icsContent = await scheduleService.exportIcsEvents(calendarId);
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const calSuffix = calendarId ? `_${calendars.find((c) => c.id === calendarId)?.name || calendarId}` : '';
      a.download = `schedule_export${calSuffix}_${new Date().toISOString().slice(0, 10)}.ics`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      setExportMessage('导出成功，文件已保存到下载文件夹');
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err) {
      setExportMessage('导出失败：' + String(err));
      setTimeout(() => setExportMessage(null), 4000);
    }
  };

  const handleClear = async () => {
    if (clearCategories.size === 0) return;
    try {
      const cats = Array.from(clearCategories);
      const msg: string = await invoke('clear_data', { categories: cats });
      setClearCategories(new Set());
      setShowClearDialog(false);
      settings.loadAll();
      setToast({ message: msg, type: 'success' });
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setShowClearDialog(false);
      setToast({ message: '清除失败：' + String(err), type: 'error' });
      setTimeout(() => setToast(null), 4000);
    }
  };

  const clearOptions = [
    { id: 'tasks', label: '任务', description: '所有任务、子任务及关联数据' },
    { id: 'schedules', label: '日程', description: '所有日程安排' },
    { id: 'contacts', label: '人脉', description: '所有联系人及联系方式' },
    { id: 'journals', label: '日记', description: '用户自己写的日记正文（.md 文件）' },
    { id: 'ai_diary', label: 'AI提灯总结', description: 'AI 生成的提灯总结和尘笺' },
    { id: 'skills', label: '技能', description: '所有属性和经验记录' },
    { id: 'ai_conversations', label: 'AI对话', description: '所有提灯对话历史' },
    { id: 'ai_favorites', label: '收藏夹', description: '所有收藏的AI对话内容' },
    { id: 'pomodoro', label: '番茄钟', description: '所有番茄钟专注记录' },
    { id: 'settings', label: '设置', description: '所有自定义设置和配置' },
  ];

  useEffect(() => {
    settings.loadAll();
    fetchCalendars();
    syncStore.loadStatus();
    import('@tauri-apps/api/app').then(({ getVersion }) => getVersion()).then(setAppVersion).catch((e) => console.error('[Settings] Failed to get app version:', e));
  }, []);

  useEffect(() => {
    loadCustomPrompts();
  }, []);

  const get = (key: string, fallback = '') => settings.get(key, fallback);
  const set = (key: string, value: string) => settings.set(key, value);

  const loadCustomPrompts = () => {
    try {
      const raw = localStorage.getItem('lantern_custom_prompts');
      if (raw) {
        setCustomPrompts(JSON.parse(raw));
      } else {
        // 首次加载：用内置锦囊初始化
        const seed = BUILTIN_PROMPTS.map((p, i) => ({ ...p, sort_order: i + 1 }));
        localStorage.setItem('lantern_custom_prompts', JSON.stringify(seed));
        setCustomPrompts(seed);
      }
    } catch { /* ignore */ }
  };

  const persistCustomPrompts = (prompts: PromptTemplate[]) => {
    localStorage.setItem('lantern_custom_prompts', JSON.stringify(prompts));
    setCustomPrompts(prompts);
  };

  const handleRestoreDefaults = () => {
    const defaults = BUILTIN_PROMPTS.map((p, i) => ({ ...p, sort_order: i + 1 }));
    persistCustomPrompts(defaults);
    setEditingId(null);
    setIsAdding(false);
    setToast({ message: '已恢复默认快捷发送', type: 'success' });
    setTimeout(() => setToast(null), 2500);
  };

  const handleDeleteCustom = (id: string) => {
    persistCustomPrompts(customPrompts.filter((p) => p.id !== id));
  };

  const handleStartEdit = (p: PromptTemplate) => {
    setEditingId(p.id);
    setEditForm({ title: p.title, prompt: p.prompt });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    persistCustomPrompts(
      customPrompts.map((p) =>
        p.id === editingId ? { ...p, title: editForm.title, prompt: editForm.prompt } : p,
      ),
    );
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!addForm.title.trim() || !addForm.prompt.trim()) return;
    const nextOrder = customPrompts.length > 0
      ? Math.max(...customPrompts.map((p) => p.sort_order)) + 1
      : 1;
    const newPrompt: PromptTemplate = {
      id: `custom_${Date.now()}`,
      title: addForm.title.trim(),
      prompt: addForm.prompt.trim(),
      builtin: false,
      sort_order: nextOrder,
    };
    persistCustomPrompts([...customPrompts, newPrompt]);
    setAddForm({ title: '', prompt: '' });
    setIsAdding(false);
  };

  return (
    <PageContainer className="relative flex flex-col" bgColor={appTheme.canvasParchment}>
      <NavBar title="设置" />

      {/* ========== 主内容 ========== */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 sm:px-8 pt-6 pb-8" style={{ '--focus-color': s.accent, '--focus-ring': s.accentDim } as React.CSSProperties}>
        <div className="w-full max-w-[800px] space-y-5">

          {/* ===== 外观 ===== */}
          <Section sectionKey="appearance" title="外观" styles={s} expanded={openSections.has('appearance')} onToggle={() => toggleSection('appearance')}>
            <div className="flex items-center justify-between">
              <span className="text-base" style={{ color: s.textSub }}>主题模式</span>
              <div className="flex rounded-full p-0.5" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.05)}` }}>
                {([
                  { id: 'light' as const, label: '浅色' },
                  { id: 'dark' as const, label: '深色' },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setMode(opt.id)}
                    className="px-4 py-1.5 rounded-full text-sm transition-all"
                    style={{
                      backgroundColor: mode === opt.id ? appTheme.canvas : 'transparent',
                      color: mode === opt.id ? appTheme.ink : `${withAlpha(appTheme.ink, 0.5)}`,
                      boxShadow: mode === opt.id ? `0 0 0 0.5px ${appTheme.hairline}` : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* ===== 通知设置 ===== */}
          <Section sectionKey="notifications" title="通知设置" styles={s} expanded={openSections.has('notifications')} onToggle={() => toggleSection('notifications')}>
            <ToggleRow
              label="任务提醒"
              checked={get('notification.task_reminder') === 'true'}
              onChange={(v) => set('notification.task_reminder', String(v))}
              styles={s}
            />
            <ToggleRow
              label="关系维护提醒"
              checked={get('notification.contact_reminder') === 'true'}
              onChange={(v) => set('notification.contact_reminder', String(v))}
              styles={s}
            />
          </Section>

          {/* ===== 番茄钟设置 ===== */}
          <Section sectionKey="pomodoro" title="番茄钟" styles={s} expanded={openSections.has('pomodoro')} onToggle={() => toggleSection('pomodoro')}>
            <InputRow
              label="专注时长（分钟）"
              value={get('pomodoro_focus_minutes', '25')}
              type="number"
              onChange={(v) => set('pomodoro_focus_minutes', v)}
              styles={s}
            />
            <InputRow
              label="短休息时长（分钟）"
              value={get('pomodoro_break_minutes', '5')}
              type="number"
              onChange={(v) => set('pomodoro_break_minutes', v)}
              styles={s}
            />
            <InputRow
              label="长休息时长（分钟）"
              value={get('pomodoro_long_break_minutes', '15')}
              type="number"
              onChange={(v) => set('pomodoro_long_break_minutes', v)}
              styles={s}
            />
            <ToggleRow
              label="专注结束后自动开始休息"
              checked={get('pomodoro_auto_start_break') === 'true'}
              onChange={(v) => set('pomodoro_auto_start_break', String(v))}
              styles={s}
            />
          </Section>

          {/* ===== AI 助手设置 ===== */}
          <AiSection styles={s} expanded={openSections.has('ai')} onToggle={() => toggleSection('ai')} />

          {/* ===== 快捷发送 ===== */}
          <Section sectionKey="prompts" title="快捷发送" styles={s} expanded={openSections.has('prompts')} onToggle={() => toggleSection('prompts')}>
            <p className="text-sm mb-4" style={{ color: s.textSub }}>
              发送给 AI 的快捷提示词，点击即可自动发送
            </p>

            <div>
              {customPrompts.length === 0 && !isAdding ? (
                <p className="text-xs mb-3" style={{ color: s.overlay(0.38) }}>暂无快捷发送</p>
              ) : (
                <div className="space-y-1.5 mb-3">
                  {customPrompts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{ backgroundColor: s.inputBg, border: `1px solid ${s.inputBorder}` }}
                    >
                      {editingId === p.id ? (
                        /* 编辑模式 */
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            placeholder="标题"
                            className="w-full px-2 py-1 rounded text-sm outline-none settings-input"
                            style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                          />
                          <textarea
                            value={editForm.prompt}
                            onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                            placeholder="提示词内容"
                            rows={2}
                            className="w-full px-2 py-1 rounded text-sm outline-none resize-none settings-input"
                            style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleSaveEdit}
                              className="flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors"
                              style={{ backgroundColor: s.accentDim, color: s.accent }}
                            >
                              <Check size={12} /> 保存
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors"
                              style={{ backgroundColor: 'transparent', color: s.textSub }}
                            >
                              <X size={12} /> 取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* 显示模式 */
                        <>
                          <span className="text-sm w-20 flex-shrink-0" style={{ color: s.text }}>{p.title}</span>
                          <span className="text-xs truncate flex-1" style={{ color: s.overlay(0.4) }}>{p.prompt}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleStartEdit(p)}
                              className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                              style={{ color: s.overlay(0.3) }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = s.overlay(0.1))}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={() => setDeleteTargetId(p.id)}
                              className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                              style={{ color: s.overlay(0.3) }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = s.overlay(0.1))}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 添加表单 */}
              {isAdding ? (
                <div
                  className="px-3 py-3 rounded-lg space-y-2"
                  style={{ backgroundColor: s.inputBg, border: `1px solid ${s.accent}` }}
                >
                  <input
                    type="text"
                    value={addForm.title}
                    onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                    placeholder="标题"
                    className="w-full px-2 py-1 rounded text-sm outline-none settings-input"
                    style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                  />
                  <textarea
                    value={addForm.prompt}
                    onChange={(e) => setAddForm({ ...addForm, prompt: e.target.value })}
                    placeholder="提示词内容（发送给 AI 的完整提示）"
                    rows={2}
                    className="w-full px-2 py-1 rounded text-sm outline-none resize-none settings-input"
                    style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAdd}
                      disabled={!addForm.title.trim() || !addForm.prompt.trim()}
                      className="flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors disabled:opacity-40"
                      style={{ backgroundColor: s.accent, color: appTheme.onPrimary }}
                    >
                      <Check size={12} /> 添加
                    </button>
                    <button
                      onClick={() => { setIsAdding(false); setAddForm({ title: '', prompt: '' }); }}
                      className="flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors"
                      style={{ backgroundColor: 'transparent', color: s.textSub }}
                    >
                      <X size={12} /> 取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ backgroundColor: s.inputBg, color: s.accent, border: `1px dashed ${withAlpha(s.accent, 0.25)}` }}
                >
                  <Plus size={14} /> 添加快捷发送
                </button>
              )}
            </div>

            <div className="pt-3 border-t" style={{ borderColor: s.cardBorder }}>
              <button
                onClick={handleRestoreDefaults}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ color: s.textSub, backgroundColor: s.overlay(0.04) }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = s.overlay(0.1))}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = s.overlay(0.04))}
              >
                <RefreshCw size={13} /> 恢复默认
              </button>
            </div>
          </Section>

          {/* ===== 数据同步 ===== */}
          <SyncSection styles={s} expanded={openSections.has('sync')} onToggle={() => toggleSection('sync')} />

          {/* ===== 数据管理 ===== */}
          <Section sectionKey="data" title="数据管理" styles={s} expanded={openSections.has('data')} onToggle={() => toggleSection('data')}>
            <button
              onClick={() => setShowExportDialog(true)}
              className="w-full py-3 px-4 rounded-xl text-base font-medium transition-colors"
              style={{ backgroundColor: s.accentDim, color: s.accent }}
            >
              导出数据
            </button>
            <button
              onClick={() => { setClearCategories(new Set()); setShowClearDialog(true); }}
              className="w-full py-2.5 px-4 rounded-xl text-sm transition-colors"
              style={{ backgroundColor: 'transparent', color: s.danger, border: `1px solid ${withAlpha(s.danger, 0.25)}` }}
            >
              清除数据
            </button>
          </Section>

          {/* ===== 插件管理 ===== */}
          <Section sectionKey="plugins" title="插件" styles={s} expanded={openSections.has('plugins')} onToggle={() => toggleSection('plugins')}>
            <PluginSection styles={s} />
          </Section>

          {/* 版本信息 */}
          <div className="text-center pt-6 pb-4">
            <span className="text-sm" style={{ color: s.textSub }}>提灯 v{appVersion}</span>
          </div>
        </div>
      </div>
      {/* ===== 导出对话框 ===== */}
      {showExportDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowExportDialog(false)}
        >
          <div
            className="rounded-[18px] p-6 w-[95vw] sm:w-[420px]"
            style={{ backgroundColor: s.card }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-medium mb-5" style={{ color: s.text }}>
              导出数据
            </h2>

            <div className="space-y-4">
              {/* 导出日程 */}
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: s.overlay(0.04), border: `1px solid ${s.cardBorder}` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Download size={16} style={{ color: s.accent }} />
                  <span className="text-sm font-medium" style={{ color: s.text }}>导出日程</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs" style={{ color: s.textSub }}>日历：</span>
                  <Select
                    value={exportCalendarId ?? ''}
                    onChange={(v) => setExportCalendarId(v || null)}
                    placeholder="全部日程"
                    options={[
                      { value: '', label: '全部日程' },
                      ...calendars.map((cal) => ({ value: cal.id, label: cal.name })),
                    ]}
                  />
                </div>
                <button
                  onClick={handleExport}
                  className="w-full py-2 rounded-lg text-sm transition-colors"
                  style={{ backgroundColor: s.accentDim, color: s.accent }}
                >
                  导出 ICS 文件
                </button>
              </div>
            </div>

            {/* 导出结果提示 */}
            {exportMessage && (
              <div
                className="mt-4 px-4 py-2 rounded-full text-sm text-center"
                style={{
                  backgroundColor: exportMessage.startsWith('导出成功') ? s.accentDim : s.dangerDim,
                  color: exportMessage.startsWith('导出成功') ? s.accent : s.danger,
                }}
              >
                {exportMessage}
              </div>
            )}

            {/* 关闭按钮 */}
            <button
              onClick={() => setShowExportDialog(false)}
              className="w-full mt-4 py-2.5 rounded-full text-sm transition-colors"
              style={{ color: s.text, backgroundColor: s.overlay(0.06) }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = s.overlay(0.12))}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = s.overlay(0.06))}
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* ===== 清除数据对话框 ===== */}
      {showClearDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowClearDialog(false)}
        >
          <div
            className="rounded-[18px] p-5 w-[95vw] sm:w-[380px] max-h-[85vh] flex flex-col"
            style={{ backgroundColor: s.card }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1 flex-shrink-0">
              <AlertTriangle size={16} style={{ color: s.danger }} />
              <h2 className="text-base font-medium" style={{ color: s.text }}>
                清除数据
              </h2>
            </div>
            <p className="text-xs mb-3 flex-shrink-0" style={{ color: s.textSub }}>
              选择要清除的数据类型。此操作不可撤销，建议先导出备份。
            </p>

            <div className="space-y-1.5 mb-4 overflow-y-auto flex-1" style={{ maxHeight: 280 }}>
              {clearOptions.map((opt) => {
                const isSelected = clearCategories.has(opt.id);
                return (
                  <label
                    key={opt.id}
                    className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: isSelected ? s.dangerDim : s.overlay(0.04),
                      border: `1px solid ${isSelected ? s.danger : s.cardBorder}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setClearCategories((prev) => {
                          const next = new Set(prev);
                          if (next.has(opt.id)) next.delete(opt.id); else next.add(opt.id);
                          return next;
                        });
                      }}
                      className="mt-0.5 flex-shrink-0"
                      style={{ accentColor: s.danger }}
                    />
                    <div>
                      <div className="text-sm font-medium" style={{ color: isSelected ? s.danger : s.text }}>{opt.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: s.textSub }}>{opt.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setShowClearDialog(false)}
                className="flex-1 py-2 rounded-full text-sm transition-colors"
                style={{ color: s.textSub }}
              >
                取消
              </button>
              <button
                onClick={handleClear}
                disabled={clearCategories.size === 0}
                className="flex-1 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-30"
                style={{
                  backgroundColor: clearCategories.size > 0 ? s.danger : s.dangerDim,
                  color: clearCategories.size > 0 ? appTheme.onPrimary : s.danger,
                }}
              >
                {clearCategories.size > 0
                  ? `确认清除（${clearCategories.size} 项）`
                  : '请选择要清除的数据'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 删除锦囊确认 ===== */}
      {deleteTargetId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            className="rounded-[18px] p-6 mx-4 w-[90vw] sm:w-[320px]"
            style={{ backgroundColor: s.card }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base mb-6" style={{ color: s.text }}>确定要删除这个锦囊吗？删除后无法恢复。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2.5 rounded-2xl text-sm transition-colors"
                style={{ color: s.textSub, backgroundColor: s.overlay(0.06) }}
              >
                取消
              </button>
              <button
                onClick={() => { handleDeleteCustom(deleteTargetId); setDeleteTargetId(null); }}
                className="flex-1 py-2.5 rounded-2xl text-sm transition-colors"
                style={{ backgroundColor: s.danger, color: '#fff' }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Toast 提示 ===== */}
      {toast && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
        >
          <div
            className="px-5 py-3 rounded-full text-sm"
            style={{
              backgroundColor: toast.type === 'success' ? s.accentDim : s.dangerDim,
              color: toast.type === 'success' ? s.accent : s.danger,
            }}
          >
            {toast.message}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

