import { describe, expect, it } from 'vitest'
import { forward, reverse, spendable, type RetireInput } from './retirement'

const base: RetireInput = { age: 34, retireAge: 60, start: 0, rate: 5, postRate: 3, lifeAge: 90 }

describe('노후 준비 계산기', () => {
  it('수익률 0이면 넣은 돈 그대로', () => {
    const r = forward({ ...base, rate: 0, start: 1_000_000 }, 100_000)
    expect(r.balance).toBe(1_000_000 + 100_000 * 12 * 26)
    expect(r.series).toHaveLength(27)
  })

  it('복리 — 월 60만, 연 5%, 26년이면 원금(1.87억)보다 훨씬 많다', () => {
    const r = forward(base, 600_000)
    expect(r.series.at(-1)!.paid).toBe(187_200_000)
    expect(r.balance).toBeGreaterThan(380_000_000)
    expect(r.balance).toBeLessThan(400_000_000)
  })

  it('원금을 남기면 이자만, 다 쓰면 더 많이', () => {
    const s = spendable(400_000_000, base)
    expect(s.keep).toBe(1_000_000)
    expect(s.useUp).toBeGreaterThan(s.keep)
  })

  it('거꾸로 — 매달 100만 쓰려면 필요한 돈과 월 저축이 앞뒤로 맞는다', () => {
    const r = reverse(base, 1_000_000)
    expect(r.needKeep).toBe(400_000_000)
    const back = forward(base, r.monthlyKeep!)
    expect(Math.abs(back.balance - 400_000_000)).toBeLessThan(400) // 반올림 오차
  })

  it('이미 모인 돈으로 충분하면 더 모을 필요 0', () => {
    expect(reverse({ ...base, start: 900_000_000 }, 1_000_000).monthlyKeep).toBe(0)
  })
})
