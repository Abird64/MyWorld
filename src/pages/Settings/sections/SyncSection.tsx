import { useState, useEffect } from 'react';
import { Cloud, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useSettingStore } from '@/stores/settingStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useSyncStore } from '@/stores/syncStore';
import * as syncService from '@/services/syncService';
import { SyncProgress } from '@/components/sync';
import { Section, ToggleRow, InputRow, SelectRow, type SettingsStyles } from '../components';

interface Props {
  styles: SettingsStyles;
  expanded: boolean;
  onToggle: () => void;
}

export function SyncSection({ styles: s, expanded, onToggle }: Props) {
  const appTheme = useAppTheme();
  const settings = useSettingStore();
  const syncStore = useSyncStore();

  const [storageType, setStorageType] = useState<'webdav' | 'oss'>('webdav');
  const [formUrl, setFormUrl] = useState('');
  const [formUser, setFormUser] = useState('');
  const [formPass, setFormPass] = useState('');
  const [ossKeyId, setOssKeyId] = useState('');
  const [ossKeySecret, setOssKeySecret] = useState('');
  const [ossBucket, setOssBucket] = useState('');
  const [ossRegion, setOssRegion] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (settings.loaded) {
      setStorageType(settings.get('sync.storage_type', 'webdav') as 'webdav' | 'oss');
      setFormUrl(settings.get('sync.url', 'https://dav.jianguoyun.com/dav/'));
      setFormUser(settings.get('sync.username', ''));
      setFormPass(settings.get('sync.password', ''));
      setOssKeyId(settings.get('sync.oss.access_key_id', ''));
      setOssKeySecret(settings.get('sync.oss.access_key_secret', ''));
      setOssBucket(settings.get('sync.oss.bucket', ''));
      setOssRegion(settings.get('sync.oss.region', ''));
    }
  }, [settings.loaded]);

  const saveConfig = async () => {
    await settings.set('sync.storage_type', storageType);
    await settings.set('sync.url', formUrl);
    await settings.set('sync.username', formUser);
    await settings.set('sync.password', formPass);
    await settings.set('sync.oss.access_key_id', ossKeyId);
    await settings.set('sync.oss.access_key_secret', ossKeySecret);
    await settings.set('sync.oss.bucket', ossBucket);
    await settings.set('sync.oss.region', ossRegion);
  };

  const handleTest = async () => {
    if (storageType === 'oss') {
      if (!ossKeyId || !ossKeySecret || !ossBucket || !ossRegion) {
        setTestResult({ ok: false, msg: '请填写完整的 OSS 配置' });
        return;
      }
    } else {
      if (!formUrl || !formUser || !formPass) {
        setTestResult({ ok: false, msg: '请填写完整的 WebDAV 配置' });
        return;
      }
    }
    setTesting(true);
    setTestResult(null);
    try {
      await saveConfig();
      const msg = await syncStore.testConnection({
        storageType, url: formUrl, username: formUser, password: formPass,
        ossAccessKeyId: ossKeyId, ossAccessKeySecret: ossKeySecret, ossBucket, ossRegion,
      });
      setTestResult({ ok: true, msg });
    } catch (e) {
      setTestResult({ ok: false, msg: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    await saveConfig();
    await syncService.setSyncEnabled(true);
    await syncStore.syncNow();
  };

  const handleSaveConfig = async () => {
    await saveConfig();
    setTestResult({ ok: true, msg: '配置已保存' });
    setTimeout(() => setTestResult(null), 2000);
  };

  return (
    <Section sectionKey="sync" title="数据同步" styles={s} expanded={expanded} onToggle={onToggle}>
      <div className="flex items-center gap-2 mb-2">
        <Cloud size={16} style={{ color: s.accent }} />
        <span className="text-sm" style={{ color: s.textSub }}>
          在多台设备间同步数据
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: withAlpha(appTheme.warning, 0.15), color: appTheme.warning, border: `0.5px solid ${withAlpha(appTheme.warning, 0.3)}` }}
        >
          实验性
        </span>
      </div>

      <ToggleRow
        label="启用自动同步"
        checked={settings.get('sync.enabled') === 'true'}
        onChange={(v) => { settings.set('sync.enabled', String(v)); syncService.setSyncEnabled(v); }}
        styles={s}
      />

      <SelectRow
        label="存储类型"
        value={storageType}
        options={[
          { value: 'webdav', label: '坚果云 WebDAV' },
          { value: 'oss', label: '阿里云 OSS' },
        ]}
        onChange={(v) => setStorageType(v as 'webdav' | 'oss')}
        styles={s}
      />

      {storageType === 'webdav' && (
        <>
          <InputRow label="WebDAV 服务器" value={formUrl} placeholder="https://dav.jianguoyun.com/dav/" onChange={setFormUrl} styles={s} />
          <InputRow label="用户名" value={formUser} placeholder="your@email.com" onChange={setFormUser} styles={s} />
          <InputRow label="应用密码" value={formPass} type="password" placeholder="坚果云应用密码" onChange={setFormPass} styles={s} />
          <p className="text-xs -mt-2" style={{ color: s.overlay(0.38) }}>
            在坚果云「账户设置 → 安全选项」中生成第三方应用密码
          </p>
        </>
      )}

      {storageType === 'oss' && (
        <>
          <InputRow label="AccessKey ID" value={ossKeyId} placeholder="阿里云 RAM AccessKey ID" onChange={setOssKeyId} styles={s} />
          <InputRow label="AccessKey Secret" value={ossKeySecret} type="password" placeholder="阿里云 RAM AccessKey Secret" onChange={setOssKeySecret} styles={s} />
          <InputRow label="Bucket" value={ossBucket} placeholder="my-lantern-bucket" onChange={setOssBucket} styles={s} />
          <InputRow label="Region" value={ossRegion} placeholder="oss-cn-hangzhou 或 cn-hangzhou" onChange={setOssRegion} styles={s} />
        </>
      )}

      <InputRow label="同步间隔（分钟）" value={settings.get('sync.interval_minutes', '30')} type="number" placeholder="30" onChange={(v) => settings.set('sync.interval_minutes', v)} styles={s} />

      <div className="pt-2 space-y-2" style={{ borderTop: `1px solid ${s.inputBorder}` }}>
        <label className="text-xs" style={{ color: s.textSub }}>图片同步</label>
        <ToggleRow label="同步日记图片" checked={settings.get('sync.journal_images', 'true') === 'true'} onChange={(v) => settings.set('sync.journal_images', String(v))} styles={s} />
        <ToggleRow label="同步 AI 对话图片" checked={settings.get('sync.chat_images', 'false') === 'true'} onChange={(v) => settings.set('sync.chat_images', String(v))} styles={s} />
        <p className="text-xs" style={{ color: s.overlay(0.38) }}>关闭可节省同步空间，图片仅保留在本地</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button onClick={handleTest} disabled={testing} className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50" style={{ backgroundColor: s.accentDim, color: s.accent }}>
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
          测试连接
        </button>
        <button onClick={handleSaveConfig} className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors" style={{ backgroundColor: 'transparent', color: s.textSub, border: `1px solid ${s.inputBorder}` }}>
          保存配置
        </button>
      </div>

      {testResult && (
        <div className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: testResult.ok ? `${withAlpha(s.accent, 0.08)}` : s.dangerDim, color: testResult.ok ? s.accent : s.danger }}>
          {testResult.ok ? <Wifi size={14} className="inline mr-1.5" /> : <WifiOff size={14} className="inline mr-1.5" />}
          {testResult.msg}
        </div>
      )}

      <div className="pt-2 border-t" style={{ borderColor: s.cardBorder }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm" style={{ color: s.textSub }}>
            {syncStore.status?.last_sync_time
              ? `上次同步: ${new Date(syncStore.status.last_sync_time).toLocaleString()}`
              : '尚未同步'}
          </span>
        </div>
        <button onClick={handleSyncNow} disabled={syncStore.isSyncing} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50" style={{ backgroundColor: s.accent, color: appTheme.onPrimary }}>
          {syncStore.isSyncing ? <><Loader2 size={15} className="animate-spin" /> 同步中...</> : <><RefreshCw size={15} /> 立即同步</>}
        </button>
      </div>

      <SyncProgress
        isSyncing={syncStore.isSyncing}
        result={syncStore.lastResult}
        error={syncStore.error}
        theme={{ accent: s.accent, text: s.text, textSub: s.textSub, danger: s.danger, success: appTheme.success, overlay: s.overlay, cardBorder: s.cardBorder }}
      />
    </Section>
  );
}
