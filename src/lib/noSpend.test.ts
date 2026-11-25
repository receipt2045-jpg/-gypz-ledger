import { describe, expect, it } from 'vitest'
import { noSpendDays } from './noSpend'

const r = (day: string, kind: string, amount: number, category = '식비') => ({
  createdAt: `2026-11-${day}T12:00:00.000Z`,
  kind,
  category,
  amount,
})

describe('무지출 하트 (2026-11-24)', () => {
  it('기록 시작한 날부터 어제까지 쓴 돈이 없는 날은 하트 — 무지출 버튼을 안 눌렀어도', () => {
    const month = [r('03', 'variable', 9_000), r('05', 'variable', 4_000)]
    const days = noSpendDays('2026-11', month, month, '2026-11-07')
    // 3일이 첫 기록 — 1·2일은 쓰기 전이라 빼고, 7일(오늘)은 아직 안 끝나서 빼고
    expect([...days]).toEqual(['2026-11-04', '2026-11-06'])
  })

  it('한 사람이 무지출이라 적어도 배우자가 쓴 날은 하트가 아니다', () => {
    const month = [r('04', 'variable', 0, '무지출'), r('04', 'variable', 5_500)]
    expect(noSpendDays('2026-11', month, month, '2026-11-10').has('2026-11-04')).toBe(false)
  })

  it('오늘도 무지출로 적었으면 하트, 저축·수입만 있는 날도 무지출', () => {
    const month = [
      r('01', 'variable', 3_000),
      r('05', 'saving', 500_000),
      r('09', 'variable', 0, '무지출'),
    ]
    const days = noSpendDays('2026-11', month, month, '2026-11-09')
    expect(days.has('2026-11-05')).toBe(true)
    expect(days.has('2026-11-09')).toBe(true)
  })
})
