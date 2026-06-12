import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';
import type { Conversation, AiMessage } from '@/types/ai';
import { parseToolCalls } from '@/utils/aiParsers';
import * as aiService from '@/services/aiService';
import { triggerSync } from '@/stores/syncStore';

/** 用于中断正在进行的 AI 请求 */
let sendAbortController: AbortController | null = null;

interface AiState {
  conversations: Conversation[];
  currentConversation: string | null;
  messages: AiMessage[];
  isLoading: boolean;
  isSending: boolean;
  isExecuting: boolean;
  error: string | null;
  /** 当前 AI 处理状态文本（如"正在理解..."、"正在输入中..."） */
  aiStatus: string;
  /** 流式接收中的内容 */
  streamingContent: string;
  /** 是否正在流式接收 token */
  isStreaming: boolean;
  /** 待发送的图片列表（base64 data URIs） */
  pendingImages: string[];

  fetchConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  addPendingImages: (images: string[]) => void;
  removePendingImage: (index: number) => void;
  clearPendingImages: () => void;
  executeToolCalls: (messageId: string) => Promise<void>;
  executeSingleToolCall: (messageId: string, toolCallId: string) => Promise<void>;
  cancelToolCalls: (messageId: string, toolCallId?: string) => Promise<void>;
  modifyToolCalls: (feedback: string, messageId?: string, toolCallId?: string) => Promise<void>;
  clearError: () => void;
}

export const useAiStore = create<AiState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  isSending: false,
  isExecuting: false,
  error: null,
  aiStatus: '',
  streamingContent: '',
  isStreaming: false,
  pendingImages: [],

  fetchConversations: async () => {
    try {
      const conversations = await aiService.listConversations();
      set({ conversations });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  createConversation: async (title?: string) => {
    const conv = await aiService.createConversation(title);
    set((state) => ({
      conversations: [conv, ...state.conversations],
      currentConversation: conv.id,
      messages: [],
    }));
    triggerSync();
    return conv.id;
  },

  selectConversation: async (id: string) => {
    set({ currentConversation: id, isLoading: true, error: null });
    try {
      const messages = await aiService.listMessages(id);
      set({ messages, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await aiService.deleteConversation(id);
      const { currentConversation } = get();
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        ...(currentConversation === id
          ? { currentConversation: null, messages: [] }
          : {}),
      }));
      triggerSync();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  sendMessage: async (content: string) => {
    const { currentConversation, pendingImages } = get();
    if (!currentConversation) return;
    if (!content.trim() && pendingImages.length === 0) return;

    // 中断之前的请求（如果有）
    sendAbortController?.abort();
    sendAbortController = new AbortController();
    const thisController = sendAbortController;

    // 取出待发送的图片并清空
    const imagesToSend = pendingImages.length > 0 ? [...pendingImages] : undefined;
    set({ pendingImages: [] });

    // 乐观更新：立即显示用户消息
    const userMsg: AiMessage = {
      id: 'temp-user-' + Date.now(),
      conversation_id: currentConversation,
      role: 'user',
      content,
      tool_calls: null,
      tool_call_id: null,
      images: imagesToSend ? JSON.stringify(imagesToSend) : null,
      created_at: new Date().toISOString(),
    };
    set((state) => ({
      messages: [...state.messages, userMsg],
      isSending: true,
      isStreaming: false,
      streamingContent: '',
      aiStatus: '',
      error: null,
    }));

    // 设置 Tauri 事件监听器
    const unlistenStatus = await listen<string>('ai:status', (event) => {
      if (!thisController.signal.aborted) {
        set({ aiStatus: event.payload });
      }
    });
    const unlistenToken = await listen<string>('ai:token', (event) => {
      if (!thisController.signal.aborted) {
        set((state) => ({
          streamingContent: state.streamingContent + event.payload,
          isStreaming: true,
          aiStatus: '', // 收到 token 后清除状态文本
        }));
      }
    });
    const unlistenDone = await listen('ai:done', () => {
      set({ isStreaming: false });
    });

    try {
      const aiReply = await aiService.sendMessage(currentConversation, content, imagesToSend);

      // 用户中断了，忽略结果
      if (thisController.signal.aborted) return;

      set((state) => ({
        messages: [...state.messages, aiReply],
        isSending: false,
        isStreaming: false,
        streamingContent: '',
        aiStatus: '',
      }));
      get().fetchConversations();
      triggerSync();
    } catch (e) {
      if (thisController.signal.aborted) {
        set({ isSending: false, isStreaming: false, streamingContent: '', aiStatus: '' });
        return;
      }
      set({ error: String(e), isSending: false, isStreaming: false, streamingContent: '', aiStatus: '' });
    } finally {
      // 清理事件监听器
      unlistenStatus();
      unlistenToken();
      unlistenDone();
    }
  },

  stopGeneration: () => {
    sendAbortController?.abort();
    set({ isSending: false, isStreaming: false, streamingContent: '', aiStatus: '' });
  },

  addPendingImages: (images: string[]) => {
    set((state) => ({ pendingImages: [...state.pendingImages, ...images] }));
  },

  removePendingImage: (index: number) => {
    set((state) => ({ pendingImages: state.pendingImages.filter((_, i) => i !== index) }));
  },

  clearPendingImages: () => {
    set({ pendingImages: [] });
  },

  executeToolCalls: async (messageId: string) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    set({ isExecuting: true, error: null });
    try {
      const updatedMessages = await aiService.executeToolCalls(currentConversation, messageId);
      set({ messages: updatedMessages, isExecuting: false });
    } catch (e) {
      set({ error: String(e), isExecuting: false });
    }
  },

  executeSingleToolCall: async (messageId: string, toolCallId: string) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    set({ isExecuting: true, error: null });
    try {
      let updatedMessages = await aiService.executeSingleToolCall(
        currentConversation,
        messageId,
        toolCallId,
      );

      // 检查该消息的所有 tool_calls 是否都已执行完毕
      const msg = updatedMessages.find((m) => m.id === messageId);
      if (msg?.tool_calls) {
        const toolCalls = parseToolCalls(msg.tool_calls);
        const allExecuted = toolCalls.every((tc) =>
          updatedMessages.some(
            (m) => m.role === 'tool' && m.tool_call_id === tc.id,
          ),
        );
        if (allExecuted) {
          updatedMessages = await aiService.finalizeToolCalls(currentConversation);
        }
      }

      set({ messages: updatedMessages, isExecuting: false });
    } catch (e) {
      set({ error: String(e), isExecuting: false });
    }
  },

  cancelToolCalls: async (messageId: string, toolCallId?: string) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    set({ isExecuting: true, error: null });
    try {
      const updatedMessages = await aiService.cancelToolCalls(currentConversation, messageId, toolCallId);
      set({ messages: updatedMessages, isExecuting: false });
    } catch (e) {
      set({ error: String(e), isExecuting: false });
    }
  },

  modifyToolCalls: async (feedback: string, messageId?: string, toolCallId?: string) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    set({ isExecuting: true, error: null });
    try {
      const updatedMessages = await aiService.modifyToolCalls(currentConversation, feedback, messageId, toolCallId);
      set({ messages: updatedMessages, isExecuting: false });
    } catch (e) {
      set({ error: String(e), isExecuting: false });
    }
  },

  clearError: () => set({ error: null }),
}));
