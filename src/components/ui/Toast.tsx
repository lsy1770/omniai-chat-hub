import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onClose: (id: string) => void;
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

export const Toast: React.FC<ToastProps> = ({ id, message, type, duration = 3000, onClose }) => {
  const Icon = iconMap[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-2xl shadow-neu-light dark:shadow-neu-dark bg-light dark:bg-dark animate-slide-up min-w-[300px] max-w-md"
      role="alert"
    >
      <Icon className={`${colorMap[type]} shrink-0 mt-0.5`} size={20} />
      <p className="flex-1 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
};
