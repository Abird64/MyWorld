import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Sparkles } from 'lucide-react';
import { SKILL_COLORS } from '@/styles/theme';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import type { CompleteResult } from '@/types/task';
import type { ExtractedContact } from '@/types/journal';
import { ContactSyncCard } from './ContactSyncCard';

interface ReflectionPanelProps {
  show: boolean;
  date: string;
  xpResult: CompleteResult | null;
  reflection: string;
  contacts: ExtractedContact[];
  mood: string | null;
  tags: string | null;
  onClose: () => void;
  onContactSync: (index: number) => void;
  onContactIgnore: (index: number) => void;
  onConfirmAll: () => void;
}

export function ReflectionPanel({
  show,
  date,
  xpResult,
  reflection,
  contacts,
  mood,
  tags,
  onClose,
  onContactSync,
  onContactIgnore,
  onConfirmAll,
}: ReflectionPanelProps) {
  const appTheme = useAppTheme();
  if (!show) return null;

  const hasContacts = contacts.length > 0;
  const hasReflection = !!reflection;

  const TXT = appTheme.ink;
  const TXT_DIM = `${withAlpha(appTheme.ink, 0.6)}`;
  const TXT_PROSE = `${withAlpha(appTheme.ink, 0.8)}`;
  const SURFACE_BG = `${withAlpha(appTheme.ink, 0.03)}`;
  const BTN_BG = `${withAlpha(appTheme.ink, 0.05)}`;
  const BTN_HOVER = `${withAlpha(appTheme.ink, 0.1)}`;
  const BTN_TEXT = `${withAlpha(appTheme.ink, 0.6)}`;
  const LABEL_DIM = `${withAlpha(appTheme.ink, 0.4)}`;
  const MUTED = `${withAlpha(appTheme.ink, 0.2)}`;
  const BORDER = `${withAlpha(appTheme.ink, 0.08)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 面板 */}
      <div
        className="relative w-full max-w-[640px] max-h-[85vh] rounded-[18px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
        style={{ backgroundColor: appTheme.canvas }}
      >
        {/* 头部 */}
        <div className="flex-shrink-0 flex items-center justify-between px-8 pt-6 pb-4 border-b" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-3">
            <Sparkles size={22} style={{ color: appTheme.primary }} />
            <h2 className="text-base font-medium" style={{ color: TXT }}>提灯总结 · {date}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${withAlpha(appTheme.ink, 0.05)}`)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} style={{ color: TXT_DIM }} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-8 py-5 space-y-6">
          {/* ─── XP 结算 ─── */}
          {xpResult && xpResult.skill_xps.length > 0 && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: SURFACE_BG }}>
              <p className="text-sm mb-3 tracking-wider" style={{ color: LABEL_DIM }}>属性成长</p>
              <div className="flex items-center gap-3 flex-wrap">
                {xpResult.skill_xps.map((s) => {
                  const color = SKILL_COLORS[s.skill_id]?.hex ?? '#999';
                  return (
                    <div
                      key={s.skill_id}
                      className="rounded-full px-4 py-2 flex items-center gap-2"
                      style={{ backgroundColor: `${withAlpha(color, 0.15)}` }}
                    >
                      <span className="text-sm" style={{ color }}>
                        {SKILL_COLORS[s.skill_id]?.name ?? s.skill_name}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: TXT }}>
                        +{s.xp}
                      </span>
                    </div>
                  );
                })}
                <span className="text-sm ml-1" style={{ color: MUTED }}>
                  共 {xpResult.xp_earned} XP
                </span>
              </div>
            </div>
          )}

          {/* ─── 心情 & 标签 ─── */}
          {(mood || (tags && JSON.parse(tags).length > 0)) && (
            <div className="rounded-2xl p-5 flex items-center gap-4 flex-wrap" style={{ backgroundColor: SURFACE_BG }}>
              <p className="text-sm tracking-wider" style={{ color: LABEL_DIM }}>今日感受</p>
              {mood && (
                <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: `${withAlpha(appTheme.primary, 0.15)}`, color: appTheme.primary }}>
                  {mood}
                </span>
              )}
              {tags && (() => {
                try {
                  const parsed: string[] = JSON.parse(tags);
                  return parsed.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: SURFACE_BG, color: TXT_DIM, border: `1px solid ${BORDER}` }}>
                      {tag}
                    </span>
                  ));
                } catch { return null; }
              })()}
            </div>
          )}

          {/* ─── AI 旁白 ─── */}
          {hasReflection ? (
            <div className="rounded-2xl p-5" style={{ backgroundColor: SURFACE_BG }}>
              <p className="text-sm mb-3 tracking-wider" style={{ color: LABEL_DIM }}>提灯的旁白</p>
              <div
                className="text-sm leading-relaxed prose-sm max-w-none"
                style={{ color: TXT_PROSE }}
              >
                <Markdown remarkPlugins={[remarkGfm]}>{reflection}</Markdown>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: SURFACE_BG }}>
              <p className="text-base" style={{ color: MUTED }}>旁白生成中或未生成...</p>
            </div>
          )}

          {/* ─── 联系人同步 ─── */}
          {hasContacts && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: SURFACE_BG }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm tracking-wider" style={{ color: LABEL_DIM }}>
                  联系人同步 · {contacts.length} 人
                </p>
                <button
                  onClick={onConfirmAll}
                  className="px-4 py-1.5 rounded-full text-sm transition-colors"
                  style={{ backgroundColor: BTN_BG, color: BTN_TEXT }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BTN_HOVER)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BTN_BG)}
                >
                  一键全部确认
                </button>
              </div>
              <div className="space-y-3">
                {contacts.map((c, i) => (
                  <ContactSyncCard
                    key={`${c.name}-${i}`}
                    contact={c}
                    onSync={() => onContactSync(i)}
                    onIgnore={() => onContactIgnore(i)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 空状态：无联系人需要同步 */}
          {!hasContacts && hasReflection && (
            <div className="text-center py-2">
              <p className="text-sm" style={{ color: MUTED }}>暂无待处理的联系人信息</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
