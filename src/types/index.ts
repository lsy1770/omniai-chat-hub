export type Role = 'user' | 'assistant' | 'system';
export type ModelType = 'text' | 'image' | 'video' | 'multimodal';

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  type: ModelType;
  capabilities: string[];
  contextWindow?: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  attachments?: string[];
  timestamp: number;
  modelUsed?: string;
}

// 重点检查这一块是否存在
export interface ChatSession {
  id: string;
  title: string;
  modelId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  summary?: string; // ✅ 新增：会话摘要
}

export interface UserSettings {
  theme: 'light' | 'dark';
  apiKeys: Record<string, string>;
  proxyUrl: string;
  language: 'en' | 'zh';
}