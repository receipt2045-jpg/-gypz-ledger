import { describe, expect, it } from 'vitest'
import { summarizeChild, type ChildRecord } from './childMoney'

const r = (p: Partial<ChildRecord>): ChildRecord => ({
  child: '하율',
  category: '아동수당·지원금',
  amount: 100_000,
  childKeep: true,
  gift: false,
  createdAt: '2026-10-25T03:00:00Z',
  ...p,
})

describe('아이 앞으로 들어온 돈 (2026-10-27)', () => {
  it('올해 합계·지원금/용돈·모은 돈/살림에 보탠 돈, 10년 증여 누적', () => {
    const s = summarizeChild(
      [
        r({}),
        r({ category: '용돈·선물', amount: 50_000, gift: true }),
        r({
          category: '용돈·선물',
          amount: 300_000,
          gift: true,
          createdAt: '2020-02-01T00:00:00Z',
        }),
        r({ amount: 100_000, childKeep: false }),
        r({ child: '둘째', amount: 999 }),
        r({
          category: '용돈·선물',
          amount: 1_000_000,
          gift: true,
          createdAt: '2014-01-01T00:00:00Z',
        }),
      ],
      '하율',
      new Date('2026-10-27T00:00:00Z'),
    )
    expect(s).toEqual({
      yearTotal: 250_000,
      yearSupport: 200_000,
      yearGift: 50_000,
      yearKept: 150_000,
      yearToHousehold: 100_000,
      gift10y: 350_000,
    })
  })
})
