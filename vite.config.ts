// 테스트 설정은 vitest.config.ts에 따로 있다 (여기 두면 rollup 타입과 충돌한다)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // 커스텀 도메인 루트(moabuli.com/)에서 서비스한다.
  // 예전 기본값은 GitHub Pages용 '/gypz-ledger/'였는데, 그 배포는 더 이상 없고
  // 호스팅을 옮길 때마다 경로가 깨져서 기본값을 '/'로 바꿨다.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
})
