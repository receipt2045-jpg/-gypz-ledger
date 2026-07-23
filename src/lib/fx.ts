import { useEffect, useState } from 'react'

// 지원 통화. KRW가 기본(원화)이며, 나머지는 실시간 환율로 원화 환산.
export type Currency = 'KRW' | 'USD' | 'EUR' | 'JPY'
export const CURRENCIES: Currency[] = ['KRW', 'USD', 'EUR', 'JPY']
export const CURRENCY_LABEL: Record<Currency, string> = {
  KRW: '원 (KRW)',
  USD: '달러 (USD)',
  EUR: '유로 (EUR)',
  JPY: '엔 (JPY)',
}
export const CURRENCY_SYMBOL: Record<Currency, string> = { KRW: '₩', USD: '$', EUR: '€', JPY: '¥' }

// [통화]→KRW 환율. KRW는 항상 1.
export type Rates = Record<Currency, number>

// 환율 정보 없을 때 대략적인 폴백 (앱이 깨지지 않게)
const FALLBACK: Rates = { KRW: 1, USD: 1380, EUR: 1490, JPY: 9.1 }

const CACHE_KEY = 'gypz-fx-rates'
const TTL = 60 * 60 * 1000 // 1시간

function readCache(): Rates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as { ts: number; rates: Rates }
    if (Date.now() - o.ts > TTL) return null
    return o.rates
  } catch {
    return null
  }
}

/** Frankfurter(ECB) 무료 환율. KRW 기준으로 받아 역수를 취해 [통화]→KRW로 변환. */
async function fetchRates(): Promise<Rates> {
  const res = await fetch('https://api.frankfurter.dev/v1/latest?base=KRW&symbols=USD,EUR,JPY')
  if (!res.ok) throw new Error('fx fetch failed')
  const data = (await res.json()) as { rates: Record<string, number> }
  const inv = (ccy: string) => (data.rates[ccy] ? 1 / data.rates[ccy] : FALLBACK[ccy as Currency])
  const rates: Rates = { KRW: 1, USD: inv('USD'), EUR: inv('EUR'), JPY: inv('JPY') }
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rates }))
  return rates
}

/**
 * 실시간 환율 훅 — 캐시가 있으면 즉시 반환하고, 만료됐으면 백그라운드로 갱신.
 * 실패하면 폴백 환율을 써서 앱이 멈추지 않게 한다.
 */
export function useFxRates(): Rates {
  const [rates, setRates] = useState<Rates>(() => readCache() ?? FALLBACK)

  useEffect(() => {
    if (readCache()) return // 캐시 유효하면 재요청 안 함
    let alive = true
    fetchRates()
      .then((r) => alive && setRates(r))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  return rates
}

/** 항목 하나를 원화로 환산 (외화면 실시간 환율 적용, 아니면 저장된 원화 그대로) */
export function krwOf(item: { amount: number; currency?: string; fxAmount?: number }, rates: Rates): number {
  const ccy = item.currency as Currency | undefined
  if (ccy && ccy !== 'KRW' && item.fxAmount != null) {
    return Math.round(item.fxAmount * (rates[ccy] ?? FALLBACK[ccy]))
  }
  return item.amount
}
