import { useState, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useSettingStore } from '@/stores/settingStore';
import type { InspirationNote, InspirationCategory } from '@/types/inspiration';
import { DEFAULT_CATEGORIES } from '@/types/inspiration';
import { getCategoryIcon } from './categoryIcons';
import { CapsuleTabs } from '@/components/ui';
import {
  Plus, Search, Pin, Trash2, MoreHorizontal, Settings2, X, ExternalLink,
  PenLine, Video,
} from 'lucide-react';

// ─── 时间分组 ───

function groupByDate(notes: InspirationNote[]): { label: string; notes: InspirationNote[] }[] {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const groups: Record<string, InspirationNote[]> = {};
  for (const note of notes) {
    const date = note.createdAt.slice(0, 10);
    let label: string;
    if (date === today) label = '今天';
    else if (date === yesterday) label = '昨天';
    else { const d = new Date(date + 'T00:00:00'); label = `${d.getMonth() + 1}月${d.getDate()}日`; }
    if (!groups[label]) groups[label] = [];
    groups[label].push(note);
  }
  return Object.entries(groups).map(([label, notes]) => ({ label, notes }));
}

// ─── 从设置加载分类 ───

function useCategories(): InspirationCategory[] {
  const stored = useSettingStore((s) => s.get('inspiration.categories', ''));
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  return DEFAULT_CATEGORIES;
}

interface NotesListProps {
  notes: InspirationNote[];
  onOpenNote: (id: string) => void;
  onCreateManual: () => void;
  onCreateVideo: () => void;
  onOpenSettings: () => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
}

export function NotesList({
  notes, onOpenNote, onCreateManual, onCreateVideo, onOpenSettings,
  onDeleteNote, onTogglePin,
}: NotesListProps) {
  const appTheme = useAppTheme();
  const txt = appTheme.ink;
  const txtLight = withAlpha(txt, 0.3);
  const txtMid = withAlpha(txt, 0.5);
  const txtMeta = withAlpha(txt, 0.4);

  const categories = useCategories();

  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  // 构建过滤标签
  const filterTabs = useMemo(() => {
    const tabs = [{ id: 'all', label: '全部' }];
    for (const cat of categories) {
      const count = notes.filter((n) => n.categoryId === cat.id).length;
      tabs.push({ id: cat.id, label: `${cat.name} ${count}` });
    }
    return tabs;
  }, [categories, notes]);

  const filtered = useMemo(() => {
    let result = [...notes];
    if (filter !== 'all') result = result.filter((n) => n.categoryId === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) =>
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return result;
  }, [notes, filter, searchQuery]);

  const groups = groupByDate(filtered);

  // 分类色
  const getCatColor = (catId: string) => {
    return categories.find((c) => c.id === catId)?.color ?? '#888';
  };

  const EmptyIcon = getCategoryIcon('lightbulb');

  return (
    <>
      {/* ── 固定控制区 ── */}
      <div className="flex-shrink-0 flex flex-col items-center px-4 sm:px-8 pt-6 pb-4 relative z-10">
        <div className="w-full max-w-[1000px]">
          <CapsuleTabs items={filterTabs} activeId={filter} onChange={setFilter} accentColor={appTheme.primary} />
        </div>
        <div className="h-4" />
        <div className="w-full max-w-[1000px] flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: txtLight }} />
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索灵感..."
              className="w-full rounded-full pl-11 pr-4 py-3 text-base focus:outline-none transition-all backdrop-blur-sm"
              style={{ backgroundColor: withAlpha(appTheme.canvas, 0.6), color: txt }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: txtLight }}>
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={onOpenSettings}
            className="w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
            style={{ backgroundColor: withAlpha(appTheme.canvas, 0.6), color: txtMeta }}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      {/* ── 笔记列表 ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-24">
        <div className="max-w-[1000px] mx-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: withAlpha('#FF9800', 0.1) }}>
                <EmptyIcon size={28} style={{ color: '#FF9800' }} />
              </div>
              <div className="text-base font-medium mb-1" style={{ color: txt }}>
                {searchQuery ? '没有找到匹配的灵感' : '还没有灵感笔记'}
              </div>
              <div className="text-sm" style={{ color: txtMeta }}>
                {searchQuery ? '换个关键词试试' : '点击右下角按钮开始'}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="text-sm font-medium mb-2 px-1" style={{ color: txtMeta }}>{group.label}</div>
                  <div className="space-y-2">
                    {group.notes.map((note) => {
                      const catColor = getCatColor(note.categoryId);
                      const cat = categories.find((c) => c.id === note.categoryId);
                      const CatIcon = getCategoryIcon(cat?.icon ?? 'lightbulb');
                      return (
                        <div key={note.id} className="relative">
                          <div
                            onClick={() => onOpenNote(note.id)}
                            className="rounded-[18px] p-4 cursor-pointer"
                            style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}
                          >
                            {/* 顶部行：分类 + 时间 + 更多 */}
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: withAlpha(catColor, 0.12), color: catColor }}
                              >
                                <CatIcon size={10} />{cat?.name ?? note.categoryId}
                              </span>
                              {note.pinned && <Pin size={10} style={{ color: txtMeta }} />}
                              {note.sourceTitle && (
                                <span className="flex items-center gap-0.5 text-[10px] truncate max-w-[140px]" style={{ color: txtMeta }}>
                                  <ExternalLink size={9} />{note.sourceTitle}
                                </span>
                              )}
                              <span className="flex-1" />
                              <span className="text-[10px]" style={{ color: txtMeta }}>
                                {new Date(note.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setContextMenuId(contextMenuId === note.id ? null : note.id); }}
                                className="p-0.5 rounded" style={{ color: txtMeta }}
                              >
                                <MoreHorizontal size={14} />
                              </button>
                            </div>

                            {/* 标题 */}
                            <div className="text-sm font-semibold mb-1 line-clamp-1" style={{ color: txt }}>{note.title}</div>

                            {/* 内容预览 — Markdown 渲染 */}
                            <div className="text-sm leading-relaxed line-clamp-2 markdown-body" style={{ color: txtMid }}>
                              <Markdown remarkPlugins={[remarkGfm]}>{note.content}</Markdown>
                            </div>

                            {/* 标签 */}
                            {note.tags.length > 0 && (
                              <div className="flex gap-1.5 mt-2 flex-wrap">
                                {note.tags.slice(0, 3).map((tag) => (
                                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: withAlpha(txt, 0.06), color: txtMid }}>{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 右键菜单 */}
                          {contextMenuId === note.id && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setContextMenuId(null)} />
                              <div
                                className="absolute right-4 top-10 z-40 rounded-xl py-1 min-w-[120px]"
                                style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}
                              >
                                <button
                                  onClick={() => { onTogglePin(note.id); setContextMenuId(null); }}
                                  className="w-full px-3 py-2 text-sm text-left flex items-center gap-2" style={{ color: txt }}
                                >
                                  <Pin size={12} />{note.pinned ? '取消置顶' : '置顶'}
                                </button>
                                <button
                                  onClick={() => { onDeleteNote(note.id); setContextMenuId(null); }}
                                  className="w-full px-3 py-2 text-sm text-left flex items-center gap-2" style={{ color: appTheme.danger }}
                                >
                                  <Trash2 size={12} />删除
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── FAB ── */}
      <div className="fixed bottom-24 right-6 z-20">
        {showFabMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowFabMenu(false)} />
            <div
              className="absolute bottom-16 right-0 z-20 rounded-2xl py-1 mb-2 min-w-[160px]"
              style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}
            >
              <button
                onClick={() => { onCreateManual(); setShowFabMenu(false); }}
                className="w-full px-4 py-3 text-sm text-left flex items-center gap-3" style={{ color: txt }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: withAlpha('#4CAF76', 0.12) }}>
                  <PenLine size={14} style={{ color: '#4CAF76' }} />
                </div>
                手动记录
              </button>
              <button
                onClick={() => { onCreateVideo(); setShowFabMenu(false); }}
                className="w-full px-4 py-3 text-sm text-left flex items-center gap-3" style={{ color: txt }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: withAlpha('#FF9800', 0.12) }}>
                  <Video size={14} style={{ color: '#FF9800' }} />
                </div>
                视频解析
              </button>
            </div>
          </>
        )}
        <button
          onClick={() => setShowFabMenu(!showFabMenu)}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-transform"
          style={{ backgroundColor: appTheme.primary, transform: showFabMenu ? 'rotate(45deg)' : 'none' }}
        >
          <Plus size={24} color="#fff" />
        </button>
      </div>
    </>
  );
}
