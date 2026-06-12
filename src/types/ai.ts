/** 对应后端 ai_repo::Conversation */
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

/** 对应后端 ai_repo::Message */
export interface AiMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
  reasoning_content?: string | null;
  images?: string | null;  // JSON 数组字符串，存储 base64 图片数据
  created_at: string;
}

// ========== 工具调用相关类型 ==========

/** AI 返回的单个 tool_call */
export interface ToolCallDef {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string; // JSON string of params
  };
}

/** create_task 工具的参数（从 arguments JSON 解析） */
export interface CreateTaskParams {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low' | 'none';
  scheduled_at?: string;
  deadline?: string;
  estimated_minutes?: number;
  notes?: string;
  tags?: string;
}

/** complete_task / delete_task / search_tasks 共用的查询参数 */
export interface QueryParams {
  query: string;
}

/** search_tasks 工具的参数 */
export interface SearchTasksParams {
  query?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}
