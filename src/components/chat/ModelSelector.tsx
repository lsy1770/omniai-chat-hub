import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { ModelIcon } from '../ui/ModelIcon';
import { ChevronDown, Check, Search, Loader2, RefreshCw } from 'lucide-react';

export const ModelSelector = () => {
  const { availableModels, currentModelId, setCurrentModel, sessions, currentSessionId, isLoadingModels, refreshModels } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 获取当前会话使用的模型
  const activeSession = sessions.find(s => s.id === currentSessionId);
  const displayModelId = activeSession?.modelId || currentModelId;

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    setCurrentModel(id);
    setIsOpen(false);
  };

  // 过滤模型
  const filteredModels = availableModels.filter(m => 
    m.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 获取厂商名称
  const getProviderName = (id: string) => {
    if (id.includes('gpt') || id.includes('o1-')) return 'OpenAI';
    if (id.includes('claude')) return 'Anthropic';
    if (id.includes('gemini') || id.includes('goog')) return 'Google';
    if (id.includes('llama') || id.includes('meta')) return 'Meta';
    return 'Provider';
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      
      {/* --- 触发按钮 (凸起效果) --- */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-4 px-6 py-3 rounded-2xl transition-all duration-300
          bg-light dark:bg-dark text-gray-700 dark:text-gray-100
          ${isOpen 
            ? 'shadow-neu-pressed-light dark:shadow-neu-pressed-dark text-blue-500' // 打开时凹陷
            : 'shadow-neu-light dark:shadow-neu-dark hover:-translate-y-0.5' // 关闭时凸起
          }
        `}
      >
        <div className="w-8 h-8 flex items-center justify-center">
          <ModelIcon modelId={displayModelId} className="w-6 h-6" />
        </div>

        <div className="flex flex-col items-start text-left min-w-[120px]">
          <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-0.5">
            Current Model
          </span>
          <span className="text-base font-black truncate max-w-[140px] leading-tight">
            {displayModelId}
          </span>
        </div>

        <ChevronDown 
          size={20} 
          className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} 
        />
      </button>

      {/* --- 下拉面板 (浮动层) --- */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-4 w-[320px] bg-light dark:bg-dark rounded-3xl shadow-neu-light dark:shadow-neu-dark p-4 animate-slide-up border border-white/20 dark:border-black/20">
          
          {/* 搜索框 (凹陷效果) */}
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search models..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-light dark:bg-dark rounded-xl px-10 py-3 text-sm font-medium outline-none shadow-neu-pressed-light dark:shadow-neu-pressed-dark text-gray-700 dark:text-gray-200 placeholder-gray-400"
            />
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          {/* 模型列表 (垂直滚动) */}
          <div className="max-h-[300px] overflow-y-auto neu-scroll space-y-3 pr-2">
            {isLoadingModels ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-blue-500" size={24} />
                <span className="text-sm text-gray-400">Loading models...</span>
              </div>
            ) : filteredModels.length === 0 ? (
               <div className="py-8 flex flex-col items-center justify-center gap-3">
                 <span className="text-sm text-gray-400 text-center">
                   {availableModels.length === 0 ? 'No models available' : 'No models found'}
                 </span>
                 {availableModels.length === 0 && (
                   <button
                     onClick={() => refreshModels()}
                     className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                     aria-label="Retry loading models"
                   >
                     <RefreshCw size={14} />
                     Retry
                   </button>
                 )}
               </div>
            ) : (
              filteredModels.map((model) => {
                const isSelected = displayModelId === model.id;
                const provider = getProviderName(model.id);

                return (
                  <button
                    key={model.id}
                    onClick={() => handleSelect(model.id)}
                    className={`
                      w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-200 group relative overflow-hidden
                      ${isSelected 
                        ? 'shadow-neu-pressed-light dark:shadow-neu-pressed-dark' // 选中：凹陷
                        : 'hover:shadow-neu-light dark:hover:shadow-neu-dark hover:-translate-y-[1px]' // 未选中：悬浮凸起
                      }
                    `}
                  >
                    {/* 选中时的蓝色光晕背景 */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/5 dark:bg-blue-500/10 pointer-events-none" />
                    )}

                    {/* 图标 */}
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all
                      ${isSelected 
                        ? 'text-blue-500 scale-110' 
                        : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                      }
                    `}>
                      <ModelIcon modelId={model.id} className="w-6 h-6" />
                    </div>

                    {/* 文本信息 */}
                    <div className="flex-1 text-left min-w-0 flex flex-col justify-center">
                      <span className={`
                        text-sm font-bold truncate leading-tight
                        ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}
                      `}>
                        {model.id}
                      </span>
                      <span className="text-[11px] font-medium text-gray-400 mt-0.5 flex items-center gap-1">
                        {provider}
                      </span>
                    </div>

                    {/* 选中标记 */}
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-blue-500 shadow-neu-light dark:shadow-neu-dark flex items-center justify-center shrink-0">
                         <Check size={14} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};