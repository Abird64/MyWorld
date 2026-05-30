import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, MessageSquare, Star, Bookmark, BookOpen, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PageContainer } from '@/components/layout';
import { NavBar } from '@/components/ui';
import { ChatView } from '@/components/ai/ChatView';
import { useAiStore } from '@/stores/aiStore';
import { useFavoriteStore } from '@/stores/favoriteStore';
import { useMemoryStore } from '@/stores/memoryStore';
import { useAppTheme, useThemeHelpers, useThemeStore } from '@/stores/themeStore';
import type { PageTheme } from '@/styles/theme';
import { MEMORY_TYPE_LABELS, MEMORY_TYPE_ICONS } from '@/types/memory';
import type { Memory } from '@/types/memory';

const ALL_TYPES = ['identity', 'interest', 'taste', 'habit', 'personality', 'relationship', 'status', 'goal', 'event', 'other'] as const;

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays === 2) return '前天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

function groupByType(memories: Memory[]): Map<string, Memory[]> {
  const map = new Map<string, Memory[]>();
  for (const m of memories) {
    const list = map.get(m.memory_type) || [];
    list.push(m);
    map.set(m.memory_type, list);
  }
  return map;
}

type ViewMode = 'chat' | 'favorites' | 'memories';

export function HomePage() {
  const appTheme = useAppTheme();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const h = useThemeHelpers();
  const s = h.rgba;

  const themeMode = useThemeStore((s) => s.mode);
  const t: PageTheme = {
    id: 'lantern', name: '拾阶',
    bg: appTheme.canvas, nav: appTheme.surfaceBlack,
    accent: appTheme.primary, accentLight: `${appTheme.primary}33`,
    text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink,
    isDark: themeMode === 'dark', danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success,
  };

  const {
    conversations,
    currentConversation,
    isSending,
    fetchConversations,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
  } = useAiStore();

  const {
    favorites,
    fetchFavorites,
    toggleFavorite,
    deleteFavorite,
    isFavorited,
  } = useFavoriteStore();

  const {
    memories,
    loading: memoriesLoading,
    selectedType,
    fetchMemories,
    deleteMemory,
    setSelectedType,
  } = useMemoryStore();

  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [selectedFavorite, setSelectedFavorite] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDeleteMemory = async (id: string) => {
    await deleteMemory(id);
    setConfirmDelete(null);
  };

  const toggleSource = (id: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    fetchConversations();
    fetchFavorites();
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');

    let convId = currentConversation;
    if (!convId) {
      convId = await createConversation(text.slice(0, 20));
    }

    await sendMessage(text);
    inputRef.current?.focus();
  };

  const handleNewConversation = async () => {
    setViewMode('chat');
    setShowConversations(false);
    await createConversation();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    setShowConversations(false);
    if (mode === 'favorites') { setSelectedFavorite(null); fetchFavorites(); }
    if (mode === 'memories') fetchMemories();
  };

  const selectedFav = favorites.find(f => f.id === selectedFavorite);

  return (
    <PageContainer className="relative flex flex-col">
      <NavBar title="提灯" />

      {/* 工具栏 */}
      <div
        className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: `0.5px solid ${appTheme.hairline}` }}
      >
        {/* 对话列表切换 */}
        <button
          onClick={() => { setShowConversations(!showConversations); setViewMode('chat'); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all btn-press"
          style={{
            backgroundColor: showConversations ? s(0.08) : 'transparent',
            color: appTheme.inkMuted48,
          }}
        >
          <MessageSquare size={14} />
          <span className="hidden sm:inline">历史</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={() => switchView('favorites')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all btn-press"
          style={{
            backgroundColor: viewMode === 'favorites' ? appTheme.primary + '14' : 'transparent',
            color: viewMode === 'favorites' ? appTheme.primary : appTheme.inkMuted48,
          }}
        >
          <Bookmark size={14} /> 收藏
        </button>
        <button
          onClick={() => switchView('memories')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all btn-press"
          style={{
            backgroundColor: viewMode === 'memories' ? appTheme.primary + '14' : 'transparent',
            color: viewMode === 'memories' ? appTheme.primary : appTheme.inkMuted48,
          }}
        >
          <BookOpen size={14} /> 小本本
        </button>
        <button
          onClick={handleNewConversation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all btn-press"
          style={{
            backgroundColor: viewMode === 'chat' ? appTheme.primary + '14' : 'transparent',
            color: viewMode === 'chat' ? appTheme.primary : appTheme.inkMuted48,
          }}
        >
          <Plus size={14} /> 新对话
        </button>
      </div>

      {/* 主内容区 */}
      <div className="relative z-10 flex-1 flex overflow-hidden">

        {/* 对话列表面板（点击历史按钮展开） */}
        {showConversations && (
          <div
            className="w-[240px] flex-shrink-0 border-r overflow-y-auto px-2 py-2 space-y-1"
            style={{ borderColor: appTheme.divider, backgroundColor: appTheme.canvasParchment }}
          >
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => { selectConversation(conv.id); setShowConversations(false); }}
                className="group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                style={{
                  backgroundColor: currentConversation === conv.id ? appTheme.primary + '14' : 'transparent',
                  color: currentConversation === conv.id ? appTheme.ink : appTheme.inkMuted48,
                }}
                onMouseEnter={(e) => {
                  if (currentConversation !== conv.id) e.currentTarget.style.backgroundColor = s(0.05);
                }}
                onMouseLeave={(e) => {
                  if (currentConversation !== conv.id) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <MessageSquare size={14} className="flex-shrink-0" />
                <span className="flex-1 text-sm truncate">{conv.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                  style={{ color: appTheme.inkMuted48 }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 内容区 */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ====== 收藏详情 ====== */}
          {viewMode === 'favorites' && selectedFav && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-6 py-3 flex items-center gap-3" style={{ borderBottom: `0.5px solid ${appTheme.divider}` }}>
                <button onClick={() => setSelectedFavorite(null)} className="p-1.5 rounded-lg btn-press" style={{ color: appTheme.inkMuted48 }}>
                  <ArrowLeft size={16} />
                </button>
                <div className="flex-1 min-w-0">
                  {selectedFav.conversation_title && (
                    <span className="text-sm truncate block" style={{ color: appTheme.inkMuted48 }}>{selectedFav.conversation_title}</span>
                  )}
                </div>
                <button onClick={() => setViewMode('chat')} className="p-1.5 rounded-lg btn-press" style={{ color: appTheme.inkMuted48 }}>
                  &times;
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
                <div className="max-w-[700px] mx-auto">
                  <div className="chat-bubble px-4 py-3 rounded-2xl text-sm leading-relaxed" style={{ backgroundColor: s(0.05), color: appTheme.ink }}>
                    {selectedFav.role === 'conversation' ? (
                      <Markdown remarkPlugins={[remarkGfm]}>{selectedFav.content}</Markdown>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: selectedFav.role === 'user' ? `${appTheme.primary}25` : s(0.08), color: selectedFav.role === 'user' ? appTheme.primary : appTheme.inkMuted48 }}>
                            {selectedFav.role === 'user' ? '你' : '提灯'}
                          </span>
                          <span className="text-[10px]" style={{ color: appTheme.inkMuted48 }}>
                            {new Date(selectedFav.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <Markdown remarkPlugins={[remarkGfm]}>{selectedFav.content}</Markdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====== 收藏列表 ====== */}
          {viewMode === 'favorites' && !selectedFav && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {favorites.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full" style={{ color: appTheme.inkMuted48 }}>
                    <Bookmark size={40} className="mb-4 opacity-30" />
                    <p className="text-sm">还没有收藏</p>
                    <p className="text-xs mt-1 opacity-60">hover 任意消息点击星标即可收藏</p>
                  </div>
                ) : (
                  <div className="max-w-[700px] mx-auto px-4 sm:px-8 py-6 space-y-2">
                    {favorites.map((fav) => (
                      <div
                        key={fav.id}
                        onClick={() => setSelectedFavorite(fav.id)}
                        className="group rounded-xl p-3 cursor-pointer transition-colors"
                        style={{ backgroundColor: s(0.03) }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = s(0.06); }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = s(0.03); }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            {fav.conversation_title && (
                              <div className="text-xs mb-1 truncate" style={{ color: appTheme.inkMuted48 }}>{fav.conversation_title}</div>
                            )}
                            <div className="text-sm leading-relaxed line-clamp-3" style={{ color: s(0.65) }}>
                              {fav.content.slice(0, 250)}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteFavorite(fav.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded flex-shrink-0 transition-opacity"
                            style={{ color: appTheme.inkMuted48 }}
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: fav.role === 'user' ? `${appTheme.primary}25` : s(0.06), color: fav.role === 'user' ? appTheme.primary : appTheme.inkMuted48 }}>
                            {fav.role === 'user' ? '你' : fav.role === 'conversation' ? '对话' : '提灯'}
                          </span>
                          <span className="text-[10px]" style={{ color: appTheme.inkMuted48 }}>
                            {new Date(fav.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ====== 小本本 ====== */}
          {viewMode === 'memories' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 类型筛选栏 */}
              <div className="flex-shrink-0 px-4 sm:px-6 py-2 flex gap-2 overflow-x-auto" style={{ borderBottom: `0.5px solid ${appTheme.divider}` }}>
                {[
                  { key: null, label: '全部', icon: '📒' },
                  ...ALL_TYPES.map(tp => ({ key: tp, label: MEMORY_TYPE_LABELS[tp], icon: MEMORY_TYPE_ICONS[tp] })),
                ].map(pill => {
                  const isActive = selectedType === pill.key;
                  return (
                    <button
                      key={pill.key ?? '__all__'}
                      onClick={() => setSelectedType(pill.key)}
                      className="flex items-center gap-1 px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all btn-press"
                      style={{
                        backgroundColor: isActive ? appTheme.primary : 'transparent',
                        color: isActive ? '#fff' : appTheme.inkMuted48,
                        border: `1px solid ${isActive ? appTheme.primary : appTheme.hairline}`,
                      }}
                    >
                      <span>{pill.icon}</span>
                      <span>{pill.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto">
                {memoriesLoading ? (
                  <div className="flex items-center justify-center h-40" style={{ color: appTheme.inkMuted48 }}>加载中...</div>
                ) : memories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: appTheme.inkMuted48 }}>
                    <span className="text-3xl">📒</span>
                    <p className="text-sm text-center">
                      提灯还没有在小本本里写任何东西。<br />
                      当你在对话中提到值得记住的事，提灯会帮你记下来。
                    </p>
                  </div>
                ) : (
                  <div className="max-w-[700px] mx-auto px-4 sm:px-8 py-4 space-y-5">
                    {(() => {
                      const grouped = groupByType(memories);
                      return ALL_TYPES.map(tp => {
                        const items = grouped.get(tp);
                        if (!items || items.length === 0) return null;
                        return (
                          <div key={tp}>
                            <h4 className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: appTheme.inkMuted48 }}>
                              <span>{MEMORY_TYPE_ICONS[tp]}</span>
                              <span>{MEMORY_TYPE_LABELS[tp]}</span>
                              <span>({items.length})</span>
                            </h4>
                            <div className="space-y-2">
                              {items.map(m => (
                                <div key={m.id} className="rounded-xl p-3 transition-colors" style={{ backgroundColor: s(0.03) }}>
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="flex-1 text-sm leading-relaxed" style={{ color: s(0.75) }}>{m.content}</p>
                                    <button onClick={() => setConfirmDelete(m.id)} className="p-1 rounded opacity-30 hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: appTheme.danger }}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                  {m.source_text && (
                                    <div className="mt-1.5">
                                      <button onClick={() => toggleSource(m.id)} className="flex items-center gap-1 text-[11px] opacity-40 hover:opacity-70 transition-opacity" style={{ color: appTheme.inkMuted48 }}>
                                        {expandedSources.has(m.id) ? <ChevronUp size={10} /> : <ChevronDown size={10} />} 来源
                                      </button>
                                      {expandedSources.has(m.id) && (
                                        <p className="mt-1 text-[11px] px-2.5 py-1.5 rounded-lg opacity-60" style={{ backgroundColor: s(0.04), color: appTheme.inkMuted48 }}>
                                          {m.source_text}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  <div className="mt-1 text-[10px] opacity-30" style={{ color: appTheme.inkMuted48 }}>
                                    {formatRelativeTime(m.created_at)}
                                  </div>
                                  {confirmDelete === m.id && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <span className="text-[11px] opacity-50" style={{ color: appTheme.inkMuted48 }}>确定删除？</span>
                                      <button onClick={() => handleDeleteMemory(m.id)} className="px-2.5 py-0.5 rounded text-[11px] text-white" style={{ backgroundColor: appTheme.danger }}>确认</button>
                                      <button onClick={() => setConfirmDelete(null)} className="px-2.5 py-0.5 rounded text-[11px]" style={{ backgroundColor: s(0.06), color: appTheme.inkMuted48 }}>取消</button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ====== 对话视图 ====== */}
          {viewMode === 'chat' && (
            <ChatView
              s={s}
              t={t}
              input={input}
              setInput={setInput}
              inputRef={inputRef}
              messagesEndRef={messagesEndRef}
              handleSend={handleSend}
              handleKeyDown={handleKeyDown}
            />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
