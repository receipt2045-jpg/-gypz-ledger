import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// vite.config.ts를 그대로 물려받고 테스트 설정만 얹는다
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // 화면 테스트를 위한 가짜 브라우저. 버튼을 실제로 눌러보고 결과를 확인한다.
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      // supabase 클라이언트는 값이 없으면 import 단계에서 죽는다. 테스트는 실제로
      // 서버를 부르지 않지만(householdId를 비워둠) 값 자체는 있어야 한다.
      env: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      },
    },
  }),
)
