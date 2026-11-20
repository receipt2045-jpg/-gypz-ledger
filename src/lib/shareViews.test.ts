import { describe, expect, it } from 'vitest'
import { shareOfPath, shareUrl, viewsLabel, VIEW_MIN } from './shareViews'
import { sharesByDate } from './shares'
import { hashFromPath } from './pathToHash'

describe('자료 나눔 — 몇 명이 봤는지·공유 (2026-11-21)', () => {
  it('자료 이름(slug)이 서버 규칙(영어 소문자·숫자·-)에 맞는다', () => {
    for (const s of sharesByDate()) expect(s.slug).toMatch(/^[a-z0-9-]{1,60}$/)
  })

  it('주소로 자료를 찾는다 — 끝 / 가 붙어도', () => {
    expect(shareOfPath('/values')?.slug).toBe('values')
    expect(shareOfPath('/gold/')?.slug).toBe('gold')
    expect(shareOfPath('/monthly')).toBeUndefined()
  })

  it('100명 전까지는 숫자를 안 보여 준다', () => {
    expect(viewsLabel(undefined)).toBeNull()
    expect(VIEW_MIN).toBe(100)
    expect(viewsLabel(99)).toBeNull()
    expect(viewsLabel(100)).toBe('100명')
    expect(viewsLabel(1203)).toBe('1,203명')
  })

  it('공유 주소는 # 없이 — 열면 앱이 #/자료로 바꿔 연다', () => {
    for (const s of sharesByDate()) {
      const url = new URL(shareUrl(s))
      expect(url.hash).toBe('')
      expect(hashFromPath(url.pathname, url.search, url.hash)).toBe(`/#${s.path}`)
    }
  })
})
