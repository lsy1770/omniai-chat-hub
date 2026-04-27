import React, { useEffect, useState, useRef } from 'react';
import { useChatStore } from './store/useChatStore';
import { useTheme } from './hooks/useTheme';
import { MessageBubble } from './components/chat/MessageBubble';
import { SettingsModal } from './components/settings/SettingsModal';
import { ImagePreview } from './components/ui/ImagePreview';
import { ImageStudio } from './components/image/ImageStudio';
import { HtmlPreview } from './components/ui/HtmlPreview';
import { ModelSelector } from './components/chat/ModelSelector';
import { ToastContainer } from './components/ui/ToastContainer';
import {
  Plus, Settings, Send, Loader2, Moon, Sun,
  Power, MessageCircle, Paperclip, X, Square, Trash2, Menu, Image as ImageIcon
} from 'lucide-react';

const neuBtn = "flex items-center justify-center rounded-full transition-all active:scale-95 text-gray-500 dark:text-gray-400 shadow-neu-light dark:shadow-neu-dark hover:text-blue-500 dark:hover:text-blue-400";
const neuPanel = "bg-light dark:bg-dark shadow-neu-light dark:shadow-neu-dark rounded-3xl";
const neuInput = "w-full bg-light dark:bg-dark rounded-2xl px-6 py-4 outline-none text-gray-700 dark:text-gray-200 shadow-neu-pressed-light dark:shadow-neu-pressed-dark placeholder-gray-400 transition-all focus:ring-2 focus:ring-blue-500/20";

// --- 辅助函数：文件转 Base64 ---
const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

function App() {
  const {
    sessions, currentSessionId, createSession, selectSession,
    loadSessions, addMessage, generateResponse, isGenerating,
    currentModelId, refreshModels, stopGeneration, deleteSession 
  } = useChatStore();

  const { theme, toggleTheme } = useTheme();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isImageStudioOpen, setIsImageStudioOpen] = useState(false);
  const [htmlPreviewContent, setHtmlPreviewContent] = useState<string | null>(null); // HTML预览内容
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 移动端侧边栏状态

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSessions();
    refreshModels();
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [sessions, isGenerating]);

  const activeSession = sessions.find(s => s.id === currentSessionId);

  // --- 处理文件上传 ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        alert('目前仅支持图片上传');
        return;
      }

      // 验证文件大小（限制5MB）
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert(`图片大小不能超过 5MB（当前: ${(file.size / 1024 / 1024).toFixed(2)}MB）`);
        return;
      }

      try {
        const base64 = await convertFileToBase64(file);
        setAttachments(prev => [...prev, base64]);
      } catch (err) {
        console.error("File read error", err);
        alert('图片读取失败，请重试');
      }
      // 清空 input 允许重复上传同一张图
      e.target.value = '';
    }
  };

  // --- 处理粘贴 ---
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault(); // 阻止默认粘贴（避免文件名进入文本框）
        const blob = items[i].getAsFile();
        if (blob) {
          // 验证文件大小（限制5MB）
          const maxSize = 5 * 1024 * 1024;
          if (blob.size > maxSize) {
            alert(`图片大小不能超过 5MB（当前: ${(blob.size / 1024 / 1024).toFixed(2)}MB）`);
            return;
          }

          try {
            const base64 = await convertFileToBase64(blob);
            setAttachments(prev => [...prev, base64]);
          } catch (err) {
            console.error("Paste error", err);
            alert('图片粘贴失败，请重试');
          }
        }
      }
    }
  };

  const handleSend = async () => {
    // 允许仅发送图片（input 为空但 attachments 不为空）
    if ((!input.trim() && attachments.length === 0) || isGenerating) return;
    
    let sessionId = currentSessionId;
    if (!sessionId) { alert("请新建会话"); return; }
    
    const val = input;
    const currentAttachments = [...attachments]; // 复制一份附件

    setInput('');
    setAttachments([]); // 发送后清空附件

    // 存入 Store
    await addMessage(sessionId, { 
      role: 'user', 
      content: val,
      attachments: currentAttachments // 传入附件
    });

    await generateResponse(sessionId);
  };

  return (
    <div className="flex h-screen md:p-4 md:gap-6 bg-light dark:bg-dark overflow-hidden font-sans">
      <ToastContainer />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ImageStudio
        isOpen={isImageStudioOpen}
        onClose={() => setIsImageStudioOpen(false)}
        onImageClick={(src) => setPreviewImage(src)}
      />
      <ImagePreview src={previewImage} onClose={() => setPreviewImage(null)} />
      <HtmlPreview htmlContent={htmlPreviewContent} onClose={() => setHtmlPreviewContent(null)} />

      {/* 移动端遮罩层 */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 左侧边栏 */}
      <aside className={`
        ${neuPanel}
        fixed md:relative
        inset-y-0 left-0
        w-72 md:w-72
        flex flex-col py-6 px-4
        z-40 md:z-20
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex items-center gap-4 px-2 mb-8">
          <div className="w-12 h-12 rounded-full shadow-neu-light dark:shadow-neu-dark flex items-center justify-center text-blue-500">
            <Power size={24} strokeWidth={3} />
          </div>
          <span className="font-bold text-xl tracking-wide text-gray-600 dark:text-gray-300">
            Omni<span className="text-blue-500">AI</span>
          </span>
        </div>

        <button
          onClick={() => {
            createSession(currentModelId);
            setIsSidebarOpen(false); // 移动端创建会话后关闭侧边栏
          }}
          className={`${neuBtn} w-full h-14 rounded-2xl mb-6 text-blue-600 dark:text-blue-400 group`}
          aria-label="Create new chat session"
        >
          <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
          <span className="ml-2 font-bold">New Chat</span>
        </button>

        <div className="flex-1 overflow-y-auto space-y-4 px-1 py-2 custom-scrollbar"> {/* 加上 custom-scrollbar 美化滚动条 */}
          {sessions.map(session => {
            // ✅ 生成会话摘要：取第一条用户消息的前30个字符
            const firstUserMsg = session.messages.find(m => m.role === 'user');
            const summary = session.summary || (firstUserMsg?.content ? (firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')) : 'Empty chat');

            return (
              <div
                key={session.id}
                onClick={() => {
                  selectSession(session.id);
                  setIsSidebarOpen(false); // 移动端选择会话后关闭侧边栏
                }}
                className={`group relative cursor-pointer p-4 rounded-2xl transition-all flex flex-col gap-2 ${
                  currentSessionId === session.id
                    ? 'shadow-neu-pressed-light dark:shadow-neu-pressed-dark text-blue-500 scale-[0.98]'
                    : 'shadow-neu-light dark:shadow-neu-dark hover:scale-[1.02]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MessageCircle size={20} className="shrink-0" />
                  <span className="truncate text-sm font-medium flex-1 pr-6">
                    {session.title}
                  </span>
                </div>

                {/* ✅ 显示摘要 */}
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate pr-8">
                  {summary}
                </p>

                {/* --- 删除按钮 (悬停显示) --- */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // 防止触发 selectSession
                    if (confirm('Are you sure you want to delete this chat?')) {
                      deleteSession(session.id);
                    }
                  }}
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                  title="Delete Chat"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-4 items-center lg:flex-row lg:justify-between px-2">
          <button
            onClick={toggleTheme}
            className={`${neuBtn} w-10 h-10`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`${neuBtn} w-10 h-10`}
            aria-label="Open settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </aside>

      {/* 主对话区 */}
      <main className={`${neuPanel} flex-1 flex flex-col overflow-hidden md:rounded-3xl rounded-none`}>
        <header className="h-16 md:h-20 md:rounded-t-3xl shadow-neu-light dark:shadow-neu-dark bg-light dark:bg-dark flex items-center justify-between px-4 md:px-8 border-b border-gray-200/50 dark:border-gray-700/50 shrink-0">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            {/* 移动端汉堡菜单 */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={`${neuBtn} w-10 h-10 md:hidden`}
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>

            <div className={`w-3 h-3 rounded-full transition-shadow duration-500 ${
              activeSession ? 'bg-green-500 shadow-[0_0_12px_#22c55e]' : 'bg-gray-400'
            }`}></div>

            <div className="flex flex-col min-w-0 flex-1">
              <h2 className="font-bold text-sm md:text-lg text-gray-700 dark:text-gray-100 truncate">
                {activeSession?.title || 'OmniAI Hub'}
              </h2>
              <span className="text-[10px] md:text-xs text-gray-400 font-medium">
                {activeSession ? `${activeSession.messages.length} messages` : 'Start a new conversation'}
              </span>
            </div>
          </div>
          <ModelSelector />
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 md:px-4 lg:px-20 py-4 md:py-6">
          {!activeSession ? (
            <div className="h-full flex flex-col items-center justify-center opacity-60">
              <div className="w-32 h-32 rounded-full shadow-neu-light dark:shadow-neu-dark flex items-center justify-center mb-6">
                <Power size={48} className="text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-400">Ready to Imagine</h3>
            </div>
          ) : (
            <div className="max-w-6xl space-y-8">
              {activeSession.messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onImageClick={(src) => setPreviewImage(src)}
                  onHtmlPreview={(html) => setHtmlPreviewContent(html)}
                />
              ))}
              {isGenerating && (
                <div className="flex items-center gap-3 text-gray-400 animate-pulse px-4">
                  <Loader2 className="animate-spin" size={20} />
                  <span className="text-sm font-medium">AI is thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* --- 输入区域 --- */}
        <div className="p-3 md:p-6 lg:p-10">
          <div className="max-w-4xl mx-auto relative group">

            {/* 预览缩略图区域 */}
            {attachments.length > 0 && (
              <div className="absolute bottom-full mb-2 md:mb-4 left-0 flex gap-2 md:gap-3 px-2 animate-slide-up">
                {attachments.map((src, index) => (
                  <div key={index} className="relative group/thumb w-12 h-12 md:w-16 md:h-16 rounded-xl shadow-neu-light dark:shadow-neu-dark overflow-hidden border-2 border-white dark:border-gray-700">
                    <img src={src} className="w-full h-full object-cover" alt="attachment" />
                    <button
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                      className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 md:gap-4">
              <div className="flex-1 relative">
                
                {/* 隐藏的文件输入框 */}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileSelect}
                />

                {/* 文本框 */}
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isGenerating}
                  placeholder="Type a message (Ctrl+V to paste image)..."
                  className={`${neuInput} resize-none h-[50px] md:h-[60px] pl-12 md:pl-14 pr-3 text-sm md:text-base leading-[1.5]`}
                />

                {/* 上传按钮 (放在输入框内部左侧) */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute left-3 md:left-4 bottom-2 md:bottom-3 text-gray-400 hover:text-blue-500 transition-colors"
                  title="Upload Image"
                  aria-label="Upload image attachment"
                >
                  <Paperclip size={18} className="md:w-5 md:h-5" />
                </button>
              </div>

              <button
                onClick={() => setIsImageStudioOpen(true)}
                className={`${neuBtn} w-[50px] h-[50px] md:w-[60px] md:h-[60px] rounded-2xl shrink-0 text-blue-500`}
                aria-label="Open OpenAI image studio"
                title="OpenAI Image Studio"
              >
                <ImageIcon size={20} className="md:w-6 md:h-6" />
              </button>

              <button
                onClick={isGenerating ? stopGeneration : handleSend}
                disabled={(!input.trim() && attachments.length === 0) && !isGenerating}
                className={`${neuBtn} w-[50px] h-[50px] md:w-[60px] md:h-[60px] rounded-2xl shrink-0 transition-colors duration-300 ${
                  isGenerating
                    ? 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/10'
                    : (input.trim() || attachments.length > 0)
                      ? 'text-blue-500'
                      : 'text-gray-400 cursor-not-allowed'
                }`}
                aria-label={isGenerating ? 'Stop generation' : 'Send message'}
              >
                {isGenerating ? (
                  <Square size={18} fill="currentColor" className="animate-pulse md:w-5 md:h-5" />
                ) : (
                  <Send size={20} className={`md:w-6 md:h-6 ${(input.trim() || attachments.length > 0) ? '-ml-1 mt-1' : ''}`} />
                )}
            </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
