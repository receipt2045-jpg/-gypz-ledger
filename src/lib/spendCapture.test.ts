import { describe, expect, it } from 'vitest'
import { captureToDrafts, type SpendCaptureItem } from './spendCapture'
import type { Categories } from '../types'

const categories: Categories = {
  variable: ['식비', '카페/간식', '생활용품', '기타'],
  fixed: ['통신비', '구독'],
  income: ['부수입', '용돈'],
  saving: [],
  investment: [],
}
const item = (p: Partial<SpendCaptureItem>): SpendCaptureItem => ({
  date: '2026-11-23',
  merchant: '',
  amount: 0,
  kind: 'variable',
  category: '',
  confident: true,
  ...p,
})
const today = '2026-11-24'

describe('캡처로 적기 (2026-11-24)', () => {
  it('읽은 결제를 확인 화면 항목으로 — 그 건의 날짜와 가게 이름(메모)이 붙는다', () => {
    const { drafts, dup } = captureToDrafts(
      [
        item({ merchant: '(주)스타벅스 강남점', amount: 5_500, category: '카페/간식' }),
        item({ merchant: '김밥천국', amount: 9_000, category: '식비', date: '2026-11-22' }),
      ],
      categories,
      {},
      [],
      today,
      today,
    )
    expect(dup).toEqual([])
    expect(drafts.map((d) => [d.category, d.amount, d.date, d.note])).toEqual([
      ['카페/간식', 5_500, '2026-11-23', '스타벅스 강남점'],
      ['식비', 9_000, '2026-11-22', '김밥천국'],
    ])
  })

  it('우리 집이 가르친 말이 먼저 — 쿠팡은 생활용품', () => {
    const { drafts } = captureToDrafts(
      [item({ merchant: '쿠팡', amount: 32_000, category: '식비' })],
      categories,
      { 쿠팡: '생활용품' },
      [],
      today,
      today,
    )
    expect(drafts[0].category).toBe('생활용품')
  })

  it('목록에 없는 종류면 기타, 들어온 돈이면 수입 칸으로', () => {
    const { drafts } = captureToDrafts(
      [
        item({ merchant: '알수없는가게', amount: 3_000, category: '없는종류' }),
        item({ merchant: '홍길동', amount: 50_000, kind: 'income', category: '용돈' }),
      ],
      categories,
      {},
      [],
      today,
      today,
    )
    expect([drafts[0].category, drafts[0].kind, drafts[0].matched]).toEqual([
      '기타',
      'variable',
      false,
    ])
    expect([drafts[1].category, drafts[1].kind]).toEqual(['용돈', 'income'])
  })

  it('같은 날·같은 금액이 이미 적혀 있으면 뺀다 — 캡처를 두 번 올려도 두 번 안 적힌다', () => {
    const { drafts, dup } = captureToDrafts(
      [
        item({ merchant: '스타벅스', amount: 5_500, category: '카페/간식' }),
        item({ merchant: 'GS25', amount: 2_000, category: '카페/간식' }),
      ],
      categories,
      {},
      [{ createdAt: '2026-11-23T03:00:00.000Z', amount: 5_500, kind: 'variable' }],
      today,
      today,
    )
    expect(drafts).toHaveLength(1)
    expect(dup).toEqual(['스타벅스 5,500원'])
  })

  it('날짜가 없거나 앞날이면 고른 날짜, 0원·흐린 건 표시', () => {
    const { drafts } = captureToDrafts(
      [
        item({ merchant: 'A', amount: 1_000, date: '' }),
        item({ merchant: 'B', amount: 2_000, date: '2026-12-01', confident: false }),
        item({ merchant: 'C', amount: 0 }),
      ],
      categories,
      {},
      [],
      '2026-11-20',
      today,
    )
    expect(drafts.map((d) => d.date)).toEqual(['2026-11-20', '2026-11-20'])
    expect(drafts[1].unsure).toBe(true)
  })
})
