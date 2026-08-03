import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// 테스트마다 화면을 깨끗이 비운다 (앞 테스트의 DOM이 남으면 오탐이 난다)
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// jsdom에 없는 브라우저 기능들 — 화면 코드가 호출해도 죽지 않게만 채운다
window.scrollTo = vi.fn()
// recharts(차트)가 컨테이너 크기 감지에 사용
window.ResizeObserver =
  window.ResizeObserver ??
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
window.matchMedia =
  window.matchMedia ??
  ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList)
