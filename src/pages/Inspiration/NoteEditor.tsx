import { useState, useEffect, useRef } from 'react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useSettingStore } from '@/stores/settingStore';
import type { InspirationNote, InspirationCategory } from '@/types/inspiration';
import { DEFAULT_CATEGORIES } from '@/types/inspiration';
import { getCategoryIcon } from './categoryIcons';
import { X, Check, ChevronDown } from 'lucide-react';

function useCategories(): InspirationCategory[] {
  const stored = useSettingStore((s) => s.get('inspiration.categories', ''));
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  return DEFAULT_CATEGORIES;
}

interface NoteEditorProps {
  note?: InspirationNote;
  prefill?: Partial<InspirationNote>;
  onSave: (data: Omit<InspirationNote, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export function NoteEditor({ note, prefill, onSave, onCancel }: NoteEditorProps) {
  const appTheme = useAppTheme();
  const txt = appTheme.ink;
  const txtMid = withAlpha(txt, 0.5);
  const txtMeta = withAlpha(txt, 0.4);

  const categories = useCategories();

  const [title, setTitle] = useState(note?.title ?? prefill?.title ?? '');
  const [content, setContent] = useState(note?.content ?? prefill?.content ?? '');
  const [categoryId, setCategoryId] = useState(note?.categoryId ?? prefill?.categoryId ?? categories[0]?.id ?? 'shannian');
  const [sourceUrl, setSourceUrl] = useState(note?.sourceUrl ?? prefill?.sourceUrl ?? '');
  const [sourceTitle, setSourceTitle] = useState(note?.sourceTitle ?? prefill?.sourceTitle ?? '');
  const [tags, setTags] = useState<string[]>(note?.tags ?? prefill?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [showCatPicker, setShowCatPicker] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const isEditing = !!note;

  useEffect(() => { if (!title) titleRef.current?.focus(); }, []);

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      content: content.trim(),
      categoryId,
      sourceUrl: sourceUrl || undefined,
      sourceTitle: sourceTitle || undefined,
      tags,
      pinned: note?.pinned ?? false,
    });
  };

  const currentCat = categories.find((c) => c.id === categoryId) ?? categories[0];
  const CatIcon = getCategoryIcon(currentCat?.icon ?? 'lightbulb');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-8 py-3"
        style={{ borderBottom: `0.5px solid ${appTheme.hairline}` }}>
        <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded-full" style={{ color: txtMid }}>取消</button>
        <button
          onClick={handleSave} disabled={!title.trim()}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-full transition-opacity"
          style={{ backgroundColor: appTheme.primary, color: '#fff', opacity: title.trim() ? 1 : 0.4 }}
        >
          <Check size={14} />{isEditing ? '保存' : '创建'}
        </button>
      </div>

      {/* 编辑区 */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-[1000px] mx-auto space-y-5">
          {/* 标题 */}
          <input
            ref={titleRef}
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="给灵感起个名字..."
            className="w-full text-xl font-semibold bg-transparent outline-none"
            style={{ color: txt }}
          />

          {/* 分类选择 */}
          <div className="relative">
            <div className="text-sm font-medium mb-2" style={{ color: txtMeta }}>分类</div>
            <button
              onClick={() => setShowCatPicker(!showCatPicker)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm"
              style={{ border: `1px solid ${appTheme.hairline}`, color: txt }}
            >
              <span className="flex items-center gap-1.5">
                <CatIcon size={14} style={{ color: currentCat?.color }} />
                {currentCat?.name}
              </span>
              <ChevronDown size={12} style={{ color: txtMeta }} />
            </button>
            {showCatPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCatPicker(false)} />
                <div
                  className="absolute top-full left-0 mt-2 z-20 rounded-2xl py-1 min-w-[180px]"
                  style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}
                >
                  {categories.map((cat) => {
                    const CIcon = getCategoryIcon(cat.icon);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => { setCategoryId(cat.id); setShowCatPicker(false); }}
                        className="w-full px-4 py-2.5 text-sm text-left flex items-center gap-2"
                        style={{ color: cat.id === categoryId ? cat.color : txt }}
                      >
                        <CIcon size={14} style={{ color: cat.color }} />
                        {cat.name}
                        {cat.id === categoryId && <Check size={12} className="ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 来源链接 */}
          <details>
            <summary className="text-sm font-medium cursor-pointer" style={{ color: txtMeta }}>来源信息（可选）</summary>
            <div className="space-y-2 mt-2">
              <input
                type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="来源链接"
                className="w-full text-sm bg-transparent outline-none px-4 py-2.5 rounded-full"
                style={{ backgroundColor: withAlpha(txt, 0.04), color: txt, border: `1px solid ${appTheme.hairline}` }}
              />
              <input
                type="text" value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)}
                placeholder="来源标题"
                className="w-full text-sm bg-transparent outline-none px-4 py-2.5 rounded-full"
                style={{ backgroundColor: withAlpha(txt, 0.04), color: txt, border: `1px solid ${appTheme.hairline}` }}
              />
            </div>
          </details>

          {/* 内容 */}
          <div>
            <textarea
              value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="写下你的灵感...支持 Markdown 语法"
              rows={10}
              className="w-full text-base leading-relaxed bg-transparent outline-none resize-none rounded-[18px] px-4 py-3"
              style={{ backgroundColor: withAlpha(txt, 0.04), color: txt, border: `0.5px solid ${appTheme.hairline}`, minHeight: '200px' }}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs" style={{ color: txtMeta }}>支持 Markdown 语法</span>
              <span className="text-xs" style={{ color: txtMeta }}>{content.length} 字</span>
            </div>
          </div>

          {/* 标签 */}
          <div>
            <div className="text-sm font-medium mb-2" style={{ color: txtMeta }}>标签</div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: withAlpha(appTheme.primary, 0.08), color: appTheme.primary }}>
                    {tag}
                    <button onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:opacity-60"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text" value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                placeholder="添加标签..."
                className="flex-1 text-sm bg-transparent outline-none px-4 py-2 rounded-full"
                style={{ backgroundColor: withAlpha(txt, 0.04), color: txt, border: `1px solid ${appTheme.hairline}` }}
              />
              <button
                onClick={handleAddTag} disabled={!tagInput.trim()}
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{ backgroundColor: withAlpha(appTheme.primary, 0.1), color: appTheme.primary, opacity: tagInput.trim() ? 1 : 0.4 }}
              >添加</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
