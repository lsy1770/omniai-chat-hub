import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface Props {
  src: string | null;
  onClose: () => void;
}

export const ImagePreview: React.FC<Props> = ({ src, onClose }) => {
  // Escape键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && src) {
        onClose();
      }
    };

    if (src) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [src, onClose]);

  if (!src) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = src;
    link.download = `image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-light/80 dark:bg-dark/80 backdrop-blur-md animate-fade-in p-8"
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-light dark:bg-dark shadow-neu-light dark:shadow-neu-dark text-gray-500 hover:text-red-500 flex items-center justify-center transition-all active:scale-95"
      >
        <X size={24} />
      </button>

      {/* 图片容器 */}
      <div 
        className="relative max-w-full max-h-full rounded-3xl shadow-neu-light dark:shadow-neu-dark p-2 bg-light dark:bg-dark overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()} // 防止点击图片关闭
      >
        <img 
          src={src} 
          alt="Preview" 
          className="max-w-full max-h-[85vh] rounded-2xl object-contain"
        />
        
        {/* 底部工具栏 */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
           <button 
             onClick={handleDownload}
             className="px-6 py-3 rounded-full bg-light dark:bg-dark shadow-neu-light dark:shadow-neu-dark text-gray-600 dark:text-gray-300 font-bold flex items-center gap-2 hover:text-blue-500 transition-all active:scale-95"
           >
             <Download size={18} /> Download
           </button>
        </div>
      </div>
    </div>
  );
};