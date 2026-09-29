/**
 * 해시(#) 없이 들어온 주소를 해시 주소로 옮긴다.
 *
 * 앱은 HashRouter라 화면을 # 뒤에서 고른다. 그런데 링크 모음 서비스(인포크링크 등)나 일부 앱은
 * 주소의 #을 떼거나 %23으로 바꿔서 연다(2026-09-30 제보: moabuli.com/#/leave가 로그인 화면으로 열림).
 *   moabuli.com/leave          → moabuli.com/#/leave
 *   moabuli.com/%23/leave?s=…  → moabuli.com/#/leave?s=…
 * 옮길 게 없으면 null.
 */
export function hashFromPath(pathname: string, search: string, hash: string): string | null {
  if (hash && hash !== '#') return null
  let path: string
  try {
    path = decodeURIComponent(pathname)
  } catch {
    path = pathname
  }
  path = path.replace(/^\/#/, '')
  if (path === '' || path === '/' || path === '/index.html') return null
  if (!path.startsWith('/')) path = `/${path}`
  return `/#${path}${search}`
}
