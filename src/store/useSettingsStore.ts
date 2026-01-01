import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  proxyUrl: string;
  apiKeys: {
    openai: string;
    anthropic: string;
    google: string;
    // ... 其他厂商
  };
  setProxyUrl: (url: string) => void;
  setApiKey: (provider: keyof SettingsState['apiKeys'], key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // 代理服务地址（相对路径，通过 Nginx 反向代理到后端）
      proxyUrl: '/v1/chat/completions',
      apiKeys: {
        openai: '',
        anthropic: '',
        google: '',
      },
      setProxyUrl: (url) => set({ proxyUrl: url }),
      setApiKey: (provider, key) => 
        set((state) => ({ 
          apiKeys: { ...state.apiKeys, [provider]: key } 
        })),
    }),
    {
      name: 'omniai-settings', // localStorage key
    }
  )
);