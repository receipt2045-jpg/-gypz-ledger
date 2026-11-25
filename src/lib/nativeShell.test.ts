import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({ on: false }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.on } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({})), exitApp: vi.fn() } }))
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn(async () => {}) } }))
import { isExternalUrl, isOurUrl } from './nativeShell'

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
  const originalOpen = window.open
  const realAdd = document.addEventListener.bind(document)
  let added: Array<[string, EventListenerOrEventListenerObject, unknown]> = []

  beforeEach(() => {
    vi.resetModules() // installed 플래그와 Browser 목을 매번 새로
    native.on = true
    added = []
    document.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
      added.push([type, fn, opts])
      realAdd(type, fn, opts as boolean)
    }) as typeof document.addEventListener
  })

  afterEach(() => {
    native.on = false
    window.open = originalOpen
    document.addEventListener = realAdd
    for (const [type, fn, opts] of added) document.removeEventListener(type, fn, opts as boolean)
    document.body.innerHTML = ''
  })

  it('바깥 링크 안쪽 자식을 눌러도 앱 밖 브라우저로 열고, 두 번 불러도 한 번만 건다', async () => {
    const { Browser } = await import('@capacitor/browser')
    const { installNativeShell } = await import('./nativeShell')
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
