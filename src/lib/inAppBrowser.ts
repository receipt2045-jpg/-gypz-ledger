/**
 * 카톡·인스타 같은 앱 안의 브라우저(인앱 브라우저) 감지.
 *
 * 왜 필요한가: 나눔을 카톡으로 하다 보니 대부분 카톡 안에서 앱을 연다.
 * 인앱 브라우저는 저장 공간이 앱마다 따로 있고 창을 닫으면 지워져서,
 * 로그인이 매번 풀린다. ("자동로그인 있으면 좋겠어요" 의견의 실제 원인)
 * 크롬·사파리로 한 번만 옮기면 로그인이 유지된다.
 */
export type InApp = 'kakao' | 'instagram' | 'naver' | 'line' | 'facebook' | 'other' | null

export function detectInAppBrowser(ua = navigator.userAgent): InApp {
  const u = ua.toLowerCase()
  if (u.includes('kakaotalk')) return 'kakao'
  if (u.includes('instagram')) return 'instagram'
  if (u.includes('naver')) return 'naver'
  if (u.includes('line/')) return 'line'
  if (u.includes('fban') || u.includes('fbav')) return 'facebook'
  return null
}

export const IN_APP_LABEL: Record<Exclude<InApp, null>, string> = {
  kakao: '카카오톡',
  instagram: '인스타그램',
  naver: '네이버',
  line: '라인',
  facebook: '페이스북',
  other: '이 앱',
}

/**
 * 바깥 브라우저로 옮긴다. 카톡만 전용 방법이 있고,
 * 나머지는 스스로 열어야 해서 안내만 한다.
 */
export function openExternally(kind: Exclude<InApp, null>, url = window.location.href): boolean {
  if (kind === 'kakao') {
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
    return true
  }
  return false
}
