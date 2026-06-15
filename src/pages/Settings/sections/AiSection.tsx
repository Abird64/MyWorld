import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Check, AlertTriangle, Loader2, Cpu, Zap } from 'lucide-react';
import { useSettingStore } from '@/stores/settingStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import * as aiService from '@/services/aiService';
import { Select } from '@/components/ui/Select';
import { Section, type SettingsStyles } from '../components';

interface AiProvider { id: string; name: string; url: string; key: string; }

interface Props {
  styles: SettingsStyles;
  expanded: boolean;
  onToggle: () => void;
}

export function AiSection({ styles: s, expanded, onToggle }: Props) {
  const appTheme = useAppTheme();
  const settings = useSettingStore();

  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', url: '', key: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const get = (key: string, fallback = '') => settings.get(key, fallback);

  useEffect(() => {
    if (settings.loaded) {
      try {
        const raw = settings.get('ai.providers', '[]');
        setProviders(JSON.parse(raw));
      } catch { setProviders([]); }
    }
  }, [settings.loaded]);

  const saveProviders = async (list: AiProvider[]) => {
    setProviders(list);
    await settings.set('ai.providers', JSON.stringify(list));
  };

  const resolveAndSave = async (providerId: string, model: string, prefix: 'ai' | 'ai.vision') => {
    const p = providers.find(x => x.id === providerId);
    if (prefix === 'ai') {
      await settings.set('ai.api_url', p?.url || '');
      await settings.set('ai.api_key', p?.key || '');
      await settings.set('ai.model', model);
      await settings.set('ai.primary_provider', providerId);
    } else {
      await settings.set('ai.vision_api_url', p?.url || '');
      await settings.set('ai.vision_api_key', p?.key || '');
      await settings.set('ai.vision_model', model);
      await settings.set('ai.vision_provider', providerId);
    }
  };

  const handleTest = async (url: string, key: string, model: string) => {
    if (!url.trim() || !model.trim()) {
      setTestResult({ ok: false, msg: '请填写 API 地址和模型名称' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const msg = await aiService.testConnection(url.trim(), key.trim(), model.trim());
      setTestResult({ ok: true, msg });
    } catch (e) {
      setTestResult({ ok: false, msg: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const renderInput = (type: 'text' | 'password', value: string, onChange: (v: string) => void, placeholder: string, autoFocus = false) => (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2 py-1.5 rounded text-sm outline-none settings-input"
      style={{ backgroundColor: s.card, border: `1px solid ${s.inputBorder}`, color: s.text }}
      autoFocus={autoFocus}
    />
  );

  return (
    <Section sectionKey="ai" title="AI 助手设置" styles={s} expanded={expanded} onToggle={onToggle}>
      {/* ── 供应商管理 ── */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <label className="text-sm font-medium" style={{ color: s.text }}>API 供应商</label>
            <p className="text-xs mt-0.5" style={{ color: s.overlay(0.38) }}>添加 AI 服务的 API 地址和密钥</p>
          </div>
          {!isAdding && (
            <button onClick={() => { setIsAdding(true); setForm({ name: '', url: '', key: '' }); }} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors" style={{ color: s.accent }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = s.accentDim; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
              <Plus size={14} /> 添加
            </button>
          )}
        </div>

        {providers.length === 0 && !isAdding && (
          <p className="text-xs py-3 text-center" style={{ color: s.overlay(0.38) }}>还没有配置供应商，点击"添加"开始</p>
        )}

        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.id} className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: s.inputBg, border: `1px solid ${s.inputBorder}` }}>
              {editingId === p.id ? (
                <div className="space-y-2">
                  {renderInput('text', form.name, (v) => setForm({ ...form, name: v }), '名称（如 DeepSeek）')}
                  {renderInput('text', form.url, (v) => setForm({ ...form, url: v }), 'API 地址')}
                  {renderInput('password', form.key, (v) => setForm({ ...form, key: v }), 'API Key')}
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg" style={{ color: s.overlay(0.5) }}><X size={16} /></button>
                    <button onClick={async () => {
                      const updated = providers.map(x => x.id === p.id ? { ...x, name: form.name, url: form.url, key: form.key } : x);
                      await saveProviders(updated);
                      if (get('ai.primary_provider') === p.id) await resolveAndSave(p.id, get('ai.model', ''), 'ai');
                      if (get('ai.vision_provider') === p.id) await resolveAndSave(p.id, get('ai.vision_model', ''), 'ai.vision');
                      setEditingId(null);
                    }} className="p-1.5 rounded-lg" style={{ color: s.accent }}><Check size={16} /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: s.text }}>{p.name}</div>
                    <div className="text-xs truncate" style={{ color: s.overlay(0.4) }}>{p.url}</div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button onClick={() => { setEditingId(p.id); setForm({ name: p.name, url: p.url, key: p.key }); }} className="p-1.5 rounded-lg transition-colors" style={{ color: s.overlay(0.4) }} onMouseEnter={(e) => { e.currentTarget.style.color = s.text; e.currentTarget.style.backgroundColor = s.overlay(0.08); }} onMouseLeave={(e) => { e.currentTarget.style.color = s.overlay(0.4); e.currentTarget.style.backgroundColor = 'transparent'; }} title="编辑"><Pencil size={14} /></button>
                    <button onClick={async () => { await saveProviders(providers.filter(x => x.id !== p.id)); }} className="p-1.5 rounded-lg transition-colors" style={{ color: s.overlay(0.4) }} onMouseEnter={(e) => { e.currentTarget.style.color = s.danger; e.currentTarget.style.backgroundColor = s.dangerDim; }} onMouseLeave={(e) => { e.currentTarget.style.color = s.overlay(0.4); e.currentTarget.style.backgroundColor = 'transparent'; }} title="删除"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isAdding && (
            <div className="px-3 py-2.5 rounded-lg space-y-2" style={{ backgroundColor: s.inputBg, border: `1px solid ${s.accent}` }}>
              {renderInput('text', form.name, (v) => setForm({ ...form, name: v }), '名称（如 DeepSeek、OpenAI）', true)}
              {renderInput('text', form.url, (v) => setForm({ ...form, url: v }), 'API 地址（如 https://api.deepseek.com）')}
              {renderInput('password', form.key, (v) => setForm({ ...form, key: v }), 'API Key')}
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => setIsAdding(false)} className="p-1.5 rounded-lg" style={{ color: s.overlay(0.5) }}><X size={16} /></button>
                <button onClick={async () => {
                  if (!form.name.trim()) return;
                  await saveProviders([...providers, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: form.name.trim(), url: form.url.trim(), key: form.key.trim() }]);
                  setIsAdding(false);
                }} className="p-1.5 rounded-lg" style={{ color: s.accent }}><Check size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 模型选择 ── */}
      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${s.inputBorder}` }}>
        <label className="text-sm font-medium mb-3 block" style={{ color: s.text }}>
          <Cpu size={14} className="inline mr-1.5 -mt-0.5" />
          模型选择
        </label>

        <div className="mb-4">
          <label className="text-xs mb-1.5 block" style={{ color: s.textSub }}>
            对话模型
            <span className="ml-1.5 font-normal" style={{ color: s.overlay(0.38) }}>（日常对话和任务使用）</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Select value={get('ai.primary_provider', '')} onChange={async (v) => { await resolveAndSave(v, get('ai.model', ''), 'ai'); }} options={[{ value: '', label: '选择供应商...' }, ...providers.map((p) => ({ value: p.id, label: p.name }))]} />
            </div>
            <div className="flex gap-2 flex-1">
              <input type="text" value={get('ai.model')} onChange={async (e) => { await settings.set('ai.model', e.target.value); const pid = get('ai.primary_provider', ''); if (pid) await resolveAndSave(pid, e.target.value, 'ai'); }} placeholder="模型名称" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none settings-input" style={{ backgroundColor: s.inputBg, border: `1px solid ${s.inputBorder}`, color: s.text }} />
              <button onClick={() => { const pid = get('ai.primary_provider', ''); const p = providers.find(x => x.id === pid); if (p) handleTest(p.url, p.key, get('ai.model', '')); }} disabled={testing || !get('ai.primary_provider') || !get('ai.model')} className="flex-shrink-0 px-2.5 py-2 rounded-lg text-xs transition-colors disabled:opacity-30" style={{ color: s.accent, backgroundColor: s.accentDim }} title="测试连接">
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs mb-1.5 block" style={{ color: s.textSub }}>
            视觉辅助模型
            <span className="ml-1.5 font-normal" style={{ color: s.overlay(0.38) }}>（可选，发图片时自动使用）</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Select value={get('ai.vision_provider', '')} onChange={async (v) => {
                if (v) { await resolveAndSave(v, get('ai.vision_model', ''), 'ai.vision'); }
                else { await settings.set('ai.vision_provider', ''); await settings.set('ai.vision_model', ''); await settings.set('ai.vision_api_url', ''); await settings.set('ai.vision_api_key', ''); }
              }} options={[{ value: '', label: '不使用' }, ...providers.map((p) => ({ value: p.id, label: p.name }))]} />
            </div>
            <div className="flex gap-2 flex-1">
              <input type="text" value={get('ai.vision_model')} onChange={async (e) => { await settings.set('ai.vision_model', e.target.value); const pid = get('ai.vision_provider', ''); if (pid) await resolveAndSave(pid, e.target.value, 'ai.vision'); }} placeholder="模型名称" disabled={!get('ai.vision_provider')} className="flex-1 px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-40 settings-input" style={{ backgroundColor: s.inputBg, border: `1px solid ${s.inputBorder}`, color: s.text }} />
              <button onClick={() => { const pid = get('ai.vision_provider', ''); const p = providers.find(x => x.id === pid); if (p) handleTest(p.url, p.key, get('ai.vision_model', '')); }} disabled={testing || !get('ai.vision_provider') || !get('ai.vision_model')} className="flex-shrink-0 px-2.5 py-2 rounded-lg text-xs transition-colors disabled:opacity-30" style={{ color: s.accent, backgroundColor: s.accentDim }} title="测试连接">
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              </button>
            </div>
          </div>
        </div>

        {testResult && (
          <div className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: testResult.ok ? `${withAlpha(appTheme.success, 0.1)}` : `${withAlpha(appTheme.danger, 0.1)}`, color: testResult.ok ? appTheme.success : appTheme.danger }}>
            {testResult.ok ? <Check size={12} /> : <AlertTriangle size={12} />}
            {testResult.msg}
          </div>
        )}
      </div>
    </Section>
  );
}
