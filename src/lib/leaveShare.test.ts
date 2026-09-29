import { describe, expect, it } from 'vitest'
import { DEFAULT_INPUT, type LeaveInput } from './parentalLeave'
import { decodeLeave, encodeLeave, leaveShareUrl, sharedFromHash } from './leaveShare'
import { pickRuns } from './leaveCard'

const mine: LeaveInput = {
  ...DEFAULT_INPUT,
  payWife: 3_100_000,
  who: 'both',
  monthsWife: 18,
  monthsHusband: 26,
  order: 'sim',
  daycareFrom: 13,
  insuredHusband: false,
  sideHusband: 500_000,
}

describe('공유 링크에 우리집 숫자 싣기', () => {
  it('보낸 숫자 그대로 돌아온다', () => {
    expect(decodeLeave(encodeLeave(mine))).toEqual(mine)
  })

  it('주소의 # 뒤에 실린다 — 서버로 가지 않는다', () => {
    const url = leaveShareUrl(mine, 'https://moabuli.com')
    expect(url.startsWith('https://moabuli.com/#/leave?s=')).toBe(true)
    expect(sharedFromHash(new URL(url).hash)).toEqual(mine)
  })

  it('못 읽는 링크는 무시한다', () => {
    expect(decodeLeave('망가진값')).toBeNull()
    expect(sharedFromHash('#/leave')).toBeNull()
  })

  it('이상한 값은 기본값으로 채운다', () => {
    const bad = btoa(JSON.stringify([-5, 'x', 1_000_000, null, 'nobody', 99, 0, 'z', 1, 5, 'yes']))
    const v = decodeLeave(bad)!
    expect(v.payWife).toBe(DEFAULT_INPUT.payWife)
    expect(v.fixed).toBe(1_000_000)
    expect(v.who).toBe(DEFAULT_INPUT.who)
    expect(v.monthsWife).toBe(DEFAULT_INPUT.monthsWife)
    expect(v.daycareFrom).toBe(DEFAULT_INPUT.daycareFrom)
    expect(v.insuredWife).toBe(true)
  })
})

describe('이미지 카드 — 칸은 4개까지', () => {
  const run = (from: number) => ({ from, to: from, month: {} as never })
  it('4개 이하면 그대로', () => {
    expect(pickRuns([run(1), run(2)]).skipped).toBe(0)
  })
  it('넘치면 앞 3칸 + 마지막 칸', () => {
    const { shown, skipped } = pickRuns([run(1), run(2), run(3), run(4), run(5), run(6)])
    expect(shown.map((r) => r.from)).toEqual([1, 2, 3, 6])
    expect(skipped).toBe(2)
  })
})
