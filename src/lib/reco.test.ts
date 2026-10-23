import { describe, expect, it } from 'vitest'
import { pickConfessReco, settleReco } from './reco'
import type { Confession } from '../types'

const now = new Date().toISOString()
const c = (category: string, amount: number): Confession => ({
  id: category + amount,
  memberNo: 1,
  kind: 'variable',
  category,
  amount,
  createdAt: now,
})
const ym = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()
const never = () => false

describe('맞춤 추천 카드 (2026-10-24)', () => {
  it('방금 육아를 적었으면 육아휴직 계산기', () => {
    expect(pickConfessReco(['육아'], [c('육아', 42000)], [], ym, never)?.to).toBe('/leave')
  })

  it('주거면 내집마련 대출 찾기', () => {
    expect(pickConfessReco(['주거'], [], [], ym, never)?.to).toBe('/calc/home-loan')
  })

  it('맞는 게 없으면 안 띄운다', () => {
    expect(pickConfessReco(['카페'], [c('카페', 5000)], [], ym, never)).toBeNull()
  })

  it('이번 달 그 카테고리 예산을 넘었으면 원팀', () => {
    const card = pickConfessReco(
      ['식비'],
      [c('식비', 300000), c('식비', 250000)],
      [{ group: 'variable', category: '식비', planned: 500000 }],
      ym,
      never,
    )
    expect(card?.id).toBe('oneteam-over')
    expect(card?.title).toContain('식비 예산을')
    expect(card?.href).toBe('https://oneteamm.netlify.app')
  })

  it('오늘 이미 본 카드는 건너뛰고 다음 후보로', () => {
    const card = pickConfessReco(
      ['육아'],
      [c('육아', 900000)],
      [{ group: 'variable', category: '육아', planned: 300000 }],
      ym,
      (id) => id === 'leave',
    )
    expect(card?.id).toBe('oneteam-over')
  })

  it('정산 완료: 남았으면 어디에 둘지, 모자랐으면 어디서 줄일지', () => {
    expect(settleReco(740000).title).toContain('남은 74만원')
    expect(settleReco(-200000).title).toContain('20만원 모자랐어요')
    expect(settleReco(1).sub?.to).toBe('/consult')
  })
})
