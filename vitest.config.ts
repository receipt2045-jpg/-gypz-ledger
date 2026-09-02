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
      // 자산 탭처럼 무거운 화면은 혼자 돌리면 1초 안에 끝나는데, 전체를 한꺼번에
      // 돌리면 밀려서 기본 5초를 넘긴다. 기능 문제가 아닌데 빨간불이 뜨면
      // 진짜 실패를 못 알아본다.
      testTimeout: 20_000,
      // supabase 클라이언트는 값이 없으면 import 단계에서 죽는다. 테스트는 실제로
      // 서버를 부르지 않지만(householdId를 비워둠) 값 자체는 있어야 한다.
      env: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      },
    },
  }),
)
