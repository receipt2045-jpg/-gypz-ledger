import { describe, expect, it } from 'vitest'
import {
  giftReportStatus,
  periodicGiftValue,
  periodicMaxMonthly,
  summarizeChild,
  type ChildRecord,
  type GiftReport,
} from './childMoney'

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

describe('증여 신고 기록 (2026-10-27)', () => {
  const now = new Date('2026-10-27T12:00:00')
  const report = (amount: number, reportedOn: string, child = '찰떡이'): GiftReport => ({
    id: reportedOn,
    child,
    reportedOn,
    amount,
    kind: 'lump',
  })

  it('증여로 적은 돈에서 신고한 돈을 빼면 아직 안 한 돈', () => {
    expect(giftReportStatus([report(5_000_000, '2026-03-02')], '찰떡이', 8_000_000, now)).toEqual({
      reported: 5_000_000,
      unreported: 3_000_000,
    })
  })

  it('정기금처럼 앞으로 줄 돈까지 신고했으면 안 한 돈은 0, 다른 아이·10년 넘은 신고는 안 센다', () => {
    const reports = [
      report(20_000_000, '2026-01-10'),
      report(9_000_000, '2026-01-10', '콩떡이'),
      report(3_000_000, '2015-05-01'),
    ]
    expect(giftReportStatus(reports, '찰떡이', 4_000_000, now)).toEqual({
      reported: 20_000_000,
      unreported: 0,
    })
  })
})

describe('유기정기금 평가 (연 3%)', () => {
  it('월 20만원씩 10년 = 2,400만원을 넣어도 평가액은 약 2,047만원', () => {
    expect(periodicGiftValue(200_000, 10)).toBe(20_472_487)
  })

  it('10년이면 월 19.5만원까지가 2,000만원 공제 안', () => {
    const max = periodicMaxMonthly(10)
    expect(max).toBe(195_000)
    expect(periodicGiftValue(max, 10)).toBeLessThanOrEqual(20_000_000)
    expect(periodicGiftValue(max + 1000, 10)).toBeGreaterThan(20_000_000)
  })
})
