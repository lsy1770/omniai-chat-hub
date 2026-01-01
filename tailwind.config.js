/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 新拟物经典背景色
        light: '#e0e5ec',
        dark: '#2b2d33',
      },
      boxShadow: {
        // --- 亮色模式 (Light Mode) ---
        // 凸起 (按钮/卡片)
        'neu-light': '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)',
        // 凹陷 (输入框/按下状态)
        'neu-pressed-light': 'inset 6px 6px 10px 0 rgba(163,177,198, 0.7), inset -6px -6px 10px 0 rgba(255,255,255, 0.8)',
        
        // --- 暗色模式 (Dark Mode) ---
        // 凸起
        'neu-dark': '8px 8px 16px #1a1b1f, -8px -8px 16px #3c3f47',
        // 凹陷
        'neu-pressed-dark': 'inset 8px 8px 16px #1a1b1f, inset -8px -8px 16px #3c3f47',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}