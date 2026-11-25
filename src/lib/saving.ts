import type { AssetItem } from '../types'
import { dayString, payDatesSince } from './loan'

/**
 * 적금 자동 저축 (2026-11-24 의견: "적금 보면 현재 자산만 입력할 수 있는데, 월별로 자동으로 저축하는 기능을 넣어 주세요").
 * 예적금 항목에 매달 넣는 돈·넣는 날을 적어 두면, 넣는 날이 지날 때마다 잔액에 그만큼 더한다.
 * 대출(catchUpLoan)과 같은 방식 — asOf까지는 잔액에 들어 있고, 그 뒤 넣는 날부터 더한다.
 */
export interface SavingPlan {
  /** 매달 넣는 돈(원) */
  monthly: number
  /** 넣는 날 1~31 (그 달에 없는 날이면 말일) */
  day: number
  /** 이 날짜까지 넣은 돈은 잔액(amount)에 들어 있음 'YYYY-MM-DD' */
  asOf: string
  /** 만기 달 'YYYY-MM' — 이 달 넣는 날까지만 더한다. 없으면 계속 */
  endYm?: string
}

const ymOf = (d: Date) => dayString(d).slice(0, 7)

/** asOf 뒤로 today까지 지난 넣는 날 (만기 달까지만) */
export function savingDatesSince(plan: SavingPlan, today: Date): Date[] {
  return payDatesSince(plan.asOf, today, plan.day).filter(
    (d) => !plan.endYm || ymOf(d) <= plan.endYm,
  )
}

/** 지난 넣는 날만큼 잔액을 늘린 항목. 바뀐 게 없으면 null */
export function catchUpSaving(item: AssetItem, today: Date): AssetItem | null {
  const plan = item.saving
  if (item.kind !== 'asset' || !plan || plan.monthly <= 0) return null
  const dates = savingDatesSince(plan, today)
  if (dates.length === 0) return null
  return {
    ...item,
    amount: item.amount + plan.monthly * dates.length,
    saving: { ...plan, asOf: dayString(dates[dates.length - 1]) },
  }
}

/** 다음 넣는 날 — 만기가 지났으면 null */
export function nextSavingDate(plan: SavingPlan, today: Date): Date | null {
  const from = { ...plan, asOf: dayString(today) }
  const far = new Date(today.getFullYear() + 1, today.getMonth() + 1, 1)
  return savingDatesSince(from, far)[0] ?? null
}

/** 만기 때 잔액 (이자 빼고 넣은 돈만) — 만기가 없으면 null */
export function savingAtEnd(amount: number, plan: SavingPlan, today: Date): number | null {
  if (!plan.endYm) return null
  const [y, m] = plan.endYm.split('-').map(Number)
  const end = new Date(y, m, 0) // 만기 달 말일
  if (end < today) return amount
  return amount + plan.monthly * savingDatesSince({ ...plan, asOf: dayString(today) }, end).length
}
