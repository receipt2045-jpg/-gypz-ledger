import type { Confession, MonthlyLedger, Profile } from '../types'

/**
 * 구성원 1·2 자리 바꾸기 — 기록이 이름을 따라간다 (2026-10-07 제보).
 * "제가 먼저 만들고 남편 이름을 구성원 1에 적었더니 (나)가 남편 옆에 붙어요.
 *  이름 바꾸기를 눌렀더니 내용은 안 바뀌고 이름만 바뀌어요."
 *
 * 계정의 번호(누가 1번인지)는 그대로 두고, 1·2로 적힌 기록을 모두 맞바꾼다.
 * 그러면 '현수'로 적은 건 계속 현수 것이고, (나) 표시만 내 이름으로 옮겨진다.
 * 자산 주인은 이름 글자로 저장되므로 건드리지 않는다.
 */
export const other = (m: 1 | 2): 1 | 2 => (m === 1 ? 2 : 1)

export function swapProfile(p: Profile): Profile {
  const next: Profile = {
    ...p,
    member1Name: p.member2Name,
    member2Name: p.member1Name,
    member1Color: p.member2Color,
    member2Color: p.member1Color,
  }
  if (p.goal) next.goal = { ...p.goal, role1: p.goal.role2, role2: p.goal.role1 }
  if (p.roadmap) {
    next.roadmap = {
      ...p.roadmap,
      income1: p.roadmap.income2,
      income2: p.roadmap.income1,
      events: p.roadmap.events.map((e) => (e.member ? { ...e, member: other(e.member) } : e)),
    }
  }
  return next
}

export function swapLedger(l: MonthlyLedger): MonthlyLedger {
  return {
    ...l,
    items: l.items.map((it) => ({ ...it, member: other(it.member) })),
    settledMembers: l.settledMembers?.map(other),
    ...(l.contributions ? { contributions: { 1: l.contributions[2], 2: l.contributions[1] } } : {}),
  }
}

export function swapConfession(c: Confession): Confession {
  return {
    ...c,
    memberNo: other(c.memberNo),
    ...(c.cardOwner ? { cardOwner: other(c.cardOwner) } : {}),
  }
}
