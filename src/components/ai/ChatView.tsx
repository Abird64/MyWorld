import { useState, useEffect, useCallback, useMemo } from 'react';
import { Copy, StopCircle, Check, Star, ArrowUp } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LanternSvg, ShiningText } from '@/components/ui';
import { TypewriterText } from '@/components/ui/TypewriterText';
import { ToolCallCard } from '@/components/ai/ToolCallCard';
import { PromptPouch } from '@/components/ai/PromptPouch';
import { useAiStore } from '@/stores/aiStore';
import { useAppTheme } from '@/stores/themeStore';
import { useFavoriteStore } from '@/stores/favoriteStore';
import { parseToolCalls } from '@/utils/aiParsers';
import { BUILTIN_PROMPTS } from '@/utils/builtinPrompts';
import type { PromptTemplate } from '@/utils/builtinPrompts';
import type { PageTheme } from '@/styles/theme';
import type { RefObject, KeyboardEvent } from 'react';

const LANTERN_PROMPTS = [
  // ── 日常问候 ──
  '提灯在等你说话呢',
  '今天心情怎么样？',
  '在下提灯，有何贵干',
  '有什么想聊的吗？',
  '记录一下今天吧',
  '来，说说你的故事',
  '提灯在此，愿闻其详',
  '今天过得好吗？',
  '有什么想记下来的事吗？',
  '说点什么吧，我在听',
  '今天有什么新鲜事？',
  '想聊点什么？',
  '提灯恭候多时了',
  '来都来了，聊两句？',
  '今天有没有什么小确幸？',
  '累了就来坐坐吧',
  '有什么烦心事吗？',
  '提灯陪你聊会儿天',
  '今天学到了什么？',
  '有什么开心的事想分享？',
  '提灯在此，随时奉陪',
  '今天有没有好好吃饭？',
  '新的一天，有什么计划？',
  '提灯听你慢慢说',

  // ── 古诗词 ──
  '人生如逆旅，我亦是行人',
  '山中何事？松花酿酒，春水煎茶',
  '且将新火试新茶，诗酒趁年华',
  '浮世三千，吾爱有三：日月与卿',
  '掬水月在手，弄花香满衣',
  '行到水穷处，坐看云起时',
  '晚来天欲雪，能饮一杯无？',
  '此心安处是吾乡',
  '人间有味是清欢',
  '欲买桂花同载酒，终不似，少年游',
  '一蓑烟雨任平生',
  '吹灭读书灯，一身都是月',
  '世界微尘里，吾宁爱与憎',
  '长风破浪会有时，直挂云帆济沧海',
  '莫听穿林打叶声，何妨吟啸且徐行',
  '春风得意马蹄疾，一日看尽长安花',
  '小舟从此逝，江海寄余生',
  '但愿人长久，千里共婵娟',
  '落霞与孤鹜齐飞，秋水共长天一色',
  '采菊东篱下，悠然见南山',
  '明月松间照，清泉石上流',
  '竹杖芒鞋轻胜马，谁怕？',
  '人生天地间，忽如远行客',
  '浮生若梦，为欢几何？',
  '今人不见古时月，今月曾经照古人',
  '知否知否，应是绿肥红瘦',
  '赌书消得泼茶香，当时只道是寻常',
  '流光容易把人抛，红了樱桃，绿了芭蕉',
  '桃李春风一杯酒，江湖夜雨十年灯',
  '我见青山多妩媚，料青山见我应如是',

  // ── 哲思随想 ──
  '提灯夜行，亦是风景',
  '日拱一卒，功不唐捐',
  '慢慢来，比较快',
  '种一棵树最好的时间是十年前，其次是现在',
  '今天的你，也是独一无二的',
  '不积跬步，无以至千里',
  '每一步都算数',
  '你比你想象的更强大',
  '生活不止眼前的苟且',
  '保持热爱，奔赴山海',
  '所有的经历都是礼物',
  '慢慢走，欣赏啊',
  '星星之火，可以燎原',
  '千里之行，始于足下',
  '知行合一，方为上策',
  '既来之，则安之',
  '活在当下，便是最好',
  '万事开头难',
  '但行好事，莫问前程',
  '念念不忘，必有回响',
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
}: ChatViewProps) {
  const appTheme = useAppTheme();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // 加载锦囊（内置 + 自定义）
  const allPrompts = useMemo(() => {
    try {
      const raw = localStorage.getItem('lantern_custom_prompts');
      const custom: PromptTemplate[] = raw ? JSON.parse(raw) : [];
      return [...BUILTIN_PROMPTS, ...custom].sort((a, b) => a.sort_order - b.sort_order);
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
          <div className="h-full flex flex-col items-center justify-center">
            <div className="relative w-[200px] h-[240px] flex items-center justify-center mb-6">
              <div
                className="absolute inset-0 blur-3xl opacity-40 rounded-full scale-110"
                style={{ backgroundColor: `${t.accent}33` }}
              />
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
                            ? `${t.accent}33`
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

                      {(isUser || msg.role === 'assistant') && msg.content && (
                        <div
                          className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                            isUser ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
                            style={{ color: s(0.25) }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = s(0.6);
                              e.currentTarget.style.backgroundColor = s(0.08);
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = s(0.25);
                              e.currentTarget.style.backgroundColor =
                                'transparent';
                            }}
                            title="复制"
                          >
                            {copiedId === msg.id ? (
                              <Check size={12} style={{ color: t.accent }} />
                            ) : (
                              <Copy size={12} />
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
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
                            style={{
                              color: isFavorited(msg.id)
                                ? '#E8B959'
                                : s(0.25),
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#E8B959';
                              e.currentTarget.style.backgroundColor = s(0.08);
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = isFavorited(msg.id)
                                ? '#E8B959'
                                : s(0.25);
                              e.currentTarget.style.backgroundColor =
                                'transparent';
                            }}
                            title={
                              isFavorited(msg.id) ? '取消收藏' : '收藏'
                            }
                          >
                            <Star
                              size={12}
                              fill={
                                isFavorited(msg.id) ? '#E8B959' : 'none'
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

      {/* 底部输入区 */}
      <div className="px-6 pb-6 pt-3 flex-shrink-0">
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
            backgroundColor: `${appTheme.ink}0A`,
            border: `1px solid ${appTheme.ink}14`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 1px ${appTheme.primary}30, 0 0 12px ${appTheme.primary}18`;
          }}
          onMouseLeave={(e) => {
            if (document.activeElement !== inputRef.current) {
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          {/* 玻璃态背景 */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          />

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
              onFocus={(e) => {
                setIsInputFocused(true);
                e.currentTarget.parentElement!.parentElement!.style.boxShadow = `0 0 0 1px ${appTheme.primary}40, 0 0 16px ${appTheme.primary}20`;
              }}
              onBlur={(e) => {
                // 延迟隐藏，让锦囊点击事件先触发
                setTimeout(() => {
                  setIsInputFocused(false);
                  e.currentTarget.parentElement!.parentElement!.style.boxShadow = 'none';
                }, 150);
              }}
            />

            {isSending ? (
              <button
                onClick={stopGeneration}
                className="flex-shrink-0 m-1.5 h-8 w-8 flex items-center justify-center rounded-full transition-colors bg-red-500/15 text-red-400 hover:bg-red-500/25"
                title="中断生成"
              >
                <StopCircle size={16} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex-shrink-0 m-1.5 h-8 w-8 flex items-center justify-center rounded-full transition-all"
                style={{
                  backgroundColor: input.trim() ? appTheme.primary : `${appTheme.ink}1A`,
                  color: input.trim() ? appTheme.onPrimary : appTheme.inkMuted48,
                  cursor: input.trim() ? 'pointer' : 'not-allowed',
                }}
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
