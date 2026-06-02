import { useEffect, useRef, useState } from 'react';
import { Card, NavBar } from '@/components/ui';
import { useSettingStore } from '@/stores/settingStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useAppTheme, useThemeMode, useThemeHelpers, withAlpha } from '@/stores/themeStore';
import { PageContainer } from '@/components/layout';
import { BUILTIN_PROMPTS } from '@/utils/builtinPrompts';
import type { PromptTemplate } from '@/utils/builtinPrompts';
import { Plus, Pencil, Trash2, X, Check, Lock, Download, AlertTriangle, Cloud, Loader2, RefreshCw, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import * as scheduleService from '@/services/scheduleService';
import { useSyncStore } from '@/stores/syncStore';
import { invoke } from '@tauri-apps/api/core';
import * as syncService from '@/services/syncService';

const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', defaultUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic', defaultUrl: 'https://api.anthropic.com' },
  { id: 'deepseek', name: 'DeepSeek', defaultUrl: 'https://api.deepseek.com' },
  { id: 'ollama', name: 'Ollama', defaultUrl: 'http://localhost:11434' },
];

interface SettingsStyles {
  card: string;
  cardBorder: string;
  text: string;
  textSub: string;
  accent: string;
  accentDim: string;
  danger: string;
  dangerDim: string;
  inputBg: string;
  inputBorder: string;
  overlay: (opacity: number) => string;
}

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

  // 同步表单
  const [syncStorageType, setSyncStorageType] = useState<'webdav' | 'r2'>('webdav');
  const [syncFormUrl, setSyncFormUrl] = useState('');
  const [syncFormUser, setSyncFormUser] = useState('');
  const [syncFormPass, setSyncFormPass] = useState('');
  const [r2AccountId, setR2AccountId] = useState('');
  const [r2AccessKey, setR2AccessKey] = useState('');
  const [r2SecretKey, setR2SecretKey] = useState('');
  const [r2Bucket, setR2Bucket] = useState('');
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

  const handleTestConnection = async () => {
    if (syncStorageType === 'r2') {
      if (!r2AccountId || !r2AccessKey || !r2SecretKey || !r2Bucket) {
        setSyncTestResult({ ok: false, msg: '请填写完整的 R2 配置' });
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
      await settings.set('sync.r2.account_id', r2AccountId);
      await settings.set('sync.r2.access_key', r2AccessKey);
      await settings.set('sync.r2.secret_key', r2SecretKey);
      await settings.set('sync.r2.bucket', r2Bucket);
      const msg = await syncStore.testConnection({
        storageType: syncStorageType,
        url: syncFormUrl,
        username: syncFormUser,
        password: syncFormPass,
        r2AccountId,
        r2AccessKey,
        r2SecretKey,
        r2Bucket,
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
    await settings.set('sync.r2.account_id', r2AccountId);
    await settings.set('sync.r2.access_key', r2AccessKey);
    await settings.set('sync.r2.secret_key', r2SecretKey);
    await settings.set('sync.r2.bucket', r2Bucket);
    await syncService.setSyncEnabled(true);
    await syncStore.syncNow();
  };

  const handleSaveSyncConfig = async () => {
    await settings.set('sync.storage_type', syncStorageType);
    await settings.set('sync.url', syncFormUrl);
    await settings.set('sync.username', syncFormUser);
    await settings.set('sync.password', syncFormPass);
    await settings.set('sync.r2.account_id', r2AccountId);
    await settings.set('sync.r2.access_key', r2AccessKey);
    await settings.set('sync.r2.secret_key', r2SecretKey);
    await settings.set('sync.r2.bucket', r2Bucket);
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
    import('@tauri-apps/api/app').then(({ getVersion }) => getVersion()).then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    loadCustomPrompts();
  }, []);

  // 同步表单从 settings 初始化
  useEffect(() => {
    if (settings.loaded) {
      setSyncStorageType((settings.get('sync.storage_type', 'webdav') as 'webdav' | 'r2'));
      setSyncFormUrl(settings.get('sync.url', 'https://dav.jianguoyun.com/dav/'));
      setSyncFormUser(settings.get('sync.username', ''));
      setSyncFormPass(settings.get('sync.password', ''));
      setR2AccountId(settings.get('sync.r2.account_id', ''));
      setR2AccessKey(settings.get('sync.r2.access_key', ''));
      setR2SecretKey(settings.get('sync.r2.secret_key', ''));
      setR2Bucket(settings.get('sync.r2.bucket', ''));
    }
  }, [settings.loaded]);

  const get = (key: string, fallback = '') => settings.get(key, fallback);
  const set = (key: string, value: string) => settings.set(key, value);

  const loadCustomPrompts = () => {
    try {
      const raw = localStorage.getItem('lantern_custom_prompts');
      if (raw) setCustomPrompts(JSON.parse(raw));
    } catch { /* ignore */ }
  };

  const persistCustomPrompts = (prompts: PromptTemplate[]) => {
    localStorage.setItem('lantern_custom_prompts', JSON.stringify(prompts));
    setCustomPrompts(prompts);
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
          <Section title="外观" styles={s}>
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
          <Section title="通知设置" styles={s}>
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
          <Section title="番茄钟" styles={s}>
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
          <Section title="AI 助手设置" styles={s}>
            {/* Provider 选择 */}
            <div className="mb-4">
              <label className="text-sm mb-1.5 block" style={{ color: s.textSub }}>AI 服务提供商</label>
              <select
                value={get('ai.provider', 'deepseek')}
                onChange={(e) => {
                  const p = AI_PROVIDERS.find(p => p.id === e.target.value);
                  set('ai.provider', e.target.value);
                  if (p) set('ai.api_url', p.defaultUrl);
                }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={{
                  backgroundColor: s.inputBg,
                  border: `1px solid ${s.inputBorder}`,
                  color: s.text,
                }}
              >
                {AI_PROVIDERS.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    style={{ backgroundColor: s.card, color: s.text }}
                  >
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* API 地址 */}
            <InputRow
              label="API 地址"
              value={get('ai.api_url')}
              placeholder="https://api.deepseek.com"
              onChange={(v) => set('ai.api_url', v)}
              styles={s}
            />

            {/* API Key */}
            <InputRow
              label="API Key"
              value={get('ai.api_key')}
              type="password"
              placeholder="sk-..."
              onChange={(v) => set('ai.api_key', v)}
              styles={s}
            />

            {/* 模型名称 */}
            <InputRow
              label="模型名称"
              value={get('ai.model', 'deepseek-v4-flash')}
              placeholder="deepseek-v4-flash"
              onChange={(v) => set('ai.model', v)}
              styles={s}
            />

          </Section>

          {/* ===== 锦囊管理 ===== */}
          <Section title="锦囊管理" styles={s}>
            <p className="text-sm mb-4" style={{ color: s.textSub }}>
              自定义提灯弹窗中的快捷提示词（锦囊），点击即可自动发送
            </p>

            {/* 内置锦囊（只读） */}
            <div className="mb-5">
              <h4 className="text-xs mb-2 flex items-center gap-1.5" style={{ color: s.textSub }}>
                <Lock size={11} /> 系统内置
              </h4>
              <div className="space-y-1.5">
                {BUILTIN_PROMPTS.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: s.overlay(0.04), border: `1px solid ${s.cardBorder}` }}
                  >
                    <span className="text-sm w-20 flex-shrink-0" style={{ color: s.overlay(0.35) }}>{p.title}</span>
                    <span className="text-xs truncate" style={{ color: s.overlay(0.18) }}>{p.prompt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 自定义锦囊 */}
            <div>
              <h4 className="text-xs mb-2" style={{ color: s.textSub }}>我的锦囊</h4>
              {customPrompts.length === 0 && !isAdding ? (
                <p className="text-xs mb-3" style={{ color: s.overlay(0.18) }}>暂无自定义锦囊</p>
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
                          <span className="text-xs truncate flex-1" style={{ color: s.overlay(0.3) }}>{p.prompt}</span>
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
                              onClick={() => handleDeleteCustom(p.id)}
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
                    placeholder="锦囊标题"
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
                  <Plus size={14} /> 添加锦囊
                </button>
              )}
            </div>
          </Section>

          {/* ===== 数据同步 ===== */}
          <Section title="数据同步" styles={s}>
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
                { value: 'r2', label: 'Cloudflare R2' },
              ]}
              onChange={(v) => setSyncStorageType(v as 'webdav' | 'r2')}
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

            {/* R2 配置 */}
            {syncStorageType === 'r2' && (
              <>
                <InputRow
                  label="Account ID"
                  value={r2AccountId}
                  placeholder="Cloudflare Account ID"
                  onChange={setR2AccountId}
                  styles={s}
                />
                <InputRow
                  label="Access Key"
                  value={r2AccessKey}
                  placeholder="R2 API Access Key ID"
                  onChange={setR2AccessKey}
                  styles={s}
                />
                <InputRow
                  label="Secret Key"
                  value={r2SecretKey}
                  type="password"
                  placeholder="R2 API Secret Access Key"
                  onChange={setR2SecretKey}
                  styles={s}
                />
                <InputRow
                  label="Bucket"
                  value={r2Bucket}
                  placeholder="my-lantern-bucket"
                  onChange={setR2Bucket}
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
          <Section title="数据管理" styles={s}>
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
          onClick={() => setShowExportDialog(false)}
        >
          <div
            className="rounded-[18px] p-6 w-[95vw] sm:w-[420px]"
            style={{ backgroundColor: s.card }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-medium mb-5 tracking-wider" style={{ color: s.text }}>
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
                  <select
                    value={exportCalendarId ?? ''}
                    onChange={(e) => setExportCalendarId(e.target.value || null)}
                    className="px-3 py-1.5 rounded-lg text-sm outline-none"
                    style={{
                      backgroundColor: s.inputBg,
                      border: `1px solid ${s.inputBorder}`,
                      color: s.text,
                    }}
                  >
                    <option value="" style={{ backgroundColor: s.card, color: s.text }}>全部日程</option>
                    {calendars.map((cal) => (
                      <option key={cal.id} value={cal.id} style={{ backgroundColor: s.card, color: s.text }}>
                        {cal.name}
                      </option>
                    ))}
                  </select>
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
              className="w-full mt-4 py-2 rounded-full text-sm transition-colors"
              style={{ color: s.textSub }}
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
          onClick={() => setShowClearDialog(false)}
        >
          <div
            className="rounded-[18px] p-5 w-[95vw] sm:w-[380px] max-h-[85vh] flex flex-col"
            style={{ backgroundColor: s.card }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1 flex-shrink-0">
              <AlertTriangle size={16} style={{ color: s.danger }} />
              <h2 className="text-base font-medium tracking-wider" style={{ color: s.text }}>
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

/* ========== 子组件 ========== */

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: SettingsStyles }) {
  return (
    <Card
      className="w-full p-5"
      style={{ backgroundColor: styles.card, border: `0.5px solid ${styles.cardBorder}` }}
    >
      <h3 className="text-xl mb-4 font-semibold" style={{ color: styles.text }}>
        {title}
      </h3>
      <div className="space-y-4">
        {children}
      </div>
    </Card>
  );
}

function ToggleRow({ label, checked, onChange, styles, disabled = false }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  styles: SettingsStyles;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-base" style={{ color: styles.textSub }}>{label}</span>
      <button
        onClick={() => !disabled && onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{
          backgroundColor: checked ? styles.accent : styles.overlay(0.2),
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform"
          style={{ left: checked ? '22px' : '2px' }}
        />
      </button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function InputRow({ label, value, onChange, styles, type = 'text', placeholder = '' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  styles: SettingsStyles;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm mb-1.5 block" style={{ color: styles.textSub }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ backgroundColor: styles.inputBg, border: `1px solid ${styles.inputBorder}`, color: styles.text }}
      />
    </div>
  );
}

function SelectRow({ label, value, options, onChange, styles }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  styles: SettingsStyles;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <label className="text-sm mb-1.5 block" style={{ color: styles.textSub }}>{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 rounded-lg text-sm text-left flex items-center justify-between"
        style={{ backgroundColor: styles.inputBg, border: `1px solid ${styles.inputBorder}`, color: styles.text }}
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={14} style={{ color: styles.textSub, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-lg"
          style={{ backgroundColor: styles.card, border: `1px solid ${styles.inputBorder}` }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full px-3 py-2 text-sm text-left transition-colors"
              style={{
                color: opt.value === value ? styles.accent : styles.text,
                backgroundColor: opt.value === value ? styles.accentDim : 'transparent',
              }}
              onMouseEnter={e => { if (opt.value !== value) (e.currentTarget.style.backgroundColor = styles.overlay(0.06)); }}
              onMouseLeave={e => { if (opt.value !== value) (e.currentTarget.style.backgroundColor = 'transparent'); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

