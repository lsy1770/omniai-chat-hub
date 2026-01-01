import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ChatSession, Message } from '../types';
import { db } from '../lib/db';
import { streamCompletion, fetchModels, type ModelResponse } from '../lib/api'; // 引入新函数
import { useSettingsStore } from './useSettingsStore';
import { useToastStore } from './useToastStore';

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  currentModelId: string;
  isGenerating: boolean;
  isLoadingModels: boolean; // 新增：模型加载状态
  availableModels: ModelResponse[]; // 新增：可用模型列表
  abortController: AbortController | null; // <--- 新增：控制器实例
  // Actions
  createSession: (modelId: string) => void;
  selectSession: (sessionId: string) => void;
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => Promise<void>;
  loadSessions: () => Promise<void>;
  setCurrentModel: (modelId: string) => void;
  generateResponse: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  stopGeneration: () => void;

  // 新增 Action
  refreshModels: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  currentModelId: 'gpt-4o', // 初始默认值，稍后会被 fetch 覆盖
  isGenerating: false,
  isLoadingModels: false, // 初始化为false
  availableModels: [], // 初始为空
  abortController: null, // <--- 初始化

  refreshModels: async () => {
    const settings = useSettingsStore.getState();
    const { proxyUrl, apiKeys } = settings;
    // 假设使用 openai key 鉴权
    const apiKey = apiKeys.openai || '';

    if (!proxyUrl) return;

    set({ isLoadingModels: true }); // 开始加载

    try {
      const models = await fetchModels(proxyUrl, apiKey);
      if (models.length > 0) {
        set({ availableModels: models, isLoadingModels: false });
        // 如果当前选中的模型不在列表里，默认选中第一个
        const current = get().currentModelId;
        if (!models.find(m => m.id === current)) {
          set({ currentModelId: models[0].id });
        }
      } else {
        set({ isLoadingModels: false });
      }
    } catch (e) {
      console.error("Failed to refresh models", e);
      set({ isLoadingModels: false });
      useToastStore.getState().addToast('模型列表加载失败，请检查网络和API设置', 'warning', 4000);
    }
  },

  createSession: async (modelId) => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      modelId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.sessions.add(newSession);
    set((state) => ({ 
      sessions: [newSession, ...state.sessions],
      currentSessionId: newSession.id 
    }));
  },

  selectSession: (sessionId) => {
    const session = get().sessions.find(s => s.id === sessionId);
    if (session) {
      set({
        currentSessionId: sessionId,
        currentModelId: session.modelId  // 同步切换到该会话使用的模型
      });
    }
  },

  setCurrentModel: (modelId) => {
    const state = get();
    set({ currentModelId: modelId });

    // 同时更新当前会话的modelId
    if (state.currentSessionId) {
      const sessionIndex = state.sessions.findIndex(s => s.id === state.currentSessionId);
      if (sessionIndex !== -1) {
        const newSessions = [...state.sessions];
        newSessions[sessionIndex].modelId = modelId;
        set({ sessions: newSessions });

        // 同步更新数据库
        db.sessions.update(state.currentSessionId, { modelId });
      }
    }
  },

  loadSessions: async () => {
    const sessions = await db.sessions.orderBy('updatedAt').reverse().toArray();
    set({ sessions });
  },

  addMessage: async (sessionId, msgContent) => {
    const message: Message = {
      id: uuidv4(),
      timestamp: Date.now(),
      ...msgContent
    };

    set((state) => {
       const sessionIndex = state.sessions.findIndex(s => s.id === sessionId);
       if(sessionIndex === -1) return state;
       const newSessions = [...state.sessions];
       newSessions[sessionIndex].messages.push(message);
       newSessions[sessionIndex].updatedAt = Date.now();

       // 自动生成摘要和标题：如果是第一条用户消息
       if (!newSessions[sessionIndex].summary && message.role === 'user') {
         const summary = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
         newSessions[sessionIndex].summary = summary;

         // 同时更新标题（取前20个字符，更简洁）
         if (newSessions[sessionIndex].title === 'New Chat') {
           const title = message.content.slice(0, 20) + (message.content.length > 20 ? '...' : '');
           newSessions[sessionIndex].title = title;
         }
       }

       return { sessions: newSessions };
    });

    const session = await db.sessions.get(sessionId);
    if(session) {
      session.messages.push(message);
      session.updatedAt = Date.now();

      // 同步更新DB中的摘要和标题
      if (!session.summary && message.role === 'user') {
        session.summary = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');

        // 同时更新标题
        if (session.title === 'New Chat') {
          session.title = message.content.slice(0, 20) + (message.content.length > 20 ? '...' : '');
        }
      }

      await db.sessions.put(session);
    }
  },

 generateResponse: async (sessionId) => {
    const state = get();
    // 注意：这里的 session 是调用此方法那一刻的快照
    const session = state.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const settings = useSettingsStore.getState();
    const apiKey = settings.apiKeys.openai; 
    const proxyUrl = settings.proxyUrl;

    if (!apiKey) {
       useToastStore.getState().addToast('API密钥未配置，请在设置中添加', 'error', 4000);
       return;
    }
    const controller = new AbortController();
    
    set({ 
      isGenerating: true, 
      abortController: controller // <--- 保存控制器
    });

  

    // 1. 创建占位消息 (UI需要它，但API不需要它)
    const aiMsgId = uuidv4();
    const aiMessage: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: '', // <--- 问题就在这，UI需要空字符串开始，但API讨厌它
      timestamp: Date.now(),
      modelUsed: state.currentModelId
    };

    // 2. 更新 UI 和 DB (把空消息推入界面和数据库)
    set(s => {
      const sessIdx = s.sessions.findIndex(sess => sess.id === sessionId);
      if (sessIdx === -1) return s;
      const newSess = [...s.sessions];
      newSess[sessIdx].messages.push(aiMessage);
      return { sessions: newSess };
    });

    // 同时添加到数据库（避免onComplete时重复添加）
    const dbSession = await db.sessions.get(sessionId);
    if (dbSession) {
      dbSession.messages.push(aiMessage);
      dbSession.updatedAt = Date.now();
      await db.sessions.put(dbSession);
    }

    let fullContent = '';
    
    // 3. 发送请求
    await streamCompletion({
      // ... 其他参数不变
      url: proxyUrl,
      apiKey: apiKey,
      model: state.currentModelId,
      messages: session.messages.filter(m => m.content.trim() !== '' || (m.attachments && m.attachments.length > 0)),
      
      signal: controller.signal, // <--- 【关键】传入信号
      
      onToken: (token) => {
        fullContent += token;
        set(s => {
          // 验证会话是否仍存在
          const sessIdx = s.sessions.findIndex(sess => sess.id === sessionId);
          if (sessIdx === -1) {
            console.warn('Session deleted during generation');
            return s; // 会话已被删除，不更新
          }

          const newSess = [...s.sessions];
          const msgs = newSess[sessIdx].messages;
          const target = msgs.find(m => m.id === aiMsgId);

          // 验证消息是否仍存在
          if (!target) {
            console.warn('Message deleted during generation');
            return s; // 消息已被删除，不更新
          }

          target.content = fullContent;
          return { sessions: newSess };
        });
      },
      onComplete: async () => {
        // 完成时清空控制器
        set({ isGenerating: false, abortController: null });

        // 验证会话是否仍存在再更新DB
        const s = await db.sessions.get(sessionId);
        if (!s) {
          console.warn('Session was deleted during generation, skipping DB update');
          return; // 会话已被删除，跳过DB更新
        }

        const targetMsg = s.messages.find(m => m.id === aiMsgId);
        if (!targetMsg) {
          console.warn('Message was deleted during generation, skipping DB update');
          return; // 消息已被删除，跳过DB更新
        }

        targetMsg.content = fullContent; // 更新内容而不是push新消息
        s.updatedAt = Date.now();
        await db.sessions.put(s);
      },
      onError: (err: Error) => {
        set({ isGenerating: false, abortController: null });

        // 区分错误类型并显示相应提示
        if (err.name === 'AbortError') {
          useToastStore.getState().addToast('消息生成已取消', 'info', 2000);
        } else if (err.message?.includes('API')) {
          useToastStore.getState().addToast(`API错误: ${err.message}`, 'error', 5000);
        } else if (err.message?.includes('Network') || err.message?.includes('fetch')) {
          useToastStore.getState().addToast('网络连接失败，请检查代理设置', 'error', 5000);
        } else {
          useToastStore.getState().addToast(`发生错误: ${err.message || '未知错误'}`, 'error', 5000);
        }

        console.error('Generation error:', err);
      }
    });
  },

  // 新增：停止生成 Action
  stopGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort(); // 触发 API 层的 AbortError
      set({ isGenerating: false, abortController: null });
    }
  },

  // --- 新增：删除会话 ---
  deleteSession: async (sessionId) => {
    // 1. 保存当前状态以便回滚
    const previousState = {
      sessions: get().sessions,
      currentSessionId: get().currentSessionId
    };

    // 2. 乐观更新：先从 UI 移除
    set((state) => {
      const newSessions = state.sessions.filter(s => s.id !== sessionId);

      // 如果删除的是当前选中的会话，则重置 currentSessionId
      const newCurrentId = state.currentSessionId === sessionId
        ? null
        : state.currentSessionId;

      return {
        sessions: newSessions,
        currentSessionId: newCurrentId
      };
    });

    // 3. 数据库操作：从 IndexedDB 彻底删除
    try {
      await db.sessions.delete(sessionId);
    } catch (error) {
      console.error('Failed to delete session from DB:', error);

      // 回滚：恢复之前的状态
      set({
        sessions: previousState.sessions,
        currentSessionId: previousState.currentSessionId
      });

      // 显示错误提示
      useToastStore.getState().addToast(
        'Failed to delete session. Please try again.',
        'error',
        4000
      );
    }
  }
}));