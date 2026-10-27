// ── 결영이네 자료 나눔 (2026-10-24) ──
// 단톡·인스타로 나눈 자료를 한곳에 모은다. 새 자료 = 페이지 하나 + 여기 한 줄.
// 이 목록 하나로 공개 목록(/share), 돈 공부 탭, 각 자료 맨 끝 '다른 자료'가 같이 바뀐다.

export type ShareCategory = '재테크' | '육아' | '내집마련'

export interface ShareItem {
  slug: string
  /** 앱 주소 (#/ 뒤) */
  path: string
  title: string
  sub: string
  category: ShareCategory
  /** 'YYYY-MM-DD' — 최신순 정렬·NEW 표시 */
  date: string
  /** 읽는 데 걸리는 시간(분) */
  minutes: number
  /** 썸네일 대신 쓰는 그림 글자와 바탕색 — 그림 파일이 생기면 바꾼다 */
  emoji: string
  tint: string
}

export const SHARE_CATEGORIES: ShareCategory[] = ['재테크', '육아', '내집마련']

export const SHARES: ShareItem[] = [
  {
    slug: 'child-benefit',
    path: '/child-benefit',
    title: '부모급여·아동수당, 앞으로 몇 달 더 받을까',
    sub: '아이 생일만 넣으면 2026년 바뀐 금액으로 남은 달과 합계를 계산해요',
    category: '육아',
    date: '2026-10-27',
    minutes: 2,
    emoji: '👶',
    tint: 'bg-violet-50',
  },
  {
    slug: 'gift-guide',
    path: '/gift-guide',
    title: '아이 통장에 넣은 돈, 증여 신고 해야 할까?',
    sub: '한 번에·나눠서·정기금·기한 지나서까지, 홈택스 신고 순서도 정리했어요',
    category: '육아',
    date: '2026-10-27',
    minutes: 5,
    emoji: '🐷',
    tint: 'bg-orange-50',
  },
  {
    slug: 'gold',
    path: '/gold',
    title: '금 처음 산다면, 수수료부터 보세요',
    sub: '같은 100만 원어치인데 떼이는 돈이 4천 원일 수도, 15만 원일 수도 있어요',
    category: '재테크',
    date: '2026-10-24',
    minutes: 4,
    emoji: '🪙',
    tint: 'bg-amber-50',
  },
  {
    slug: 'home-loan',
    path: '/calc/home-loan',
    title: '우리 조건에 맞는 내집마련 대출 찾기',
    sub: '신생아 특례·디딤돌·보금자리까지 한 번에 비교해요',
    category: '내집마련',
    date: '2026-10-20',
    minutes: 3,
    emoji: '🔑',
    tint: 'bg-emerald-50',
  },
  {
    slug: 'home-cost',
    path: '/calc/home-cost',
    title: '집 살 때, 집값 말고 잔금날 더 드는 돈',
    sub: '취득세·중개수수료·이사비까지 미리 계산해요',
    category: '내집마련',
    date: '2026-10-07',
    minutes: 2,
    emoji: '🏠',
    tint: 'bg-sky-50',
  },
  {
    slug: 'leave',
    path: '/leave',
    title: '육아휴직하면 매달 얼마 남을까',
    sub: '우리집 숫자로 휴직 기간 한 달 살림을 미리 계산해요',
    category: '육아',
    date: '2026-09-29',
    minutes: 3,
    emoji: '🍼',
    tint: 'bg-pink-50',
  },
]

/** 최신순 */
export const sharesByDate = (): ShareItem[] =>
  [...SHARES].sort((a, b) => (a.date < b.date ? 1 : -1))

/** 올린 지 2주 안이면 NEW */
export function isNewShare(item: ShareItem, now: Date = new Date()): boolean {
  const days = (now.getTime() - new Date(`${item.date}T00:00:00`).getTime()) / 86_400_000
  return days < 14
}

/** "10월 24일" */
export const shareDate = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`

/** 지금 보는 자료 말고 다른 자료 — 같은 분류 먼저, 그다음 최신순 */
export function otherShares(path: string, count = 4): ShareItem[] {
  // moabuli.com/gold 링크는 Cloudflare가 /gold/로 돌려보내서 #/gold/로 열린다 — 끝 /는 떼고 비교
  const currentPath = path.length > 1 ? path.replace(/\/+$/, '') : path
  const current = SHARES.find((s) => s.path === currentPath)
  return sharesByDate()
    .filter((s) => s.path !== currentPath)
    .sort((a, b) => {
      const sa = current && a.category === current.category ? 0 : 1
      const sb = current && b.category === current.category ? 0 : 1
      return sa - sb
    })
    .slice(0, count)
}
