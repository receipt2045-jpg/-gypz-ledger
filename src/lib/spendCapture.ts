// 카드·은행 앱 캡처로 소비 기록 적기 (2026-11-24) — supabase/functions/spend-capture
// "매일 기록 부분에 캡처본 올리면 바로 자동 저장해 주는 거 만들 수 있어?"
import { supabase } from './supabase'
import { CaptureError, shrinkImage, toBase64 } from './stockDb'
import { parseConfessionText, type ParsedEntry } from './confessParser'
import type { Categories, CategoryGroup, Confession } from '../types'

export interface SpendCaptureItem {
  date: string
  merchant: string
  amount: number
  kind: 'variable' | 'fixed' | 'income'
  category: string
  confident: boolean
}

export async function readSpendCapture(
  file: Blob,
  categories: Categories,
  today: string,
): Promise<SpendCaptureItem[]> {
  const image = await toBase64(await shrinkImage(file, 2000))
  const { data, error } = await supabase.functions.invoke('spend-capture', {
    body: {
      image,
      mediaType: 'image/jpeg',
      categories: {
        variable: categories.variable,
        fixed: categories.fixed,
        income: categories.income,
      },
      today,
    },
  })
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status
    throw new CaptureError(status === 401 ? 'login' : status === 429 ? 'limit' : 'failed')
  }
  return (data?.items ?? []) as SpendCaptureItem[]
}

export interface CaptureDraft extends ParsedEntry {
  date: string
  /** 흐리거나 잘려서 금액·날짜를 다시 봐야 하는 건 */
  unsure?: boolean
}

const dayOf = (iso: string) => new Date(iso).toLocaleDateString('sv-SE')

/**
 * 읽은 결과 → 확인 화면 항목.
 * - 종류: 우리 집이 고쳐 가르친 말(별칭)이 먼저, 없으면 캡처를 읽으며 고른 것, 그것도 없으면 기타
 * - 같은 날·같은 금액이 이미 적혀 있으면 빼고 dup으로 돌려준다 (캡처를 두 번 올려도 두 번 안 적히게)
 * - 날짜가 안 보이면 고른 날짜, 앞으로의 날짜면 고른 날짜로
 */
export function captureToDrafts(
  items: SpendCaptureItem[],
  categories: Categories,
  aliases: Record<string, string>,
  existing: Pick<Confession, 'createdAt' | 'amount' | 'kind'>[],
  fallbackDate: string,
  today: string,
): { drafts: CaptureDraft[]; dup: string[] } {
  const drafts: CaptureDraft[] = []
  const dup: string[] = []
  const seen = new Set(existing.map((c) => `${dayOf(c.createdAt)}|${c.amount}|${c.kind}`))
  for (const it of items) {
    const amount = Math.round(Math.abs(Number(it.amount) || 0))
    if (amount <= 0) continue
    const merchant = String(it.merchant ?? '')
      .replace(/\(주\)|㈜|주식회사/g, '')
      .trim()
    const date = /^\d{4}-\d{2}-\d{2}$/.test(it.date) && it.date <= today ? it.date : fallbackDate
    const kind: CategoryGroup = it.kind === 'income' || it.kind === 'fixed' ? it.kind : 'variable'

    let category = ''
    let matched = false
    const parsed = merchant
      ? parseConfessionText(`${merchant} ${amount}원`, categories, aliases).entries[0]
      : undefined
    if (parsed?.matched && (parsed.kind === kind || kind === 'variable')) {
      category = parsed.category
      matched = true
    } else if (categories[kind].includes(it.category)) {
      category = it.category
      matched = true
    }
    // 못 찾았으면 이 집에 실제로 있는 종류로 (파서와 같은 규칙)
    let finalKind: CategoryGroup =
      parsed?.matched && category === parsed.category ? parsed.kind : kind
    if (!matched) {
      if (kind === 'income' && categories.income.length) category = categories.income[0]
      else {
        finalKind = 'variable'
        category = categories.variable.includes('기타')
          ? '기타'
          : (categories.variable[0] ?? '기타')
      }
    }

    const key = `${date}|${amount}|${finalKind}`
    if (seen.has(key)) {
      dup.push(`${merchant || category} ${amount.toLocaleString('ko-KR')}원`)
      continue
    }
    drafts.push({
      category,
      kind: finalKind,
      amount,
      note: merchant || undefined,
      raw: merchant,
      matched,
      date,
      ...(it.confident === false ? { unsure: true } : {}),
    })
  }
  return { drafts, dup }
}
