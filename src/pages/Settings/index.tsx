import { useEffect, useState } from 'react';
import { NavBar } from '@/components/ui';
import { useSettingStore } from '@/stores/settingStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useAppTheme, useThemeMode, useThemeHelpers, withAlpha } from '@/stores/themeStore';
import { PageContainer } from '@/components/layout';
import { BUILTIN_PROMPTS } from '@/utils/builtinPrompts';
import type { PromptTemplate } from '@/utils/builtinPrompts';
import { Plus, Pencil, Trash2, X, Check, Download, AlertTriangle, Cloud, Loader2, RefreshCw, Wifi, WifiOff, Cpu, Zap } from 'lucide-react';
import * as scheduleService from '@/services/scheduleService';
import * as aiService from '@/services/aiService';
import { useSyncStore } from '@/stores/syncStore';
import { invoke } from '@tauri-apps/api/core';
import * as syncService from '@/services/syncService';
import { SyncProgress } from '@/components/sync';
import { Select } from '@/components/ui/Select';
import { Section, ToggleRow, InputRow, SelectRow, PluginSection, formatBytes, type SettingsStyles } from './components';

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

  // 同步表单
  const [syncStorageType, setSyncStorageType] = useState<'webdav' | 'oss'>('webdav');
  const [syncFormUrl, setSyncFormUrl] = useState('');
  const [syncFormUser, setSyncFormUser] = useState('');
  const [syncFormPass, setSyncFormPass] = useState('');
  const [ossAccessKeyId, setOssAccessKeyId] = useState('');
  const [ossAccessKeySecret, setOssAccessKeySecret] = useState('');
  const [ossBucket, setOssBucket] = useState('');
  const [ossRegion, setOssRegion] = useState('');
  const [syncTestResult, setSyncTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [syncTesting, setSyncTesting] = useState(false);

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

  // AI 供应商管理
  interface AiProvider { id: string; name: string; url: string; key: string; }
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [providerForm, setProviderForm] = useState({ name: '', url: '', key: '' });
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testingProvider, setTestingProvider] = useState(false);

  const handleTestConnection = async () => {
    if (syncStorageType === 'oss') {
      if (!ossAccessKeyId || !ossAccessKeySecret || !ossBucket || !ossRegion) {
        setSyncTestResult({ ok: false, msg: '请填写完整的 OSS 配置' });
        return;
      }
    } else {
      if (!syncFormUrl || !syncFormUser || !syncFormPass) {
        setSyncTestResult({ ok: false, msg: '请填写完整的 WebDAV 配置' });
        return;
      }
    }
    setSyncTesting(true);
    setSyncTestResult(null);
    try {
      // 先保存配置
      await settings.set('sync.storage_type', syncStorageType);
      await settings.set('sync.url', syncFormUrl);
      await settings.set('sync.username', syncFormUser);
      await settings.set('sync.password', syncFormPass);
      await settings.set('sync.oss.access_key_id', ossAccessKeyId);
      await settings.set('sync.oss.access_key_secret', ossAccessKeySecret);
      await settings.set('sync.oss.bucket', ossBucket);
      await settings.set('sync.oss.region', ossRegion);
      const msg = await syncStore.testConnection({
        storageType: syncStorageType,
        url: syncFormUrl,
        username: syncFormUser,
        password: syncFormPass,
        ossAccessKeyId,
        ossAccessKeySecret,
        ossBucket,
        ossRegion,
      });
      setSyncTestResult({ ok: true, msg });
    } catch (e) {
      setSyncTestResult({ ok: false, msg: String(e) });
    } finally {
      setSyncTesting(false);
    }
  };

  const handleSyncNow = async () => {
    // 保存当前配置
    await settings.set('sync.storage_type', syncStorageType);
    await settings.set('sync.url', syncFormUrl);
    await settings.set('sync.username', syncFormUser);
    await settings.set('sync.password', syncFormPass);
    await settings.set('sync.oss.access_key_id', ossAccessKeyId);
    await settings.set('sync.oss.access_key_secret', ossAccessKeySecret);
    await settings.set('sync.oss.bucket', ossBucket);
    await settings.set('sync.oss.region', ossRegion);
    await syncService.setSyncEnabled(true);
    await syncStore.syncNow();
  };

  const handleSaveSyncConfig = async () => {
    await settings.set('sync.storage_type', syncStorageType);
    await settings.set('sync.url', syncFormUrl);
    await settings.set('sync.username', syncFormUser);
    await settings.set('sync.password', syncFormPass);
    await settings.set('sync.oss.access_key_id', ossAccessKeyId);
    await settings.set('sync.oss.access_key_secret', ossAccessKeySecret);
    await settings.set('sync.oss.bucket', ossBucket);
    await settings.set('sync.oss.region', ossRegion);
    setSyncTestResult({ ok: true, msg: '配置已保存' });
    setTimeout(() => setSyncTestResult(null), 2000);
  };

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

  // 同步表单从 settings 初始化
  useEffect(() => {
    if (settings.loaded) {
      setSyncStorageType((settings.get('sync.storage_type', 'webdav') as 'webdav' | 'oss'));
      setSyncFormUrl(settings.get('sync.url', 'https://dav.jianguoyun.com/dav/'));
      setSyncFormUser(settings.get('sync.username', ''));
      setSyncFormPass(settings.get('sync.password', ''));
      setOssAccessKeyId(settings.get('sync.oss.access_key_id', ''));
      setOssAccessKeySecret(settings.get('sync.oss.access_key_secret', ''));
      setOssBucket(settings.get('sync.oss.bucket', ''));
      setOssRegion(settings.get('sync.oss.region', ''));
    }
  }, [settings.loaded]);

  // AI 供应商从 settings 加载
  useEffect(() => {
    if (settings.loaded) {
      try {
        const raw = settings.get('ai.providers', '[]');
        const list: AiProvider[] = JSON.parse(raw);
        setProviders(list);
      } catch { setProviders([]); }
    }
  }, [settings.loaded]);

  const saveProviders = async (list: AiProvider[]) => {
    setProviders(list);
    await settings.set('ai.providers', JSON.stringify(list));
  };

  const handleTestAiConnection = async (url: string, key: string, model: string) => {
    if (!url.trim() || !model.trim()) {
      setTestResult({ ok: false, msg: '请填写 API 地址和模型名称' });
      return;
    }
    setTestingProvider(true);
    setTestResult(null);
    try {
      const msg = await aiService.testConnection(url.trim(), key.trim(), model.trim());
      setTestResult({ ok: true, msg });
    } catch (e) {
      setTestResult({ ok: false, msg: String(e) });
    } finally {
      setTestingProvider(false);
    }
  };

  /** 根据供应商 id 解析出 URL/Key，写入后端使用的 ai.api_url / ai.api_key */
  const resolveAndSaveProviderKeys = async (providerId: string, model: string, prefix: 'ai' | 'ai.vision') => {
    const p = providers.find(p => p.id === providerId);
    if (prefix === 'ai') {
      await settings.set('ai.api_url', p?.url || '');
      await settings.set('ai.api_key', p?.key || '');
      await settings.set('ai.model', model);
      await settings.set('ai.primary_provider', providerId);
    } else {
      // 视觉模型的 URL/Key 也写入 ai.vision_api_url / ai.vision_api_key
      await settings.set('ai.vision_api_url', p?.url || '');
      await settings.set('ai.vision_api_key', p?.key || '');
      await settings.set('ai.vision_model', model);
      await settings.set('ai.vision_provider', providerId);
    }
  };

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
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 sm:px-8 pt-6 pb-8">
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
          <Section sectionKey="ai" title="AI 助手设置" styles={s} expanded={openSections.has('ai')} onToggle={() => toggleSection('ai')}>

            {/* ── 供应商管理 ── */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium" style={{ color: s.text }}>API 供应商</label>
                {!isAddingProvider && (
                  <button
                    onClick={() => {
                      setIsAddingProvider(true);
                      setProviderForm({ name: '', url: '', key: '' });
                    }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                    style={{ color: s.accent }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = s.accentDim; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <Plus size={14} /> 添加
                  </button>
                )}
              </div>

              {/* 供应商列表 */}
              {providers.length === 0 && !isAddingProvider && (
                <p className="text-xs py-3 text-center" style={{ color: s.overlay(0.38) }}>
                  还没有配置供应商，点击"添加"开始
                </p>
              )}

              <div className="space-y-2">
                {providers.map((p) => (
                  <div
                    key={p.id}
                    className="px-3 py-2.5 rounded-lg"
                    style={{ backgroundColor: s.inputBg, border: `1px solid ${s.inputBorder}` }}
                  >
                    {editingProviderId === p.id ? (
                      /* 编辑模式 */
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={providerForm.name}
                          onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                          placeholder="名称（如 DeepSeek）"
                          className="w-full px-2 py-1.5 rounded text-sm outline-none"
                          style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                        />
                        <input
                          type="text"
                          value={providerForm.url}
                          onChange={(e) => setProviderForm({ ...providerForm, url: e.target.value })}
                          placeholder="API 地址"
                          className="w-full px-2 py-1.5 rounded text-sm outline-none"
                          style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                        />
                        <input
                          type="password"
                          value={providerForm.key}
                          onChange={(e) => setProviderForm({ ...providerForm, key: e.target.value })}
                          placeholder="API Key"
                          className="w-full px-2 py-1.5 rounded text-sm outline-none"
                          style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setEditingProviderId(null)}
                            className="p-1.5 rounded-lg"
                            style={{ color: s.overlay(0.5) }}
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={async () => {
                              const updated = providers.map(x =>
                                x.id === p.id ? { ...x, name: providerForm.name, url: providerForm.url, key: providerForm.key } : x
                              );
                              await saveProviders(updated);
                              // 如果正在被主模型或视觉模型使用，同步更新
                              if (get('ai.primary_provider') === p.id) {
                                await resolveAndSaveProviderKeys(p.id, get('ai.model', ''), 'ai');
                              }
                              if (get('ai.vision_provider') === p.id) {
                                await resolveAndSaveProviderKeys(p.id, get('ai.vision_model', ''), 'ai.vision');
                              }
                              setEditingProviderId(null);
                            }}
                            className="p-1.5 rounded-lg"
                            style={{ color: s.accent }}
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* 展示模式 */
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: s.text }}>{p.name}</div>
                          <div className="text-xs truncate" style={{ color: s.overlay(0.4) }}>{p.url}</div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => {
                              setEditingProviderId(p.id);
                              setProviderForm({ name: p.name, url: p.url, key: p.key });
                            }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: s.overlay(0.4) }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = s.text; e.currentTarget.style.backgroundColor = s.overlay(0.08); }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = s.overlay(0.4); e.currentTarget.style.backgroundColor = 'transparent'; }}
                            title="编辑"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              await saveProviders(providers.filter(x => x.id !== p.id));
                            }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: s.overlay(0.4) }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = s.danger; e.currentTarget.style.backgroundColor = s.dangerDim; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = s.overlay(0.4); e.currentTarget.style.backgroundColor = 'transparent'; }}
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* 新增供应商表单 */}
                {isAddingProvider && (
                  <div
                    className="px-3 py-2.5 rounded-lg space-y-2"
                    style={{ backgroundColor: s.inputBg, border: `1px solid ${s.accent}` }}
                  >
                    <input
                      type="text"
                      value={providerForm.name}
                      onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                      placeholder="名称（如 DeepSeek、OpenAI）"
                      className="w-full px-2 py-1.5 rounded text-sm outline-none"
                      style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                      autoFocus
                    />
                    <input
                      type="text"
                      value={providerForm.url}
                      onChange={(e) => setProviderForm({ ...providerForm, url: e.target.value })}
                      placeholder="API 地址（如 https://api.deepseek.com）"
                      className="w-full px-2 py-1.5 rounded text-sm outline-none"
                      style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                    />
                    <input
                      type="password"
                      value={providerForm.key}
                      onChange={(e) => setProviderForm({ ...providerForm, key: e.target.value })}
                      placeholder="API Key"
                      className="w-full px-2 py-1.5 rounded text-sm outline-none"
                      style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setIsAddingProvider(false)}
                        className="p-1.5 rounded-lg"
                        style={{ color: s.overlay(0.5) }}
                      >
                        <X size={16} />
                      </button>
                      <button
                        onClick={async () => {
                          if (!providerForm.name.trim()) return;
                          const newProvider: AiProvider = {
                            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                            name: providerForm.name.trim(),
                            url: providerForm.url.trim(),
                            key: providerForm.key.trim(),
                          };
                          await saveProviders([...providers, newProvider]);
                          setIsAddingProvider(false);
                        }}
                        className="p-1.5 rounded-lg"
                        style={{ color: s.accent }}
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── 模型选择 ── */}
            <div
              className="mt-5 pt-4"
              style={{ borderTop: `1px solid ${s.inputBorder}` }}
            >
              <label className="text-sm font-medium mb-3 block" style={{ color: s.text }}>
                <Cpu size={14} className="inline mr-1.5 -mt-0.5" />
                模型选择
              </label>

              {/* 对话模型 */}
              <div className="mb-4">
                <label className="text-xs mb-1.5 block" style={{ color: s.textSub }}>对话模型</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={get('ai.primary_provider', '')}
                      onChange={async (v) => {
                        const model = get('ai.model', '');
                        await resolveAndSaveProviderKeys(v, model, 'ai');
                      }}
                      options={[
                        { value: '', label: '选择供应商...' },
                        ...providers.map((p) => ({ value: p.id, label: p.name })),
                      ]}
                    />
                  </div>
                  <input
                    type="text"
                    value={get('ai.model')}
                    onChange={async (e) => {
                      const model = e.target.value;
                      await settings.set('ai.model', model);
                      const pid = get('ai.primary_provider', '');
                      if (pid) await resolveAndSaveProviderKeys(pid, model, 'ai');
                    }}
                    placeholder="模型名称"
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: s.inputBg, border: `1px solid ${s.inputBorder}`, color: s.text }}
                  />
                  <button
                    onClick={() => {
                      const pid = get('ai.primary_provider', '');
                      const p = providers.find(x => x.id === pid);
                      if (p) handleTestAiConnection(p.url, p.key, get('ai.model', ''));
                    }}
                    disabled={testingProvider || !get('ai.primary_provider') || !get('ai.model')}
                    className="flex-shrink-0 px-2.5 py-2 rounded-lg text-xs transition-colors disabled:opacity-30"
                    style={{ color: s.accent, backgroundColor: s.accentDim }}
                    title="测试连接"
                  >
                    {testingProvider ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  </button>
                </div>
              </div>

              {/* 视觉辅助模型 */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: s.textSub }}>
                  视觉辅助模型
                  <span className="ml-1.5 font-normal" style={{ color: s.overlay(0.38) }}>（可选，发图片时自动使用）</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={get('ai.vision_provider', '')}
                      onChange={async (v) => {
                        const model = get('ai.vision_model', '');
                        if (v) {
                          await resolveAndSaveProviderKeys(v, model, 'ai.vision');
                        } else {
                          await settings.set('ai.vision_provider', '');
                          await settings.set('ai.vision_model', '');
                          await settings.set('ai.vision_api_url', '');
                          await settings.set('ai.vision_api_key', '');
                        }
                      }}
                      options={[
                        { value: '', label: '不使用' },
                        ...providers.map((p) => ({ value: p.id, label: p.name })),
                      ]}
                    />
                  </div>
                  <input
                    type="text"
                    value={get('ai.vision_model')}
                    onChange={async (e) => {
                      const model = e.target.value;
                      await settings.set('ai.vision_model', model);
                      const pid = get('ai.vision_provider', '');
                      if (pid) await resolveAndSaveProviderKeys(pid, model, 'ai.vision');
                    }}
                    placeholder="模型名称"
                    disabled={!get('ai.vision_provider')}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-40"
                    style={{ backgroundColor: s.inputBg, border: `1px solid ${s.inputBorder}`, color: s.text }}
                  />
                  <button
                    onClick={() => {
                      const pid = get('ai.vision_provider', '');
                      const p = providers.find(x => x.id === pid);
                      if (p) handleTestAiConnection(p.url, p.key, get('ai.vision_model', ''));
                    }}
                    disabled={testingProvider || !get('ai.vision_provider') || !get('ai.vision_model')}
                    className="flex-shrink-0 px-2.5 py-2 rounded-lg text-xs transition-colors disabled:opacity-30"
                    style={{ color: s.accent, backgroundColor: s.accentDim }}
                    title="测试连接"
                  >
                    {testingProvider ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  </button>
                </div>
              </div>

              {/* 测试结果 */}
              {testResult && (
                <div
                  className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs"
                  style={{
                    backgroundColor: testResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: testResult.ok ? '#22c55e' : '#ef4444',
                  }}
                >
                  {testResult.ok ? <Check size={12} /> : <AlertTriangle size={12} />}
                  {testResult.msg}
                </div>
              )}
            </div>

          </Section>

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
                            className="w-full px-2 py-1 rounded text-sm outline-none"
                            style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                          />
                          <textarea
                            value={editForm.prompt}
                            onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                            placeholder="提示词内容"
                            rows={2}
                            className="w-full px-2 py-1 rounded text-sm outline-none resize-none"
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
                    className="w-full px-2 py-1 rounded text-sm outline-none"
                    style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
                  />
                  <textarea
                    value={addForm.prompt}
                    onChange={(e) => setAddForm({ ...addForm, prompt: e.target.value })}
                    placeholder="提示词内容（发送给 AI 的完整提示）"
                    rows={2}
                    className="w-full px-2 py-1 rounded text-sm outline-none resize-none"
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
          <Section sectionKey="sync" title="数据同步" styles={s} expanded={openSections.has('sync')} onToggle={() => toggleSection('sync')}>
            <div className="flex items-center gap-2 mb-2">
              <Cloud size={16} style={{ color: s.accent }} />
              <span className="text-sm" style={{ color: s.textSub }}>
                在多台设备间同步数据
              </span>
            </div>

            {/* 启用同步开关 */}
            <ToggleRow
              label="启用自动同步"
              checked={settings.get('sync.enabled') === 'true'}
              onChange={(v) => { settings.set('sync.enabled', String(v)); syncService.setSyncEnabled(v); }}
              styles={s}
            />

            {/* 存储类型选择 */}
            <SelectRow
              label="存储类型"
              value={syncStorageType}
              options={[
                { value: 'webdav', label: '坚果云 WebDAV' },
                { value: 'oss', label: '阿里云 OSS' },
              ]}
              onChange={(v) => setSyncStorageType(v as 'webdav' | 'oss')}
              styles={s}
            />

            {/* WebDAV 配置 */}
            {syncStorageType === 'webdav' && (
              <>
                <InputRow
                  label="WebDAV 服务器"
                  value={syncFormUrl}
                  placeholder="https://dav.jianguoyun.com/dav/"
                  onChange={setSyncFormUrl}
                  styles={s}
                />
                <InputRow
                  label="用户名"
                  value={syncFormUser}
                  placeholder="your@email.com"
                  onChange={setSyncFormUser}
                  styles={s}
                />
                <InputRow
                  label="应用密码"
                  value={syncFormPass}
                  type="password"
                  placeholder="坚果云应用密码"
                  onChange={setSyncFormPass}
                  styles={s}
                />
              </>
            )}

            {/* OSS 配置 */}
            {syncStorageType === 'oss' && (
              <>
                <InputRow
                  label="AccessKey ID"
                  value={ossAccessKeyId}
                  placeholder="阿里云 RAM AccessKey ID"
                  onChange={setOssAccessKeyId}
                  styles={s}
                />
                <InputRow
                  label="AccessKey Secret"
                  value={ossAccessKeySecret}
                  type="password"
                  placeholder="阿里云 RAM AccessKey Secret"
                  onChange={setOssAccessKeySecret}
                  styles={s}
                />
                <InputRow
                  label="Bucket"
                  value={ossBucket}
                  placeholder="my-lantern-bucket"
                  onChange={setOssBucket}
                  styles={s}
                />
                <InputRow
                  label="Region"
                  value={ossRegion}
                  placeholder="oss-cn-hangzhou 或 cn-hangzhou"
                  onChange={setOssRegion}
                  styles={s}
                />
              </>
            )}

            {/* 同步间隔 */}
            <InputRow
              label="同步间隔（分钟）"
              value={settings.get('sync.interval_minutes', '30')}
              type="number"
              placeholder="30"
              onChange={(v) => settings.set('sync.interval_minutes', v)}
              styles={s}
            />

            {/* 图片同步选项 */}
            <div className="pt-2 space-y-2" style={{ borderTop: `1px solid ${s.inputBorder}` }}>
              <label className="text-xs" style={{ color: s.textSub }}>图片同步</label>
              <ToggleRow
                label="同步日记图片"
                checked={settings.get('sync.journal_images', 'true') === 'true'}
                onChange={(v) => settings.set('sync.journal_images', String(v))}
                styles={s}
              />
              <ToggleRow
                label="同步 AI 对话图片"
                checked={settings.get('sync.chat_images', 'false') === 'true'}
                onChange={(v) => settings.set('sync.chat_images', String(v))}
                styles={s}
              />
              <p className="text-xs" style={{ color: s.overlay(0.38) }}>
                关闭可节省同步空间，图片仅保留在本地
              </p>
            </div>

            {/* 按钮行 */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleTestConnection}
                disabled={syncTesting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                style={{ backgroundColor: s.overlay(0.08), color: s.text }}
              >
                {syncTesting ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                测试连接
              </button>
              <button
                onClick={handleSaveSyncConfig}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ backgroundColor: s.overlay(0.08), color: s.text }}
              >
                保存配置
              </button>
            </div>

            {/* 测试结果 */}
            {syncTestResult && (
              <div
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: syncTestResult.ok ? `${withAlpha(s.accent, 0.08)}` : s.dangerDim,
                  color: syncTestResult.ok ? s.accent : s.danger,
                }}
              >
                {syncTestResult.ok ? <Wifi size={14} className="inline mr-1.5" /> : <WifiOff size={14} className="inline mr-1.5" />}
                {syncTestResult.msg}
              </div>
            )}

            {/* 手动同步按钮 */}
            <div className="pt-2 border-t" style={{ borderColor: s.cardBorder }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: s.textSub }}>
                  {syncStore.status?.last_sync_time
                    ? `上次同步: ${new Date(syncStore.status.last_sync_time).toLocaleString()}`
                    : '尚未同步'}
                </span>
              </div>
              <button
                onClick={handleSyncNow}
                disabled={syncStore.isSyncing}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: s.accent, color: appTheme.onPrimary }}
              >
                {syncStore.isSyncing ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> 同步中...
                  </>
                ) : (
                  <>
                    <RefreshCw size={15} /> 立即同步
                  </>
                )}
              </button>
            </div>

            {/* 同步进度显示 */}
            <SyncProgress
              isSyncing={syncStore.isSyncing}
              result={syncStore.lastResult}
              error={syncStore.error}
              theme={{
                accent: s.accent,
                text: s.text,
                textSub: s.textSub,
                danger: s.danger,
                success: appTheme.success,
                overlay: s.overlay,
                cardBorder: s.cardBorder,
              }}
            />

            {/* 同步结果 */}
            {syncStore.lastResult && (
              <div
                className="px-3 py-2 rounded-lg text-xs space-y-1"
                style={{
                  backgroundColor: syncStore.lastResult.success ? `${withAlpha(s.accent, 0.08)}` : s.dangerDim,
                  color: syncStore.lastResult.success ? s.accent : s.danger,
                }}
              >
                <div>{syncStore.lastResult.message}</div>
                {syncStore.lastResult.bytes_uploaded > 0 && (
                  <div>上传: {formatBytes(syncStore.lastResult.bytes_uploaded)}</div>
                )}
                {syncStore.lastResult.bytes_downloaded > 0 && (
                  <div>下载: {formatBytes(syncStore.lastResult.bytes_downloaded)}</div>
                )}
              </div>
            )}

            {/* 同步错误 */}
            {syncStore.error && (
              <div
                className="px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: s.dangerDim, color: s.danger }}
              >
                {syncStore.error}
              </div>
            )}
          </Section>

          {/* ===== 数据管理 ===== */}
          <Section sectionKey="data" title="数据管理" styles={s} expanded={openSections.has('data')} onToggle={() => toggleSection('data')}>
            <button
              onClick={() => setShowExportDialog(true)}
              className="w-full py-3 px-4 rounded-xl text-lg transition-colors"
              style={{ backgroundColor: s.accentDim, color: s.accent }}
            >
              导出数据
            </button>
            <button
              onClick={() => { setClearCategories(new Set()); setShowClearDialog(true); }}
              className="w-full py-3 px-4 rounded-xl text-lg transition-colors"
              style={{ backgroundColor: s.dangerDim, color: s.danger }}
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
            className="rounded-[18px] p-6 mx-4 w-[320px]"
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

