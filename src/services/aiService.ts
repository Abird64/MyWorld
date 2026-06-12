/**
 * AI 服务 - 封装所有 AI 对话相关的 Tauri 命令调用
 */
import { tauriInvoke } from './tauri';
import type { Conversation, AiMessage } from '@/types/ai';

/** 创建对话 */
export async function createConversation(title?: string): Promise<Conversation> {
  return tauriInvoke<Conversation>('create_conversation', { title: title ?? null });
}

/** 获取所有对话 */
export async function listConversations(): Promise<Conversation[]> {
  return tauriInvoke<Conversation[]>('list_conversations');
}

/** 删除对话 */
export async function deleteConversation(id: string): Promise<void> {
  return tauriInvoke<void>('delete_conversation', { id });
}

/** 重命名对话 */
export async function renameConversation(id: string, title: string): Promise<void> {
  return tauriInvoke<void>('rename_conversation', { id, title });
}

/** 获取对话的所有消息 */
export async function listMessages(conversationId: string): Promise<AiMessage[]> {
  return tauriInvoke<AiMessage[]>('list_messages', { conversationId });
}

/** 发送消息（自动调用 AI 并返回 AI 回复）。images 为 base64 图片数据数组 */
export async function sendMessage(conversationId: string, content: string, images?: string[]): Promise<AiMessage> {
  return tauriInvoke<AiMessage>('send_message', { conversationId, content, images: images ?? null });
}

/** 确认执行工具调用 → 后端执行 + AI 跟进 */
export async function executeToolCalls(
  conversationId: string,
  messageId: string,
): Promise<AiMessage[]> {
  return tauriInvoke<AiMessage[]>('execute_tool_calls', { conversationId, messageId });
}

/** 取消工具调用 → AI 跟进确认取消。toolCallId 指定则只取消那一个，否则全部取消 */
export async function cancelToolCalls(
  conversationId: string,
  messageId: string,
  toolCallId?: string,
): Promise<AiMessage[]> {
  return tauriInvoke<AiMessage[]>('cancel_tool_calls', { conversationId, messageId, toolCallId: toolCallId ?? null });
}

/** 修改工具调用 → 用户反馈 → AI 重新生成卡片。messageId/toolCallId 指定则只修改那一个卡片 */
export async function modifyToolCalls(
  conversationId: string,
  feedback: string,
  messageId?: string,
  toolCallId?: string,
): Promise<AiMessage[]> {
  return tauriInvoke<AiMessage[]>('modify_tool_calls', {
    conversationId, feedback,
    messageId: messageId ?? null,
    toolCallId: toolCallId ?? null,
  });
}

/** 执行单个工具调用（不触发 AI 跟进） */
export async function executeSingleToolCall(
  conversationId: string,
  messageId: string,
  toolCallId: string,
): Promise<AiMessage[]> {
  return tauriInvoke<AiMessage[]>('execute_single_tool_call', { conversationId, messageId, toolCallId });
}

/** 所有工具执行完毕后，触发 AI 跟进回复 */
export async function finalizeToolCalls(conversationId: string): Promise<AiMessage[]> {
  return tauriInvoke<AiMessage[]>('finalize_tool_calls', { conversationId });
}

/** 测试 AI API 连通性 */
export async function testConnection(apiUrl: string, apiKey: string, model: string): Promise<string> {
  return tauriInvoke<string>('test_ai_connection', { apiUrl, apiKey, model });
}

/** 读取聊天图片文件返回 base64 data URI */
export async function getChatImageData(filePath: string): Promise<string> {
  return tauriInvoke<string>('get_chat_image_data', { filePath });
}
