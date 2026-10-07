import { afterEach, describe, expect, it } from 'vitest'
import { periodLabel, setMonthStartDay, ymOfDate, ymOfDay } from './format'
import { ymOfIso } from './confessLedger'

describe('우리집 한 달 시작일 (2026-10-07 제보: 급여일 15일 기준으로 한 달)', () => {
  afterEach(() => setMonthStartDay(1))

  it('기본(1일)은 예전과 같다', () => {
    expect(ymOfDate(new Date(2026, 9, 1))).toBe('2026-10')
    expect(ymOfDate(new Date(2026, 9, 31))).toBe('2026-10')
    expect(periodLabel('2026-10')).toBeNull()
  })

  it('15일 시작이면 14일까지는 앞 달, 15일부터 그 달', () => {
    setMonthStartDay(15)
    expect(ymOfDate(new Date(2026, 9, 14))).toBe('2026-09')
    expect(ymOfDate(new Date(2026, 9, 15))).toBe('2026-10')
    expect(ymOfDate(new Date(2026, 10, 14))).toBe('2026-10')
    expect(periodLabel('2026-10')).toBe('10월 15일 ~ 11월 14일')
  })

  it('연말·연초도 이어진다', () => {
    setMonthStartDay(25)
    expect(ymOfDate(new Date(2027, 0, 10))).toBe('2026-12')
    expect(periodLabel('2026-12')).toBe('12월 25일 ~ 1월 24일')
  })

  it('경조사 날짜·소비 기록 시각도 같은 기준으로', () => {
    setMonthStartDay(15)
    expect(ymOfDay('2026-10-10')).toBe('2026-09')
    expect(ymOfIso(new Date(2026, 9, 20, 9).toISOString())).toBe('2026-10')
  })

  it('1~28일만 — 그 밖은 1일로', () => {
    setMonthStartDay(31)
    expect(periodLabel('2026-10')).toBeNull()
  })
})
