/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F2F4F6',
        card: '#FFFFFF',
        brand: '#3182F6',
        'brand-dark': '#2272EB',
        danger: '#F04452',
        ink: '#191F28',
        sub: '#4E5968',
        cap: '#8B95A1',
        line: '#E5E8EB',
      },
      borderRadius: {
        card: '20px',
        btn: '14px',
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          'sans-serif',
        ],
      },
      maxWidth: {
        app: '480px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.03)',
        cta: '0 4px 16px rgba(49, 130, 246, 0.28)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // 인스타 스토리처럼 차오르는 막대 — 원팀 카드 고민 문구 (2026-10-24)
        'story-fill': {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.28s ease-out both',
        'story-fill': 'story-fill 3s linear both',
      },
    },
  },
  plugins: [],
}
