import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, MessageSquare, Bookmark, BookOpen, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PageContainer } from '@/components/layout';
import { NavBar } from '@/components/ui';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ChatView } from '@/components/ai/ChatView';
import { EmptyFavorites } from '@/components/ai/EmptyFavorites';
import { EmptyMemories } from '@/components/ai/EmptyMemories';
import { KeyboardShortcutsHelp } from '@/components/ai/KeyboardShortcutsHelp';
import { useAiStore } from '@/stores/aiStore';
import { useFavoriteStore } from '@/stores/favoriteStore';
import { useMemoryStore } from '@/stores/memoryStore';
import { useAppTheme, useThemeHelpers, useThemeStore, withAlpha } from '@/stores/themeStore';
import { useUIStore } from '@/stores/uiStore';
import type { PageTheme } from '@/styles/theme';
import { MEMORY_TYPE_LABELS, MEMORY_TYPE_ICONS } from '@/types/memory';
import type { Memory } from '@/types/memory';
import { formatRelativeTime } from '@/utils/dateFormat';

const ALL_TYPES = ['identity', 'interest', 'taste', 'habit', 'personality', 'relationship', 'status', 'goal', 'event', 'other'] as const;

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

  const activeTab = useUIStore((s) => s.activeTab);
  const themeMode = useThemeStore((s) => s.mode);
  const t: PageTheme = {
    id: 'lantern', name: '提灯',
    bg: appTheme.canvas, nav: appTheme.surfaceBlack,
    accent: appTheme.primary, accentLight: `${withAlpha(appTheme.primary, 0.2)}`,
    text: appTheme.ink, card: appTheme.canvas, cardText: appTheme.ink,
    isDark: themeMode === 'dark', danger: appTheme.danger, warning: appTheme.warning, success: appTheme.success,
  };

  const {
    conversations,
    currentConversation,
    isSending,
    pendingImages,
    fetchConversations,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
  } = useAiStore();

  const {
    favorites,
    fetchFavorites,
    deleteFavorite,
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
  const isMobile = useIsMobile();

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
    if (activeTab === 'chat') {
      fetchConversations();
      fetchFavorites();
    }
  }, [activeTab]);

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || isSending) return;
    setInput('');

    let convId = currentConversation;
    if (!convId) {
      const title = text ? text.slice(0, 20) : '图片对话';
      convId = await createConversation(title);
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

  // 键盘快捷键支持
  useKeyboardShortcuts({
    enabled: viewMode === 'chat',
    onSend: handleSend,
    onClose: () => {
      if (showConversations) {
        setShowConversations(false);
      } else if (selectedFavorite) {
        setSelectedFavorite(null);
      } else if (confirmDelete) {
        setConfirmDelete(null);
      }
    },
    onFocusInput: () => {
      inputRef.current?.focus();
    },
    onNewConversation: handleNewConversation,
    onPrevConversation: () => {
      if (!currentConversation || conversations.length === 0) return;
      const currentIndex = conversations.findIndex(c => c.id === currentConversation);
      if (currentIndex > 0) {
        selectConversation(conversations[currentIndex - 1].id);
      }
    },
    onNextConversation: () => {
      if (!currentConversation || conversations.length === 0) return;
      const currentIndex = conversations.findIndex(c => c.id === currentConversation);
      if (currentIndex < conversations.length - 1) {
        selectConversation(conversations[currentIndex + 1].id);
      }
    },
  });

  const isMac = navigator.platform.toLowerCase().includes('mac');
  const modifier = isMac ? '⌘' : 'Ctrl';

  return (
    <PageContainer className="relative flex flex-col">
      <NavBar title="提灯" />

      {/* 工具栏 */}
      <div
        className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 flex-shrink-0"
        style={{ borderBottom: `0.5px solid ${appTheme.hairline}` }}
      >
        {/* 对话列表切换 */}
        <button
          onClick={() => { setShowConversations(!showConversations); setViewMode('chat'); }}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-full text-sm transition-all btn-press min-w-[44px] min-h-[44px]"
          style={{
            backgroundColor: showConversations ? s(0.08) : 'transparent',
            color: appTheme.inkMuted48,
          }}
          aria-label="历史对话"
          title="历史"
        >
          <MessageSquare size={16} />
          <span className="hidden sm:inline">历史</span>
        </button>

        <div className="flex-1" />

        {/* 移动端：紧凑图标按钮；桌面端：文字+图标 */}
        <button
          onClick={() => switchView('favorites')}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-full text-sm transition-all btn-press min-w-[44px] min-h-[44px]"
          style={{
            backgroundColor: viewMode === 'favorites' ? withAlpha(appTheme.primary, 0.08) : 'transparent',
            color: viewMode === 'favorites' ? appTheme.primary : appTheme.inkMuted48,
          }}
          aria-label="收藏"
          title="收藏"
        >
          <Bookmark size={16} />
          <span className="hidden sm:inline">收藏</span>
        </button>
        <button
          onClick={() => switchView('memories')}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-full text-sm transition-all btn-press min-w-[44px] min-h-[44px]"
          style={{
            backgroundColor: viewMode === 'memories' ? withAlpha(appTheme.primary, 0.08) : 'transparent',
            color: viewMode === 'memories' ? appTheme.primary : appTheme.inkMuted48,
          }}
          aria-label="笔记"
          title="笔记"
        >
          <BookOpen size={16} />
          <span className="hidden sm:inline">笔记</span>
        </button>
        <button
          onClick={handleNewConversation}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-full text-sm transition-all btn-press min-w-[44px] min-h-[44px]"
          style={{
            backgroundColor: viewMode === 'chat' ? withAlpha(appTheme.primary, 0.08) : 'transparent',
            color: viewMode === 'chat' ? appTheme.primary : appTheme.inkMuted48,
          }}
          aria-label="新对话"
          title={`新对话 (${modifier}+N)`}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">新对话</span>
        </button>

        {/* 快捷键帮助提示（仅对话模式） */}
        {viewMode === 'chat' && (
          <KeyboardShortcutsHelp />
        )}
      </div>

      {/* 主内容区 */}
      <div className="relative z-10 flex-1 flex overflow-hidden">

        {/* 移动端遮罩层 */}
        {isMobile && showConversations && (
          <div
            className="absolute inset-0 z-20"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={() => setShowConversations(false)}
          />
        )}

        {/* 对话列表面板 */}
        {showConversations && (
          <div
            className={`${isMobile ? 'absolute left-0 top-0 bottom-0 z-30 shadow-xl' : 'w-[240px] flex-shrink-0 border-r'} overflow-y-auto px-2 py-2 space-y-1`}
            style={{ width: isMobile ? 260 : 240, borderColor: appTheme.divider, backgroundColor: appTheme.canvasParchment }}
          >
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => { selectConversation(conv.id); setShowConversations(false); }}
                className="group flex items-center gap-2 px-3 py-3 rounded-lg cursor-pointer transition-colors min-h-[48px]"
                style={{
                  backgroundColor: currentConversation === conv.id ? withAlpha(appTheme.primary, 0.08) : 'transparent',
                  color: currentConversation === conv.id ? appTheme.ink : appTheme.inkMuted48,
                }}
                onMouseEnter={(e) => {
                  if (currentConversation !== conv.id) e.currentTarget.style.backgroundColor = s(0.05);
                }}
                onMouseLeave={(e) => {
                  if (currentConversation !== conv.id) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <MessageSquare size={16} className="flex-shrink-0" />
                <span className="flex-1 text-sm truncate">{conv.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="sm:opacity-0 sm:group-hover:opacity-100 p-2 rounded-lg transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center"
                  style={{ color: appTheme.inkMuted48 }}
                  aria-label="删除对话"
                  title="删除"
                >
                  <Trash2 size={14} />
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
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: selectedFav.role === 'user' ? `${withAlpha(appTheme.primary, 0.15)}` : s(0.08), color: selectedFav.role === 'user' ? appTheme.primary : appTheme.inkMuted48 }}>
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
                <EmptyFavorites />
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
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: fav.role === 'user' ? `${withAlpha(appTheme.primary, 0.15)}` : s(0.06), color: fav.role === 'user' ? appTheme.primary : appTheme.inkMuted48 }}>
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

          {/* ====== 笔记 ====== */}
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
                        color: isActive ? appTheme.onPrimary : appTheme.inkMuted48,
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
                  <EmptyMemories />
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
              isMobile={isMobile}
            />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
