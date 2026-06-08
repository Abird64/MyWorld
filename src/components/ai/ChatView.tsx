import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Copy, StopCircle, Check, Star, ArrowUp } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LanternSvg, ShiningText, Fireflies } from '@/components/ui';
import { TypewriterText } from '@/components/ui/TypewriterText';
import { ToolCallCard } from '@/components/ai/ToolCallCard';
import { PromptPouch } from '@/components/ai/PromptPouch';
import { useAiStore } from '@/stores/aiStore';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useFavoriteStore } from '@/stores/favoriteStore';
import { parseToolCalls } from '@/utils/aiParsers';
import { BUILTIN_PROMPTS } from '@/utils/builtinPrompts';
import type { PromptTemplate } from '@/utils/builtinPrompts';
import { CREATIVITY_COLOR } from '@/styles/theme';
import type { PageTheme } from '@/styles/theme';
import type { RefObject, KeyboardEvent } from 'react';

// ── 提灯轮播语 ──
// 灵感来源：王者荣耀·桑启台词，经改编适配提灯产品语境
const LANTERN_PROMPTS = [
  // ── 萤火与故事 ──
  '将沿途的故事一一记下',
  '愿陪伴我的微光，也能照亮你的旅途',
  '你的故事，已被我记下了',
  '有故事和萤火的地方，就是家乡',
  '与萤火一起，收集更多的故事',
  '萤火虽小，愿为其芒',
  '这一页故事讲完了，让我们翻开下一页',
  '比风景更美的，是旅途中的人和故事',
  '那些曾经历的，都将变成回忆，陪伴我们继续前行',
  '当故事还在讲述，过去就还在传承',
  '将过去讲给更多人听，或许是最好的铭记',
  '你也有自己的萤火，只是暂时看不见而已',
  '就算再小的萤光，也能凝成希望',
  '故事总有结局，但那也是新故事的开始',
  '羁绊发芽，故事生长',
  '故事往往开始于相遇，但离别却并非结束',

  // ── 夜与光 ──
  '只要眼里有光，黑夜就永远不会降临',
  '越是昏暗的夜，星星就越是美丽',
  '最重要的东西，只有用心才能看见',
  '远游山川，星河在天',
  '太阳虽然下山，但青草，却在偷偷发芽',
  '太阳熄灭的时候，群星就会苏醒',
  '宇宙太黑，于是我们相互靠近，将彼此点亮',
  '你相信有永远不会熄灭的光吗？我相信',
  '萤火，就是故人的化身',
  '洒下希望的种子',
  '流光一瞬',
  '风生万物',

  // ── 前行与勇气 ──
  '最奇妙的旅行，往往开始于最不起眼的地方',
  '与其担心美好会消逝，不如先让它开始',
  '想得太多，你就会失去前行的勇气',
  '心怀希望，勇敢道别',
  '比起告别，我更害怕从未相遇',
  '没关系，过去的没了，那就再建一个新的',
  '向前看',
  '乘风启程',
  '一起去旅行吧',
  '好好享受旅行的时光吧',

  // ── 温柔日常 ──
  '来，说说你的故事',
  '提灯在此，愿闻其详',
  '别难过，被泪水洗过的眼睛，会变得更干净',
  '遇见你，感觉真好',
  '又想起了一些过去的事',
  '没什么，只是沙子迷住了眼',
  '小草萌发，天地将绿',
  '别怕，休息一下就好了',
  '一株小草，也能改变一方世界',
];

async function copyText(text: string | null) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

interface ChatViewProps {
  s: (o: number) => string;
  t: PageTheme;
  input: string;
  setInput: (v: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  handleSend: () => Promise<void>;
  handleKeyDown: (e: KeyboardEvent) => void;
  isMobile?: boolean;
}

export function ChatView({
  s,
  t,
  input,
  setInput,
  inputRef,
  messagesEndRef,
  handleSend,
  handleKeyDown,
  isMobile = false,
}: ChatViewProps) {
  const appTheme = useAppTheme();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const emptyStateRef = useRef<HTMLDivElement>(null);

  // 加载锦囊（localStorage 为单一来源，首次已由设置页播种默认值）
  const allPrompts = useMemo(() => {
    try {
      const raw = localStorage.getItem('lantern_custom_prompts');
      if (raw) {
        const prompts: PromptTemplate[] = JSON.parse(raw);
        return prompts.sort((a, b) => a.sort_order - b.sort_order);
      }
      return [...BUILTIN_PROMPTS];
    } catch {
      return [...BUILTIN_PROMPTS];
    }
  }, []);

  const {
    conversations,
    currentConversation,
    messages,
    isSending,
    isExecuting,
    error,
    aiStatus,
    streamingContent,
    isStreaming,
    stopGeneration,
    executeToolCalls,
    executeSingleToolCall,
    cancelToolCalls,
    modifyToolCalls,
    clearError,
  } = useAiStore();

  const { toggleFavorite, isFavorited } = useFavoriteStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // 锦囊/粘贴等程序化输入后自动调整 textarea 高度
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxHeight = 22 * 4 + 16;
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
  }, [input]);

  const handleCopy = useCallback(async (msgId: string, content: string | null) => {
    await copyText(content);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  return (
    <>
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {!currentConversation || messages.length === 0 ? (
          <div ref={emptyStateRef} className="h-full flex flex-col items-center justify-center relative">
            <Fireflies count={7} mouseTarget={emptyStateRef} />
            <div className="relative w-[200px] h-[240px] flex items-center justify-center mb-6">
              {!isMobile && (
                <div
                  className="absolute inset-0 blur-3xl opacity-40 rounded-full scale-110"
                  style={{ backgroundColor: `${withAlpha(t.accent, 0.2)}` }}
                />
              )}
              <LanternSvg accentColor={t.accent} isDark={t.isDark} />
            </div>
            <TypewriterText
              texts={LANTERN_PROMPTS}
              typingSpeed={70}
              deletingSpeed={30}
              pauseDuration={3500}
              className="text-lg font-light"
              style={{ color: s(0.35) }}
            />
          </div>
        ) : (
          <div className="max-w-[700px] mx-auto space-y-4">
            {messages.map((msg, i) => {
              const toolCalls = parseToolCalls(msg.tool_calls);
              const hasAiReplyAfter = messages.slice(i + 1).some(
                (m) => m.role === 'assistant' && m.content,
              );

              const isUser = msg.role === 'user';
              const isTool = msg.role === 'tool';

              return (
                <div key={msg.id}>
                  <div
                    className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[80%]">
                      <div
                        className="chat-bubble markdown-body px-4 py-3 rounded-2xl text-sm leading-relaxed"
                        style={{
                          backgroundColor: isUser
                            ? `${withAlpha(t.accent, 0.2)}`
                            : isTool
                              ? s(0.03)
                              : s(0.08),
                          color: isUser
                            ? appTheme.ink
                            : isTool
                              ? s(0.3)
                              : s(0.8),
                          borderBottomRightRadius: isUser ? '4px' : undefined,
                          borderBottomLeftRadius: !isUser ? '4px' : undefined,
                        }}
                      >
                        {msg.role === 'assistant' && msg.content ? (
                          <Markdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </Markdown>
                        ) : isTool ? (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: s(0.2) }}
                            />
                            {msg.content}
                          </div>
                        ) : (
                          msg.content || ''
                        )}
                      </div>

                      {/* 移动端：始终显示操作按钮；桌面端：hover 显示 */}
                      {(isUser || msg.role === 'assistant') && msg.content && (
                        <div
                          className={`flex items-center gap-1 mt-1 ${
                            isMobile ? '' : 'opacity-0 group-hover:opacity-100'
                          } transition-opacity ${
                            isUser ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors min-w-[44px] min-h-[44px]"
                            style={{ color: s(0.25) }}
                            onMouseEnter={(e) => {
                              if (!isMobile) {
                                e.currentTarget.style.color = s(0.6);
                                e.currentTarget.style.backgroundColor = s(0.08);
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isMobile) {
                                e.currentTarget.style.color = s(0.25);
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                            title="复制"
                            aria-label="复制消息"
                          >
                            {copiedId === msg.id ? (
                              <Check size={14} style={{ color: t.accent }} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              const title = conversations.find(
                                (c) => c.id === currentConversation,
                              )?.title;
                              toggleFavorite(
                                msg.content || '',
                                msg.role,
                                msg.id,
                                title,
                              );
                            }}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors min-w-[44px] min-h-[44px]"
                            style={{
                              color: isFavorited(msg.id)
                                ? CREATIVITY_COLOR
                                : s(0.25),
                            }}
                            onMouseEnter={(e) => {
                              if (!isMobile) {
                                e.currentTarget.style.color = CREATIVITY_COLOR;
                                e.currentTarget.style.backgroundColor = s(0.08);
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isMobile) {
                                e.currentTarget.style.color = isFavorited(msg.id)
                                  ? CREATIVITY_COLOR
                                  : s(0.25);
                                e.currentTarget.style.backgroundColor =
                                  'transparent';
                              }
                            }}
                            title={
                              isFavorited(msg.id) ? '取消收藏' : '收藏'
                            }
                            aria-label={isFavorited(msg.id) ? '取消收藏' : '收藏'}
                          >
                            <Star
                              size={14}
                              fill={
                                isFavorited(msg.id) ? CREATIVITY_COLOR : 'none'
                              }
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 工具调用确认卡片 */}
                  {(() => {
                    if (hasAiReplyAfter || toolCalls.length === 0) return null;
                    const pendingCalls = toolCalls.filter(
                      (tc) =>
                        !messages
                          .slice(i + 1)
                          .some(
                            (m) =>
                              m.role === 'tool' && m.tool_call_id === tc.id,
                          ),
                    );
                    if (pendingCalls.length === 0) return null;
                    return (
                      <div className="flex justify-start mt-2">
                        <div className="w-[320px] space-y-2">
                          {pendingCalls.length >= 2 && (
                            <button
                              onClick={() => executeToolCalls(msg.id)}
                              disabled={isExecuting}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs transition-colors disabled:opacity-50"
                              style={{
                                backgroundColor: s(0.1),
                                color: s(0.7),
                              }}
                              onMouseEnter={(e) => {
                                if (!isExecuting)
                                  e.currentTarget.style.backgroundColor =
                                    s(0.15);
                              }}
                              onMouseLeave={(e) => {
                                if (!isExecuting)
                                  e.currentTarget.style.backgroundColor =
                                    s(0.1);
                              }}
                            >
                              全部确认（{pendingCalls.length} 项）
                            </button>
                          )}
                          {toolCalls.map((tc) => {
                            const isThisDone = messages
                              .slice(i + 1)
                              .some(
                                (m) =>
                                  m.role === 'tool' &&
                                  m.tool_call_id === tc.id,
                              );
                            if (isThisDone) return null;
                            return (
                              <ToolCallCard
                                key={tc.id}
                                toolCall={tc}
                                isExecuting={isExecuting}
                                onConfirm={() =>
                                  executeSingleToolCall(msg.id, tc.id)
                                }
                                onCancel={() => cancelToolCalls(msg.id, tc.id)}
                                onModify={(feedback) =>
                                  modifyToolCalls(feedback, msg.id, tc.id)
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
            {/* 流式内容 */}
            {isStreaming && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%]">
                  <div
                    className="chat-bubble markdown-body px-4 py-3 rounded-2xl text-sm leading-relaxed"
                    style={{
                      backgroundColor: s(0.08),
                      color: s(0.8),
                      borderBottomLeftRadius: '4px',
                    }}
                  >
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {streamingContent}
                    </Markdown>
                  </div>
                </div>
              </div>
            )}
            {/* 状态指示器 */}
            {isSending && !isStreaming && (
              <div className="flex justify-start">
                <div
                  className="px-4 py-3 rounded-2xl"
                  style={{
                    backgroundColor: s(0.08),
                    borderBottomLeftRadius: '4px',
                  }}
                >
                  <ShiningText text={aiStatus || "思考中..."} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-8 mb-2 px-4 py-2 bg-red-500/20 text-red-400 text-sm rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="text-red-400/60 hover:text-red-400"
          >
            &times;
          </button>
        </div>
      )}

      {/* 底部输入区 — 通过 CSS 变量响应键盘高度 */}
      <div
        className="px-6 pt-3 flex-shrink-0"
        style={{ paddingBottom: `calc(1.5rem + var(--keyboard-height, 0px))` }}
      >
        {/* 锦囊胶囊 — 聚焦时浮现 */}
        <div
          className="max-w-[640px] mx-auto overflow-hidden transition-all duration-300 ease-out"
          style={{
            maxHeight: isInputFocused ? '48px' : '0px',
            opacity: isInputFocused ? 1 : 0,
            marginBottom: isInputFocused ? '8px' : '0px',
          }}
        >
          <PromptPouch
            prompts={allPrompts}
            onSelect={(p) => {
              setInput(p.prompt);
              inputRef.current?.focus();
            }}
          />
        </div>

        <div
          className="relative max-w-[640px] mx-auto rounded-3xl transition-shadow duration-300 group"
          style={{
            backgroundColor: `${withAlpha(appTheme.ink, 0.04)}`,
            border: `1px solid ${withAlpha(appTheme.ink, 0.08)}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 1px ${withAlpha(appTheme.primary, 0.19)}, 0 0 12px ${withAlpha(appTheme.primary, 0.09)}`;
          }}
          onMouseLeave={(e) => {
            if (document.activeElement !== inputRef.current) {
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          {/* 玻璃态背景 - 移动端不用 backdrop-filter（Android WebView CPU 渲染导致卡顿） */}
          {!isMobile && (
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            />
          )}

          <div className="relative flex items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // auto-resize: reset to 1 line, then grow to fit (max 4 lines)
                const ta = e.target;
                ta.style.height = 'auto';
                const lineHeight = 22;
                const maxHeight = lineHeight * 4 + 16;
                ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder={isSending ? '等待回复中...' : '说点什么...'}
              disabled={isSending}
              rows={1}
              className="flex-1 bg-transparent text-sm font-light pl-4 pr-2 py-3.5 resize-none overflow-y-auto disabled:opacity-50 focus:outline-none"
              style={{
                color: appTheme.ink,
                lineHeight: '22px',
                maxHeight: '104px',
              }}
              aria-label="输入消息"
              onFocus={(e) => {
                setIsInputFocused(true);
                const el = e.currentTarget.parentElement?.parentElement;
                if (el) el.style.boxShadow = `0 0 0 1px ${withAlpha(appTheme.primary, 0.25)}, 0 0 16px ${withAlpha(appTheme.primary, 0.13)}`;
              }}
              onBlur={(e) => {
                // 延迟隐藏，让锦囊点击事件先触发
                setTimeout(() => {
                  setIsInputFocused(false);
                  const el = e.currentTarget.parentElement?.parentElement;
                  if (el) el.style.boxShadow = 'none';
                }, 150);
              }}
            />

            {isSending ? (
              <button
                onClick={stopGeneration}
                className="flex-shrink-0 m-1.5 h-8 w-8 flex items-center justify-center rounded-full transition-colors bg-red-500/15 text-red-400 hover:bg-red-500/25"
                title="中断生成"
                aria-label="中断生成"
              >
                <StopCircle size={16} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex-shrink-0 m-1.5 h-8 w-8 flex items-center justify-center rounded-full transition-all"
                style={{
                  backgroundColor: input.trim() ? appTheme.primary : `${withAlpha(appTheme.ink, 0.1)}`,
                  color: input.trim() ? appTheme.onPrimary : appTheme.inkMuted48,
                  cursor: input.trim() ? 'pointer' : 'not-allowed',
                }}
                title="发送消息"
                aria-label="发送消息"
                onMouseEnter={(e) => {
                  if (input.trim())
                    e.currentTarget.style.backgroundColor = appTheme.primaryFocus;
                }}
                onMouseLeave={(e) => {
                  if (input.trim())
                    e.currentTarget.style.backgroundColor = appTheme.primary;
                }}
              >
                <ArrowUp size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
