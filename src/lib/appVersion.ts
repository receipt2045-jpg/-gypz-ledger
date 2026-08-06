/**
 * 새 버전 감지.
 *
 * 홈 화면에 추가한 앱(iOS 웹클립)은 예전 파일을 붙들고 있는 일이 잦다.
 * 고쳐서 배포해도 사용자는 옛 화면을 계속 보게 되므로, 서버의 최신
 * index.html이 가리키는 번들 이름과 지금 돌고 있는 번들 이름을 비교한다.
 *
 * 서버에 물어보는 것은 HTML 한 장뿐이고 no-store로 받는다.
 */

const BUNDLE_RE = /assets\/index-[A-Za-z0-9_-]+\.js/

/** 지금 이 화면이 돌리고 있는 번들 파일명 */
function currentBundle(): string | null {
  for (const el of document.querySelectorAll<HTMLScriptElement>('script[src]')) {
    const m = el.src.match(BUNDLE_RE)
    if (m) return m[0]
  }
  return null
}

/**
 * 배포된 버전이 지금 것과 다른지.
 * 개발 서버나 통신 실패 때는 조용히 false — 괜히 배너를 띄우지 않는다.
 */
export async function isUpdateAvailable(): Promise<boolean> {
  const current = currentBundle()
  if (!current) return false // 개발 모드(모듈 직접 로드)에선 비교 대상이 없다

  try {
    const url = `${import.meta.env.BASE_URL}?_v=${Date.now()}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return false
    const html = await res.text()
    const latest = html.match(BUNDLE_RE)?.[0]
    return !!latest && latest !== current
  } catch {
    return false // 오프라인
  }
}
