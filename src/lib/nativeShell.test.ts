import { describe, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({ on: false }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.on } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({})), exitApp: vi.fn() } }))
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn(async () => {}) } }))
import { Browser } from '@capacitor/browser'
import { installNativeShell, isExternalUrl, isOurUrl } from './nativeShell'

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

describe('isOurUrl', () => {
  it.each([
    ['https://moabuli.com/auth/confirm', true],
    ['https://www.moabuli.com/', true],
    ['mailto:x', false],
    ['javascript:alert(1)', false],
    ['https://evil.com', false],
    ['https://moabuli.com.evil.com', false],
  ])('%s → %s', (href, ok) => {
    expect(isOurUrl(href)).toBe(ok)
  })
})

describe('installNativeShell (앱)', () => {
  it('바깥 링크 안쪽 자식을 눌러도 앱 밖 브라우저로 열고, 두 번 불러도 한 번만 건다', () => {
    native.on = true
    installNativeShell()
    installNativeShell()
    const a = document.createElement('a')
    a.href = 'https://tally.so/r/abc'
    const span = document.createElement('span')
    a.appendChild(span)
    document.body.appendChild(a)
    span.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(Browser.open).toHaveBeenCalledTimes(1)
    expect(Browser.open).toHaveBeenCalledWith({ url: 'https://tally.so/r/abc' })
    expect(window.open('https://open.kakao.com/o/x')).toBeNull()
    expect(Browser.open).toHaveBeenCalledTimes(2)
  })
})
