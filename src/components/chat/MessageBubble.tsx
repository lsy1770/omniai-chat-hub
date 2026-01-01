import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../types';
import { Bot, User, Copy, Check, Download, Maximize2, FileText, Code } from 'lucide-react';

interface Props {
  message: Message;
  onImageClick?: (src: string) => void;
  onHtmlPreview?: (html: string) => void; // 新增HTML预览回调
}

// 拟物化小按钮样式
const actionBtnClass = "p-2 rounded-lg text-gray-400 hover:text-blue-500 transition-all hover:bg-gray-200 dark:hover:bg-white/5 active:scale-95";

export const MessageBubble: React.FC<Props> = ({ message, onImageClick, onHtmlPreview }) => {
  const isUser = message.role === 'user';
  const [isCopied, setIsCopied] = useState(false);

  // 检测内容是否包含完整HTML文档或HTML标签
  const containsHtml = useMemo(() => {
    const content = message.content.trim();
    // 检测是否是完整HTML文档
    if (content.toLowerCase().includes('<!doctype html') ||
        content.toLowerCase().includes('<html')) {
      return true;
    }
    // 检测是否包含块级HTML元素
    const blockHtmlPattern = /<(div|section|article|main|header|footer|nav|aside|table|form|ul|ol|dl|h[1-6]|p)[^>]*>/i;
    return blockHtmlPattern.test(content);
  }, [message.content]);

  // 复制全文
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // 下载消息为 .md 文件
  const handleDownloadText = () => {
    const blob = new Blob([message.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message-${message.id.slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 打开HTML预览
  const handleHtmlPreview = () => {
    if (onHtmlPreview) {
      onHtmlPreview(message.content);
    }
  };

  return (
    <div className={`group flex gap-6 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

      {/* 头像 + 模型名称 */}
      <div className="flex flex-col items-start gap-1 shrink-0">
        {/* ✅ 显示模型名称（仅AI消息） */}
        {!isUser && message.modelUsed && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800/50">
            {message.modelUsed}
          </span>
        )}

        {/* 头像 */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-neu-pressed-light dark:shadow-neu-pressed-dark ${
          isUser ? 'text-gray-500' : 'text-blue-500'
        }`}>
          {isUser ? <User size={20} /> : <Bot size={24} />}
        </div>
      </div>

      <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* --- 新增：显示附件图片 --- */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {message.attachments.map((src, index) => (
              <img 
                key={index}
                src={src}
                alt="attachment"
                onClick={() => onImageClick && onImageClick(src)}
                className="w-32 h-32 object-cover rounded-xl shadow-neu-light dark:shadow-neu-dark cursor-zoom-in border-2 border-white dark:border-gray-700 hover:scale-105 transition-transform"
              />
            ))}
          </div>
        )}
        
        {/* 消息体 */}
        <div className={`
          relative px-6 py-4 rounded-3xl text-sm leading-7 shadow-neu-light dark:shadow-neu-dark
          ${isUser
            ? 'bg-light dark:bg-dark text-gray-700 dark:text-gray-200 rounded-tr-none'
            : 'bg-light dark:bg-dark text-gray-600 dark:text-gray-300 rounded-tl-none border-l-4 border-blue-500/50'
          }
        `}>
          {isUser ? (
            <div className="whitespace-pre-wrap font-medium">{message.content}</div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                      // 自定义代码块渲染
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeContent = String(children).replace(/\n$/, '');
                        // 独立状态管理代码块复制
                        const [codeCopied, setCodeCopied] = React.useState(false);

                        const handleCodeCopy = () => {
                          navigator.clipboard.writeText(codeContent);
                          setCodeCopied(true);
                          setTimeout(() => setCodeCopied(false), 2000);
                        };

                        return !inline && match ? (
                          <div className="rounded-xl overflow-hidden my-4 shadow-neu-pressed-light dark:shadow-neu-pressed-dark group/code">
                            <div className="bg-gray-200 dark:bg-gray-800/50 px-4 py-2 text-xs text-gray-500 font-bold uppercase tracking-wider flex justify-between items-center">
                               <span>{match[1]}</span>
                               {/* 代码块复制按钮 */}
                               <button
                                 onClick={handleCodeCopy}
                                 className="flex items-center gap-1 hover:text-blue-500 transition"
                               >
                                 {codeCopied ? <Check size={14} className="text-green-500"/> : <Copy size={14} />}
                                 <span className="text-[10px]">{codeCopied ? 'Copied' : 'Copy'}</span>
                               </button>
                            </div>
                            {/* ✅ 添加横向滚动 */}
                            <div className="overflow-x-auto">
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{ margin: 0, borderRadius: 0 }}
                                {...props}
                              >
                                {codeContent}
                              </SyntaxHighlighter>
                            </div>
                          </div>
                        ) : (
                          <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-pink-500 font-mono text-xs" {...props}>
                            {children}
                          </code>
                        );
                      },
                      // 自定义图片渲染
                      img({ src, alt }) {
                        return (
                          <div className="relative group/img my-4 inline-block rounded-xl overflow-hidden shadow-neu-pressed-light dark:shadow-neu-pressed-dark">
                            <img
                              src={src}
                              alt={alt}
                              className="max-w-full h-auto rounded-xl cursor-zoom-in"
                              onClick={() => onImageClick && src && onImageClick(src)}
                            />
                            {/* 图片悬浮工具栏 */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-[2px]">
                               <button
                                 onClick={() => onImageClick && src && onImageClick(src)}
                                 className="p-3 rounded-full bg-white/20 text-white hover:bg-white/40 transition backdrop-blur-md"
                                 title="放大查看"
                               >
                                 <Maximize2 size={20} />
                               </button>
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   if(src) {
                                     const link = document.createElement('a');
                                     link.href = src;
                                     link.download = 'image.png';
                                     link.click();
                                   }
                                 }}
                                 className="p-3 rounded-full bg-white/20 text-white hover:bg-white/40 transition backdrop-blur-md"
                                 title="下载图片"
                               >
                                 <Download size={20} />
                               </button>
                            </div>
                          </div>
                        );
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
          )}
        </div>

        {/* 消息底部工具栏 (仅 AI 消息显示，或用户消息也显示) */}
        <div className={`flex gap-2 mt-2 px-2 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
          <button
            onClick={handleCopy}
            className={actionBtnClass}
            title="复制消息"
          >
            {isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>

          <button
            onClick={handleDownloadText}
            className={actionBtnClass}
            title="下载为 Markdown"
          >
            <FileText size={16} />
          </button>

          {/* 如果检测到HTML标签，显示预览按钮 */}
          {!isUser && containsHtml && (
            <button
              onClick={handleHtmlPreview}
              className={`${actionBtnClass} flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 text-blue-600 dark:text-blue-400 font-medium`}
              title="在新窗口预览 HTML"
            >
              <Code size={16} />
              <span className="text-xs">Preview HTML</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};