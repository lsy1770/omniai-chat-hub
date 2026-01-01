import React, { useState, useEffect } from 'react';
import { X, Save, Key, ShieldCheck, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useToastStore } from '../../store/useToastStore';

// 拟物化样式常量
const neuPanel = "bg-light dark:bg-dark shadow-neu-light dark:shadow-neu-dark rounded-3xl";
const neuInput = "w-full bg-light dark:bg-dark rounded-xl px-4 py-3 outline-none text-gray-600 dark:text-gray-300 shadow-neu-pressed-light dark:shadow-neu-pressed-dark placeholder-gray-400 transition-all focus:text-blue-500";
const neuBtn = "px-6 py-2 rounded-xl font-bold text-gray-500 dark:text-gray-400 shadow-neu-light dark:shadow-neu-dark active:shadow-neu-pressed-light dark:active:shadow-neu-pressed-dark active:scale-95 transition-all hover:text-blue-500 dark:hover:text-blue-400";
const neuBtnPrimary = "px-6 py-2 rounded-xl font-bold text-blue-500 shadow-neu-light dark:shadow-neu-dark active:shadow-neu-pressed-light dark:active:shadow-neu-pressed-dark active:scale-95 transition-all";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// API密钥验证函数（仅检查非空，支持自建服务）
const validateApiKey = (_provider: string, key: string): { valid: boolean; message?: string } => {
  if (!key.trim()) {
    return { valid: false, message: '密钥不能为空' };
  }

  // 对于自建服务，密钥格式可能完全不同，只验证非空即可
  return { valid: true };
};

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { apiKeys, setApiKey } = useSettingsStore();
  const { addToast } = useToastStore();

  // 本地状态
  const [localKeys, setLocalKeys] = useState({
    openai: '',
    anthropic: '',
    google: '',
  });

  const [validation, setValidation] = useState<Record<string, { valid: boolean; message?: string }>>({});

  // Escape键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // 每次打开弹窗时，同步 store 里的 key 到本地状态
  useEffect(() => {
    if (isOpen) {
      setLocalKeys({
        openai: apiKeys.openai || '',
        anthropic: apiKeys.anthropic || '',
        google: apiKeys.google || '',
      });
      setValidation({});
    }
  }, [isOpen, apiKeys]);

  if (!isOpen) return null;

  const handleKeyChange = (provider: 'openai' | 'anthropic' | 'google', value: string) => {
    setLocalKeys(prev => ({ ...prev, [provider]: value }));

    // 实时验证
    if (value.trim()) {
      const result = validateApiKey(provider, value);
      setValidation(prev => ({ ...prev, [provider]: result }));
    } else {
      setValidation(prev => ({ ...prev, [provider]: { valid: true } })); // 空值不显示错误
    }
  };

  const handleSave = () => {
    // 保存前验证所有非空密钥
    let hasError = false;
    const newValidation: typeof validation = {};

    Object.entries(localKeys).forEach(([provider, key]) => {
      if (key.trim()) {
        const result = validateApiKey(provider, key);
        newValidation[provider] = result;
        if (!result.valid) hasError = true;
      }
    });

    setValidation(newValidation);

    if (hasError) {
      addToast('请修正密钥格式错误', 'error', 3000);
      return;
    }

    // 保存到store
    setApiKey('openai', localKeys.openai);
    setApiKey('anthropic', localKeys.anthropic);
    setApiKey('google', localKeys.google);

    addToast('设置已保存', 'success', 2000);
    onClose();
  };

  return (
    // 背景遮罩 (使用 backdrop-blur 增加磨砂感)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-light/30 dark:bg-dark/30 backdrop-blur-sm p-4 animate-fade-in">
      
      {/* 弹窗主体 - 凸起的拟物卡片 */}
      <div className={`${neuPanel} w-full max-w-md p-8 relative animate-slide-up`}>
        
        {/* 标题栏 */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full shadow-neu-light dark:shadow-neu-dark flex items-center justify-center text-blue-500">
              <ShieldCheck size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-600 dark:text-gray-200">
              API Configuration
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full shadow-neu-light dark:shadow-neu-dark active:shadow-neu-pressed-light dark:active:shadow-neu-pressed-dark flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="space-y-6">

          {/* 安全警告 */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-800 dark:text-yellow-300 space-y-1">
                <p className="font-bold">安全提示</p>
                <p>• API密钥以明文形式存储在浏览器localStorage中</p>
                <p>• 请勿在不受信任的设备上使用</p>
                <p>• 建议定期更换API密钥</p>
              </div>
            </div>
          </div>

          {/* OpenAI API Key */}
          <div className="space-y-2">
            <label className="ml-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Key size={12} /> OpenAI API Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={localKeys.openai}
                onChange={(e) => handleKeyChange('openai', e.target.value)}
                placeholder="sk-..."
                className={`${neuInput} pl-10 tracking-widest ${
                  validation.openai && !validation.openai.valid ? 'ring-2 ring-red-500' : ''
                }`}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Key size={16} />
              </div>
              {validation.openai && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {validation.openai.valid ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <XCircle size={16} className="text-red-500" />
                  )}
                </div>
              )}
            </div>
            {validation.openai && !validation.openai.valid && (
              <p className="ml-2 text-xs text-red-500">{validation.openai.message}</p>
            )}
          </div>

          {/* Anthropic API Key */}
          <div className="space-y-2">
            <label className="ml-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Key size={12} /> Anthropic (Claude) API Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={localKeys.anthropic}
                onChange={(e) => handleKeyChange('anthropic', e.target.value)}
                placeholder="sk-ant-..."
                className={`${neuInput} pl-10 tracking-widest ${
                  validation.anthropic && !validation.anthropic.valid ? 'ring-2 ring-red-500' : ''
                }`}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Key size={16} />
              </div>
              {validation.anthropic && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {validation.anthropic.valid ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <XCircle size={16} className="text-red-500" />
                  )}
                </div>
              )}
            </div>
            {validation.anthropic && !validation.anthropic.valid && (
              <p className="ml-2 text-xs text-red-500">{validation.anthropic.message}</p>
            )}
          </div>

          {/* Google API Key */}
          <div className="space-y-2">
            <label className="ml-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Key size={12} /> Google (Gemini) API Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={localKeys.google}
                onChange={(e) => handleKeyChange('google', e.target.value)}
                placeholder="AIza..."
                className={`${neuInput} pl-10 tracking-widest ${
                  validation.google && !validation.google.valid ? 'ring-2 ring-red-500' : ''
                }`}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Key size={16} />
              </div>
              {validation.google && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {validation.google.valid ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <XCircle size={16} className="text-red-500" />
                  )}
                </div>
              )}
            </div>
            {validation.google && !validation.google.valid && (
              <p className="ml-2 text-xs text-red-500">{validation.google.message}</p>
            )}
          </div>

          {/* 安全提示 */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400 leading-relaxed">
              <ShieldCheck size={12} className="inline mr-1" />
              密钥存储在浏览器的localStorage中，仅用于API请求，不会发送到第三方服务器。
            </p>
          </div>

        </div>

        {/* 底部按钮 */}
        <div className="mt-10 flex justify-end gap-4">
          <button 
            onClick={onClose}
            className={neuBtn}
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className={neuBtnPrimary}
          >
            <span className="flex items-center gap-2">
              <Save size={18} /> Save Access
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};