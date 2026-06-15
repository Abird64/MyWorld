import { useState, useEffect, useCallback } from 'react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useSettingStore } from '@/stores/settingStore';
import * as inspirationService from '@/services/inspirationService';
import type { InspirationCategory } from '@/types/inspiration';
import { DEFAULT_CATEGORIES } from '@/types/inspiration';
import { getCategoryIcon, CATEGORY_ICON_MAP } from './categoryIcons';
import {
  AlertCircle, Plus, X, Check, Pencil, Trash2,
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';

// ─── 预设色板 ───

const COLOR_OPTIONS = [
  '#E8B959', '#3A8FB7', '#4CAF76', '#5856d6', '#B87353', '#C97070',
  '#8A6DA7', '#FF9800', '#00BCD4', '#E91E63', '#607D8B', '#795548',
];

// ─── 分类管理 Hook ───

function useCategories(): [InspirationCategory[], (cats: InspirationCategory[]) => void] {
  const stored = useSettingStore((s) => s.get('inspiration.categories', ''));
  const categories: InspirationCategory[] = (() => {
    if (stored) {
      try { return JSON.parse(stored); } catch { /* fall through */ }
    }
    return [...DEFAULT_CATEGORIES];
  })();

  const setCategories = (cats: InspirationCategory[]) => {
    useSettingStore.getState().set('inspiration.categories', JSON.stringify(cats));
  };

  return [categories, setCategories];
}

interface SettingsSectionProps {
  onBack: () => void;
}

export function SettingsSection({ onBack: _onBack }: SettingsSectionProps) {
  const appTheme = useAppTheme();
  const txt = appTheme.ink;
  const txtMid = withAlpha(txt, 0.5);
  const txtMeta = withAlpha(txt, 0.4);

  // ─── B 站登录 ───
  const [bilibiliSessdata, setBilibiliSessdata] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<'idle' | 'waiting' | 'scanned' | 'expired'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const settings = useSettingStore.getState();
    setBilibiliSessdata(settings.get('inspiration.bilibili_sessdata', ''));
    const unlisten = listen<string>('bilibili-login-success', (event) => {
      const sessdata = event.payload;
      setBilibiliSessdata(sessdata);
      useSettingStore.getState().set('inspiration.bilibili_sessdata', sessdata);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleStartQrLogin = useCallback(async () => {
    try {
      setQrStatus('waiting'); setError('');
      const { url: qrUrl, qrcode_key } = await inspirationService.bilibiliQrcodeUrl();
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`);
      const poll = async () => {
        try {
          const result = await inspirationService.bilibiliPollQrcode(qrcode_key);
          const statusCode = result.data?.code ?? result.code;
          if (result.sessdata) {
            setBilibiliSessdata(result.sessdata);
            useSettingStore.getState().set('inspiration.bilibili_sessdata', result.sessdata!);
            setQrCodeUrl(null); setQrStatus('idle');
            return;
          } else if (statusCode === 86038) { setQrStatus('expired'); return; }
          else if (statusCode === 86090) { setQrStatus('scanned'); }
          setTimeout(poll, 2000);
        } catch { setTimeout(poll, 3000); }
      };
      setTimeout(poll, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setQrStatus('idle');
    }
  }, []);

  // ─── 分类管理 ───
  const [categories, setCategories] = useCategories();
  const [editingCat, setEditingCat] = useState<string | null>(null);   // 正在编辑的分类 id
  const [editForm, setEditForm] = useState({ name: '', icon: '', color: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', icon: 'lightbulb', color: COLOR_OPTIONS[0] });

  const handleStartEdit = (cat: InspirationCategory) => {
    setEditingCat(cat.id);
    setEditForm({ name: cat.name, icon: cat.icon, color: cat.color });
  };

  const handleSaveEdit = () => {
    if (!editingCat || !editForm.name.trim()) return;
    setCategories(categories.map((c) =>
      c.id === editingCat ? { ...c, name: editForm.name.trim(), icon: editForm.icon, color: editForm.color } : c
    ));
    setEditingCat(null);
  };

  const handleDelete = (id: string) => {
    // 不能删除预设分类（但用户可以改它们）
    setCategories(categories.filter((c) => c.id !== id));
  };

  const handleAdd = () => {
    if (!addForm.name.trim()) return;
    const id = `cat-${Date.now()}`;
    setCategories([...categories, { id, name: addForm.name.trim(), icon: addForm.icon, color: addForm.color, isDefault: false }]);
    setAddForm({ name: '', icon: 'lightbulb', color: COLOR_OPTIONS[0] });
    setIsAdding(false);
  };

  const handleReset = () => {
    useSettingStore.getState().set('inspiration.categories', '');
    // 强制刷新
    setEditingCat(null);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-6 pb-8">
      <div className="max-w-[1000px] mx-auto space-y-5">

        {/* ── 分类管理 ── */}
        <div className="rounded-[18px] p-5" style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium" style={{ color: txt }}>灵感分类</span>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ color: txtMeta, border: `1px solid ${appTheme.hairline}` }}
              >
                恢复默认
              </button>
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ backgroundColor: appTheme.primary, color: '#fff' }}
              >
                <Plus size={12} />添加
              </button>
            </div>
          </div>

          {/* 分类列表 */}
          <div className="space-y-2">
            {categories.map((cat) => {
              const CIcon = getCategoryIcon(cat.icon);
              const isEditing = editingCat === cat.id;
              return (
                <div key={cat.id}>
                  {isEditing ? (
                    <div className="flex items-center gap-2 p-2 rounded-xl" style={{ backgroundColor: withAlpha(txt, 0.03) }}>
                      {/* 图标选择 */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            const keys = Object.keys(CATEGORY_ICON_MAP);
                            const idx = keys.indexOf(editForm.icon);
                            const next = keys[(idx + 1) % keys.length];
                            setEditForm({ ...editForm, icon: next });
                          }}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                          style={{ backgroundColor: withAlpha(editForm.color, 0.12), color: editForm.color }}
                        >
                          {(() => { const I = getCategoryIcon(editForm.icon); return <I size={16} />; })()}
                        </button>
                      </div>
                      {/* 名称 */}
                      <input
                        type="text" value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className="flex-1 text-sm bg-transparent outline-none px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: withAlpha(txt, 0.04), color: txt, border: `1px solid ${appTheme.hairline}` }}
                        autoFocus
                      />
                      {/* 颜色选择 */}
                      <div className="flex gap-1">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditForm({ ...editForm, color })}
                            className="w-5 h-5 rounded-full transition-transform"
                            style={{
                              backgroundColor: color,
                              transform: editForm.color === color ? 'scale(1.2)' : 'none',
                              boxShadow: editForm.color === color ? `0 0 0 2px ${color}44` : 'none',
                            }}
                          />
                        ))}
                      </div>
                      {/* 操作 */}
                      <button onClick={handleSaveEdit} className="p-1.5 rounded-full" style={{ color: appTheme.success }}>
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingCat(null)} className="p-1.5 rounded-full" style={{ color: txtMeta }}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-2 py-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: withAlpha(cat.color, 0.12), color: cat.color }}
                      >
                        <CIcon size={16} />
                      </div>
                      <span className="flex-1 text-sm" style={{ color: txt }}>{cat.name}</span>
                      <button
                        onClick={() => handleStartEdit(cat)}
                        className="p-1.5 rounded-full" style={{ color: txtMeta }}
                      >
                        <Pencil size={14} />
                      </button>
                      {!cat.isDefault && (
                        <button
                          onClick={() => handleDelete(cat.id)}
                          className="p-1.5 rounded-full" style={{ color: appTheme.danger }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 新增行 */}
            {isAdding && (
              <div className="flex items-center gap-2 p-2 rounded-xl" style={{ backgroundColor: withAlpha(txt, 0.03) }}>
                <div className="relative">
                  <button
                    onClick={() => {
                      const keys = Object.keys(CATEGORY_ICON_MAP);
                      const idx = keys.indexOf(addForm.icon);
                      const next = keys[(idx + 1) % keys.length];
                      setAddForm({ ...addForm, icon: next });
                    }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: withAlpha(addForm.color, 0.12), color: addForm.color }}
                  >
                    {(() => { const I = getCategoryIcon(addForm.icon); return <I size={16} />; })()}
                  </button>
                </div>
                <input
                  type="text" value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="新分类名称"
                  className="flex-1 text-sm bg-transparent outline-none px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: withAlpha(txt, 0.04), color: txt, border: `1px solid ${appTheme.hairline}` }}
                  autoFocus
                />
                <div className="flex gap-1">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setAddForm({ ...addForm, color })}
                      className="w-5 h-5 rounded-full transition-transform"
                      style={{
                        backgroundColor: color,
                        transform: addForm.color === color ? 'scale(1.2)' : 'none',
                        boxShadow: addForm.color === color ? `0 0 0 2px ${color}44` : 'none',
                      }}
                    />
                  ))}
                </div>
                <button onClick={handleAdd} disabled={!addForm.name.trim()} className="p-1.5 rounded-full"
                  style={{ color: appTheme.success, opacity: addForm.name.trim() ? 1 : 0.3 }}>
                  <Check size={16} />
                </button>
                <button onClick={() => setIsAdding(false)} className="p-1.5 rounded-full" style={{ color: txtMeta }}>
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── B 站设置 ── */}
        <div className="rounded-[18px] p-5" style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium" style={{ color: txt }}>B 站账号</span>
            {bilibiliSessdata ? (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: withAlpha(appTheme.success, 0.12), color: appTheme.success }}>已登录</span>
            ) : (
              <span className="text-xs" style={{ color: txtMeta }}>登录后可获取 AI 字幕</span>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs mb-3"
              style={{ backgroundColor: withAlpha(appTheme.danger, 0.08), color: appTheme.danger }}>
              <AlertCircle size={12} />{error}
            </div>
          )}

          {bilibiliSessdata ? (
            <div className="space-y-3">
              <div className="text-sm" style={{ color: txtMid }}>已连接 B 站账号，可获取 AI 生成字幕</div>
              <button
                onClick={() => { setBilibiliSessdata(''); useSettingStore.getState().set('inspiration.bilibili_sessdata', ''); }}
                className="text-sm px-3 py-2 rounded-full" style={{ color: appTheme.danger, border: `1px solid ${withAlpha(appTheme.danger, 0.3)}` }}>
                退出登录
              </button>
            </div>
          ) : qrCodeUrl ? (
            <div className="text-center space-y-3">
              <div className="text-sm" style={{ color: txtMid }}>{qrStatus === 'scanned' ? '已扫码，请在手机上确认' : '用 B 站 App 扫码登录'}</div>
              <div className="inline-block p-3 rounded-xl" style={{ backgroundColor: '#fff', border: `1px solid ${appTheme.hairline}` }}>
                <img src={qrCodeUrl} alt="B站扫码" className="w-[180px] h-[180px]" style={{ imageRendering: 'pixelated' }} />
              </div>
              <div className="flex gap-2 justify-center">
                <button onClick={handleStartQrLogin} className="text-sm px-3 py-1.5 rounded-full" style={{ color: txtMid, border: `1px solid ${appTheme.hairline}` }}>刷新</button>
                <button onClick={() => { setQrCodeUrl(null); setQrStatus('idle'); }} className="text-sm px-3 py-1.5 rounded-full" style={{ color: txtMid, border: `1px solid ${appTheme.hairline}` }}>取消</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button onClick={handleStartQrLogin} className="w-full py-2.5 rounded-full text-sm font-medium text-white flex items-center justify-center gap-1.5" style={{ backgroundColor: '#00A1D6' }}>
                扫码登录 B 站
              </button>
              <div className="text-center text-xs" style={{ color: txtMeta }}>或手动填入 SESSDATA</div>
              <input
                type="password" value={bilibiliSessdata}
                onChange={(e) => { setBilibiliSessdata(e.target.value); useSettingStore.getState().set('inspiration.bilibili_sessdata', e.target.value); }}
                placeholder="手动填入 SESSDATA..."
                className="w-full px-4 py-2.5 rounded-full text-sm outline-none"
                style={{ backgroundColor: withAlpha(txt, 0.04), color: txt, border: `1px solid ${appTheme.hairline}` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
