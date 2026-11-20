// ── 자료 나눔 — 몇 명이 봤는지 · 이 자료 공유하기 (2026-11-21) ──
// 자료를 연 기기를 한 번씩만 센다(supabase/share-views.sql). 로그인 안 해도 센다.
// 기기마다 무작위 번호 하나를 이 기기에만 저장해 두고 그 번호로 센다 — 누구인지는 남기지 않는다.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { sharesByDate, type ShareItem } from './shares'
import { shareText } from './native'

/** 이 수보다 적으면 숫자 대신 아무것도 안 보여 준다 — '3명이 봤어요'는 오히려 안 읽고 싶어진다 */
export const VIEW_MIN = 10

const VIEWER_KEY = 'moabuli.viewer'

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

function viewerId(): string {
  try {
    let v = localStorage.getItem(VIEWER_KEY)
    if (!v) {
      v = randomId()
      localStorage.setItem(VIEWER_KEY, v)
    }
    return v
  } catch {
    return randomId()
  }
}

/** 주소 → 자료 (끝 / 는 뗀다 — moabuli.com/gold 는 Cloudflare가 /gold/ 로 돌려보낸다) */
export function shareOfPath(pathname: string): ShareItem | undefined {
  const p = pathname.replace(/\/+$/, '') || '/'
  return sharesByDate().find((s) => s.path === p)
}

/** 이 자료를 열었다고 남긴다 — 같은 창에서 같은 자료는 한 번만 */
export function recordShareView(slug: string) {
  const key = `moabuli.viewed.${slug}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    /* 기록 못 해도 센다 */
  }
  void supabase
    .rpc('record_share_view', { p_slug: slug, p_viewer: viewerId() })
    .then(({ error }) => {
      if (error) console.warn('[shareViews] 기록 실패', error.message)
    })
}

let countsCache: Promise<Record<string, number>> | null = null

export function fetchShareViews(force = false): Promise<Record<string, number>> {
  if (!countsCache || force) {
    countsCache = Promise.resolve(supabase.rpc('share_view_counts')).then(({ data, error }) => {
      if (error || !Array.isArray(data)) return {}
      const out: Record<string, number> = {}
      for (const r of data as { slug: string; viewers: number | string }[])
        out[r.slug] = Number(r.viewers)
      return out
    })
  }
  return countsCache
}

/** 자료별 본 사람 수 (못 읽으면 빈 값 — 숫자만 안 보일 뿐 화면은 그대로) */
export function useShareViews(): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    let alive = true
    void fetchShareViews().then((c) => alive && setCounts(c))
    return () => {
      alive = false
    }
  }, [])
  return counts
}

/** '1,203명' — VIEW_MIN 보다 적으면 null */
export function viewsLabel(n: number | undefined): string | null {
  if (!n || n < VIEW_MIN) return null
  return `${n.toLocaleString('ko-KR')}명`
}

/**
 * 공유 주소 — # 없이. moabuli.com/values 처럼 열면 카톡이 자료별 미리보기 그림을 읽고,
 * 앱이 열리면서 #/values 로 바꿔 준다(pathToHash).
 */
export const shareUrl = (item: Pick<ShareItem, 'path'>) => `https://moabuli.com${item.path}`

/** 폰·앱은 공유 창(카톡·인스타·문자…), 공유 창이 없으면(PC) 링크를 복사한다 — native.shareText */
export function shareItem(item: Pick<ShareItem, 'path' | 'title' | 'sub'>) {
  return shareText({ title: item.title, text: `${item.title}\n${item.sub}`, url: shareUrl(item) })
}
