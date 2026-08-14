import { describe, expect, it } from 'vitest'
import { cardSpentFromConfessions } from './yearEndTax'

const c = (
  cardOwner: 1 | 2 | undefined,
  amount: number,
  kind = 'variable',
  createdAt = '2026-05-02T12:00:00.000Z',
) => ({ kind, amount, cardOwner, createdAt })

describe('고백에 쌓인 카드 사용액', () => {
  it('명의자별로 나눠서 더한다', () => {
    const [a, b] = cardSpentFromConfessions(
      [c(1, 10_000), c(2, 5_000), c(1, 3_000)],
      '2026',
    )
    expect([a, b]).toEqual([13_000, 5_000])
  })

  it('카드 주인을 안 고른 기록은 세지 않는다', () => {
    // 이 기능 이전에 쌓인 기록들 — 누구 카드인지 모르니 넣으면 안 된다
    expect(cardSpentFromConfessions([c(undefined, 90_000)], '2026')).toEqual([0, 0])
  })

  it('저축·투자·수입은 카드 공제 대상이 아니라 빠진다', () => {
    const items = [c(1, 100_000, 'saving'), c(1, 200_000, 'investment'), c(1, 7_000, 'income')]
    expect(cardSpentFromConfessions(items, '2026')).toEqual([0, 0])
  })

  it('고정지출도 카드로 냈으면 포함한다', () => {
    expect(cardSpentFromConfessions([c(2, 80_000, 'fixed')], '2026')).toEqual([0, 80_000])
  })

  it('다른 해 기록은 빠진다', () => {
    const items = [c(1, 50_000, 'variable', '2025-12-31T12:00:00.000Z'), c(1, 1_000)]
    expect(cardSpentFromConfessions(items, '2026')).toEqual([1_000, 0])
  })
})
