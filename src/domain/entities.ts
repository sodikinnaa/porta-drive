export interface User {
  id: number;
  username: string;
  password_hash: string;
  gemini_api_key?: string | null;
  provider: string;
  openai_api_key?: string | null;
  openai_base_url?: string | null;
  openai_model?: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: number;
  title: string;
  folder_id?: string | null;
  folder_name?: string | null;
  created_at: string;
}

export interface Message {
  id?: number;
  conversation_id: string;
  role: string; // 'user', 'model', 'function'
  content: string | null;
  toolCalls?: any[] | null;
  created_at?: string;
}
