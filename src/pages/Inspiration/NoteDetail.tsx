import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useSettingStore } from '@/stores/settingStore';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { InspirationNote, InspirationCategory } from '@/types/inspiration';
import { DEFAULT_CATEGORIES } from '@/types/inspiration';
import { getCategoryIcon } from './categoryIcons';
import { PenLine, Pin, Trash2, ExternalLink, Copy, Tag, Clock } from 'lucide-react';

function useCategories(): InspirationCategory[] {
  const stored = useSettingStore((s) => s.get('inspiration.categories', ''));
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  return DEFAULT_CATEGORIES;
}

interface NoteDetailProps {
  note: InspirationNote;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

export function NoteDetail({ note, onEdit, onDelete, onTogglePin }: NoteDetailProps) {
  const appTheme = useAppTheme();
  const txt = appTheme.ink;
  const txtMid = withAlpha(txt, 0.5);
  const txtMeta = withAlpha(txt, 0.4);

  const categories = useCategories();
  const cat = categories.find((c) => c.id === note.categoryId);
  const CatIcon = getCategoryIcon(cat?.icon ?? 'lightbulb');
  const catColor = cat?.color ?? '#888';

  const handleCopy = () => {
    navigator.clipboard.writeText(`${note.title}\n\n${note.content}`);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 操作栏 */}
      <div className="flex-shrink-0 flex items-center gap-1 px-4 sm:px-8 py-3"
        style={{ borderBottom: `0.5px solid ${appTheme.hairline}` }}>
        <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: withAlpha(catColor, 0.12), color: catColor }}>
          <CatIcon size={10} />{cat?.name ?? note.categoryId}
        </span>
        <div className="flex-1" />
        <button onClick={onTogglePin} className="p-2 rounded-full" style={{ color: note.pinned ? '#FF9800' : txtMeta }}>
          <Pin size={18} />
        </button>
        <button onClick={handleCopy} className="p-2 rounded-full" style={{ color: txtMeta }}>
          <Copy size={18} />
        </button>
        <button onClick={onEdit} className="p-2 rounded-full" style={{ color: txtMid }}>
          <PenLine size={18} />
        </button>
        <button onClick={onDelete} className="p-2 rounded-full" style={{ color: appTheme.danger }}>
          <Trash2 size={18} />
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-[1000px] mx-auto space-y-5">
          <h1 className="text-xl font-semibold leading-tight" style={{ color: txt, textWrap: 'balance' }}>
            {note.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: txtMeta }}>
            <span className="flex items-center gap-1"><Clock size={14} />{formatDate(note.createdAt)}</span>
            {note.sourceTitle && (
              <span className="flex items-center gap-1">
                <ExternalLink size={14} />
                {note.sourceUrl ? (
                  <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: txtMid }}>
                    {note.sourceTitle}
                  </a>
                ) : note.sourceTitle}
              </span>
            )}
          </div>

          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {note.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: withAlpha(appTheme.primary, 0.08), color: appTheme.primary }}>
                  <Tag size={10} />{tag}
                </span>
              ))}
            </div>
          )}

          <div style={{ borderTop: `0.5px solid ${appTheme.hairline}` }} />

          <div className="markdown-body text-base leading-[1.8]" style={{ color: txt }}>
            <Markdown remarkPlugins={[remarkGfm]}>
              {note.content}
            </Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}
