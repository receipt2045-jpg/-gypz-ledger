/**
 * 앱 껍데기 동작 (2026-10-31, 하이브리드 1단계). 웹에선 아무것도 하지 않는다.
 * - 폰 뒤로가기: 앱 안 이전 화면, 첫 화면이면 앱 닫기
 * - 메일 링크 등으로 moabuli.com 주소가 앱을 열면 그 화면으로
 * - 원팀·상담 신청서·카톡 같은 바깥 링크는 앱 밖 브라우저로
 */
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { isNative } from './native'

const OUR_HOSTS = new Set(['moabuli.com', 'www.moabuli.com'])

export function isExternalUrl(href: string, origin = window.location.origin): boolean {
  let u: URL
  try {
    u = new URL(href, origin)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  if (u.origin === origin) return false
  return !OUR_HOSTS.has(u.hostname)
}

/** 앱 링크로 들어온 주소가 우리 사이트(http/https + moabuli.com)인지 */
function isOurUrl(href: string): boolean {
  try {
    const u = new URL(href)
    return (u.protocol === 'https:' || u.protocol === 'http:') && OUR_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

function openOutside(url: string): void {
  Browser.open({ url }).catch((err) => console.error('[nativeShell] 바깥 브라우저 열기 실패', url, err))
}

function listen<T>(register: () => Promise<T>, name: string): void {
  register().catch((err) => console.error(`[nativeShell] ${name} 리스너 등록 실패`, err))
}

export function installNativeShell(): void {
  if (!isNative()) return

  listen(
    () =>
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back()
        else App.exitApp().catch((err) => console.error('[nativeShell] 앱 닫기 실패', err))
      }),
    'backButton',
  )

  listen(
    () =>
      App.addListener('appUrlOpen', ({ url }) => {
        if (isOurUrl(url)) window.location.href = url
        else console.warn('[nativeShell] 우리 주소가 아니라 무시한 앱 링크', url)
      }),
    'appUrlOpen',
  )

  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || !isExternalUrl(a.href)) return
      e.preventDefault()
      openOutside(a.href)
    },
    true,
  )

  const open = window.open.bind(window)
  window.open = (url?: string | URL, target?: string, features?: string) => {
    const href = url?.toString() ?? ''
    if (href && isExternalUrl(href)) {
      openOutside(href)
      return null
    }
    return open(url, target, features)
  }
}
