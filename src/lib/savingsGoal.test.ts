import { describe, expect, it } from 'vitest'
import { monthsBetween, paceWithoutIncome, planGoal } from './savingsGoal'

const 만 = 10_000
const NOW = '2026-09'
// 목업 숫자 그대로: 1억 8천을 2029년 3월까지, 지금 3,100만, 월 저축 330 + 부수입 30
const goal = { amount: 18_000 * 만, targetYm: '2029-03' }
const pace = { monthlySaving: 330 * 만, monthlySide: 30 * 만 }
const HAVE = 3_100 * 만

describe('달 수 세기', () => {
  it('같은 해 안', () => expect(monthsBetween('2026-09', '2026-12')).toBe(3))
  it('해를 넘어서', () => expect(monthsBetween('2026-09', '2029-03')).toBe(30))
  it('과거면 음수', () => expect(monthsBetween('2026-09', '2026-01')).toBe(-8))
})

describe('지금 속도면 — 목업 숫자가 그대로 나온다', () => {
  const p = planGoal(HAVE, goal, pace, NOW)

  it('남은 달 30', () => expect(p.monthsLeft).toBe(30))
  it('월 속도 360만', () => expect(p.monthlyPace).toBe(360 * 만))
  it('목표 달에 1억 3,900만', () => expect(p.projected).toBe(13_900 * 만))
  it('4,100만 모자람', () => expect(p.gap).toBe(4_100 * 만))
  it('진행률 17%', () => expect(Math.round(p.progress * 100)).toBe(17))
  it('지렛대 ① 월 +137만 → 만원 올림 137만', () => {
    // 4,100 / 30 = 136.67 → 137
    expect(p.extraPerMonth).toBe(137 * 만)
  })
  it('지렛대 ② 12개월 늦음', () => {
    // (18,000 − 3,100) / 360 = 41.4 → 42달 → 30달보다 12달 늦음
    expect(p.delayMonths).toBe(12)
    expect(p.reachYm).toBe('2030-03')
  })
  it('12개월이면 아직 "조금 모자라요"', () => expect(p.status).toBe('slight'))
})

describe('상태 배지', () => {
  it('제때 닿으면 잘 가고 있어요', () => {
    const p = planGoal(HAVE, goal, { monthlySaving: 500 * 만, monthlySide: 0 }, NOW)
    expect(p.gap).toBeLessThanOrEqual(0)
    expect(p.status).toBe('on')
    expect(p.delayMonths).toBe(0)
  })

  it('13개월 늦으면 다시 잡아야 해요', () => {
    // 속도를 낮춰 13달 이상 늦게
    const p = planGoal(HAVE, goal, { monthlySaving: 340 * 만, monthlySide: 0 }, NOW)
    expect(p.delayMonths!).toBeGreaterThan(12)
    expect(p.status).toBe('off')
  })

  it('저축이 0이면 닿는 날이 없고 다시 잡아야 해요', () => {
    const p = planGoal(HAVE, goal, { monthlySaving: 0, monthlySide: 0 }, NOW)
    expect(p.reachYm).toBeNull()
    expect(p.delayMonths).toBeNull()
    expect(p.status).toBe('off')
  })

  it('이미 모았으면 바로 달성', () => {
    const p = planGoal(20_000 * 만, goal, pace, NOW)
    expect(p.status).toBe('on')
    expect(p.progress).toBe(1)
    expect(p.reachYm).toBe(NOW)
    expect(p.extraPerMonth).toBe(0)
  })
})

describe('가장자리', () => {
  it('목표 달이 이미 지났으면 남은 달 0, 더 낼 월액은 없음(null)', () => {
    const p = planGoal(HAVE, { amount: goal.amount, targetYm: '2026-01' }, pace, NOW)
    expect(p.monthsLeft).toBe(0)
    expect(p.projected).toBe(HAVE)
    expect(p.extraPerMonth).toBeNull()
  })

  it('음수 저축(적자)은 0으로 본다 — 빚내서 모으진 않는다', () => {
    const p = planGoal(HAVE, goal, { monthlySaving: -50 * 만, monthlySide: 0 }, NOW)
    expect(p.monthlyPace).toBe(0)
  })

  it('목표가 0이면 진행률 0으로 죽지 않는다', () => {
    const p = planGoal(HAVE, { amount: 0, targetYm: '2029-03' }, pace, NOW)
    expect(p.progress).toBe(0)
    expect(Number.isFinite(p.gap)).toBe(true)
  })
})

describe('연도별', () => {
  it('지금 → 12달마다 → 목표 달 순으로, 마지막은 목표 달', () => {
    const p = planGoal(HAVE, goal, pace, NOW)
    expect(p.yearly.map((y) => y.ym)).toEqual(['2026-09', '2027-09', '2028-09', '2029-03'])
  })

  it('값은 같은 속도로 쌓인다', () => {
    const p = planGoal(HAVE, goal, pace, NOW)
    expect(p.yearly.map((y) => y.value / 만)).toEqual([3_100, 7_420, 11_740, 13_900])
  })

  it('목표 달이 딱 12의 배수면 중복 없이 끝난다', () => {
    const p = planGoal(HAVE, { amount: goal.amount, targetYm: '2028-09' }, pace, NOW)
    expect(p.yearly.map((y) => y.ym)).toEqual(['2026-09', '2027-09', '2028-09'])
  })

  it('목표 달이 지금이면 한 점만', () => {
    const p = planGoal(HAVE, { amount: goal.amount, targetYm: NOW }, pace, NOW)
    expect(p.yearly).toEqual([{ ym: NOW, value: HAVE }])
  })
})

describe('만약에 — 한 사람 소득이 멈추면', () => {
  it('그 사람 소득만큼 저축 여력이 준다', () => {
    const cut = paceWithoutIncome(pace, 250 * 만)
    expect(cut.monthlySaving).toBe(80 * 만)
    expect(cut.monthlySide).toBe(30 * 만) // 부수입은 안 건드림
  })

  it('소득이 저축보다 크면 0에서 멈춘다', () => {
    expect(paceWithoutIncome(pace, 999 * 만).monthlySaving).toBe(0)
  })

  it('시점이 얼마나 밀리는지 바로 나온다', () => {
    const cut = paceWithoutIncome(pace, 250 * 만)
    const p = planGoal(HAVE, goal, cut, NOW)
    // (18,000 − 3,100) / 110 = 135.5 → 136달 → 30달보다 106달 늦음
    expect(p.delayMonths).toBe(106)
    expect(p.status).toBe('off')
  })
})
