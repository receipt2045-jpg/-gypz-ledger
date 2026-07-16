import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages 프로젝트 페이지 경로 (https://<owner>.github.io/<저장소이름>/)
  // 배포 워크플로가 VITE_BASE로 실제 저장소 이름을 주입 (로컬 개발은 기본값 사용)
  base: process.env.VITE_BASE ?? '/gypz-ledger/',
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
