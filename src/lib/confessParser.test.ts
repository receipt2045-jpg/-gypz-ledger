import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './constants'
import { extractAmount, parseConfessionText } from './confessParser'

const cats = DEFAULT_CATEGORIES

describe('extractAmount — 금액 표기', () => {
  it('쉼표 숫자: 12,000원', () => {
    expect(extractAmount('택시 12,000원')).toEqual({ amount: 12_000, rest: '택시' })
  })
  it('천 단위: 9천원', () => {
    expect(extractAmount('김밥 9천원')?.amount).toBe(9_000)
  })
  it('만+천 조합: 1만2천', () => {
    expect(extractAmount('숙소 1만2천')?.amount).toBe(12_000)
  })
  it('만 단독: 3만', () => {
    expect(extractAmount('치킨 3만')?.amount).toBe(30_000)
  })
  it('단위어 단독: 만원', () => {
    expect(extractAmount('커피 만원')?.amount).toBe(10_000)
  })
  it('소수 조합: 1.5만', () => {
    expect(extractAmount('회식 1.5만')?.amount).toBe(15_000)
  })
  it('원 붙은 작은 금액: 500원', () => {
    expect(extractAmount('사탕 500원')?.amount).toBe(500)
  })
  it('단위 없는 맨숫자 1000 이상만: 5500', () => {
    expect(extractAmount('커피 5500')?.amount).toBe(5_500)
    expect(extractAmount('커피 2잔')).toBeNull()
  })
  it('순한글 금액은 오인하지 않고 버림: 만이천원', () => {
    expect(extractAmount('택시 만이천원')).toBeNull()
  })
  it('숫자 여러 개면 금액 쪽 채택: 2명이서 3만원', () => {
    expect(extractAmount('2명이서 3만원')?.amount).toBe(30_000)
  })
})

describe('parseConfessionText — 카테고리 매칭', () => {
  it('카테고리명 직접 포함', () => {
    const r = parseConfessionText('배달 2만3천원', cats)
    expect(r.entries[0]).toMatchObject({ category: '배달', kind: 'variable', amount: 23_000 })
  })
  it('내장 별칭: 점심→식비, 커피→카페, 택시→자동차', () => {
    const r = parseConfessionText('점심 9천원, 커피 5,500원, 택시 12,000원', cats)
    expect(r.entries.map((e) => e.category)).toEqual(['식비', '카페', '자동차'])
    expect(r.entries.map((e) => e.amount)).toEqual([9_000, 5_500, 12_000])
  })
  it('학습 별칭이 내장보다 우선', () => {
    const r = parseConfessionText('커피 5000원', cats, { 커피: '식비' })
    expect(r.entries[0].category).toBe('식비')
  })
  it('매칭 실패 → 기타 + matched:false + 원문 note', () => {
    const r = parseConfessionText('뽑기 3천원', cats)
    expect(r.entries[0]).toMatchObject({ category: '기타', matched: false, note: '뽑기' })
  })
  it('금액 없는 조각은 skipped로', () => {
    const r = parseConfessionText('오늘 너무 힘들었다, 커피 5천원', cats)
    expect(r.skipped).toEqual(['오늘 너무 힘들었다'])
    expect(r.entries).toHaveLength(1)
  })
  it('줄바꿈·그리고 구분자', () => {
    const r = parseConfessionText('마트 3만원\n영화 15000원 그리고 주유 5만원', cats)
    expect(r.entries.map((e) => e.category)).toEqual(['식비', '문화생활', '자동차'])
  })
  it('고정지출 별칭: 넷플릭스→구독', () => {
    const r = parseConfessionText('넷플릭스 17,000원', cats)
    expect(r.entries[0]).toMatchObject({ category: '구독', kind: 'fixed' })
  })
  it("'기타'를 지운 가구에선 폴백이 실재하는 첫 카테고리", () => {
    const custom = { ...cats, variable: ['배달', '카페'] } // 기타 없음
    const r = parseConfessionText('택시 3천원', custom)
    expect(r.entries[0]).toMatchObject({ category: '배달', matched: false })
  })
})
