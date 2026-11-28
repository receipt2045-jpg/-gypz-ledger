import type { AssetSnapshot, BudgetItem, MonthlyLedger, Profile } from '../types'
import { netWorthOf, resolveSnapshot, summarize } from './carryover'
import { shiftYm } from './format'

/**
 * 월간 결산 카드 — 부부가 둘 다 정산을 마치면 만들어지는 '우리집 성적표'.
 * 화면에도 그리고 이미지로도 내보내므로, 계산은 여기 한 곳에서만 한다.
 */
export interface MonthlyCardData {
  ym: string
  savingInvestRate: number
  savingInvest: number // 저축+투자 합계(원)
  surplus: number
  netWorth: number
  netWorthDelta: number
  /** 구성원별 저축·투자 기여액 [남편, 아내] */
  memberSaving: [number, number]
  memberNames: [string, string]
  headline: string
}

/**
 * 한 줄 평 — 저축률과 잉여현금으로 고른다.
 *
 * 잉여현금이 마이너스면 저축률이 높아도 축하할 상황이 아니라(빚내서 저축한 셈)
 * 그 경우를 먼저 거른다.
 */
export function headlineOf(rate: number, surplus: number): string {
  if (surplus < 0) return '쓴 돈이 번 돈보다 많았어요. 다음 달 예산을 다시 잡아요.'
  const pct = Math.round(rate * 100)
  if (pct >= 50) return `저축률 ${pct}%. 절반을 넘었어요. 이 속도면 목표가 앞당겨져요.`
  if (pct >= 40) return `저축률 ${pct}%. 잘 지켰어요.`
  if (pct >= 30) return `저축률 ${pct}%. 기준선을 넘었어요.`
  if (pct >= 20) return `저축률 ${pct}%. 10%만 더 올리면 좋아요.`
  if (pct >= 10) return `저축률 ${pct}%. 고정지출부터 점검해 볼 때예요.`
  return '이번 달 저축이 적었어요. 다음 달 예산부터 다시 세워요.'
}

/** 구성원별 저축·투자 합계 (결산 완료 기준이라 actual을 본다) */
function savingByMember(items: BudgetItem[], member: 1 | 2): number {
  return items
    .filter((it) => it.member === member && (it.group === 'saving' || it.group === 'investment'))
    .reduce((acc, it) => acc + it.actual, 0)
}

export function buildMonthlyCard(
  ledger: MonthlyLedger,
  snapshots: AssetSnapshot[],
  profile: Profile,
): MonthlyCardData {
  const s = summarize({ ...ledger, closed: true })
  const netWorth = netWorthOf(resolveSnapshot(snapshots, ledger.ym))
  const prevNetWorth = netWorthOf(resolveSnapshot(snapshots, shiftYm(ledger.ym, -1)))

  return {
    ym: ledger.ym,
    savingInvestRate: s.savingInvestRate,
    savingInvest: s.saving + s.investment,
    surplus: s.surplus,
    netWorth,
    netWorthDelta: netWorth - prevNetWorth,
    memberSaving: [savingByMember(ledger.items, 1), savingByMember(ledger.items, 2)],
    memberNames: [profile.member1Name, profile.member2Name],
    headline: headlineOf(s.savingInvestRate, s.surplus),
  }
}
