import { describe, expect, it, vi } from 'vitest'
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), exitApp: vi.fn() } }))
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn() } }))
import { isExternalUrl } from './nativeShell'

describe('isExternalUrl', () => {
  const o = 'https://moabuli.com'
  it.each([
    ['https://oneteamm.netlify.app', true],
    ['https://tally.so/r/abc', true],
    ['https://open.kakao.com/o/x', true],
    ['https://moabuli.com/#/info', false],
    ['https://www.moabuli.com/privacy', false],
    ['#/settings', false],
    ['/privacy', false],
    ['mailto:receipt2045@gmail.com', false],
  ])('%s → %s', (href, ext) => {
    expect(isExternalUrl(href, o)).toBe(ext)
  })
})
