import { effectiveAmount } from './carryover'
import type { MonthlyLedger } from '../types'

export interface LedgerNumbers {
  ym: string
  payWife: number
  payHusband: number
  fixed: number
  variable: number
  /** 정산이 끝난 달이면 true, 아직이면 예산(계획) 기준 */
  closed: boolean
}

/**
 * 육아휴직 계산기에 넣을 우리집 숫자를 가계부에서 꺼낸다.
 *
 * 수입이 적힌 가장 최근 달을 쓴다. 금액은 다른 화면과 같은 규칙(effectiveAmount):
 * 정산한 달은 실제, 아직이면 실제가 없을 때 계획.
 * 구성원 1 = 남편, 2 = 아내 (Profile 기본값과 같다).
 */
export function leaveNumbersFromLedgers(ledgers: MonthlyLedger[]): LedgerNumbers | null {
  const sorted = [...ledgers].sort((a, b) => b.ym.localeCompare(a.ym))
  for (const lg of sorted) {
    const sum = (pred: (group: string, member: number) => boolean) =>
      lg.items
        .filter((it) => pred(it.group, it.member))
        .reduce((a, it) => a + effectiveAmount(it, lg.closed), 0)
    const payHusband = sum((g, m) => g === 'income' && m === 1)
    const payWife = sum((g, m) => g === 'income' && m === 2)
    if (payHusband + payWife <= 0) continue
    return {
      ym: lg.ym,
      payWife,
      payHusband,
      fixed: sum((g) => g === 'fixed'),
      variable: sum((g) => g === 'variable'),
      closed: lg.closed,
    }
  }
  return null
}
