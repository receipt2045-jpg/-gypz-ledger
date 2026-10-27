import { useEffect, useMemo, useState } from 'react'
import { useLedgerStore } from '../lib/store'
import { fetchChildRecords } from '../lib/db'
import { GIFT_LIMIT_MINOR, summarizeChild, type ChildRecord } from '../lib/childMoney'
import { abbreviateKRW } from '../lib/format'

/**
 * 자산 탭 — 아이 통장 (2026-10-27).
 * 아이 이름으로 들어온 돈(올해)과 '부모·조부모가 준 돈'의 10년 누적을 증여 한도와 같이 본다.
 * 아이 이름 자산(통장)은 자산 등록에서 소유자를 아이로 고른 것.
 */
export default function ChildMoneyCard({ childAssets }: { childAssets: Record<string, number> }) {
  const { householdId, confessions, profile } = useLedgerStore()
  const children = profile.childNames ?? []
  const [records, setRecords] = useState<ChildRecord[] | null>(null)

  useEffect(() => {
    let live = true
    if (!householdId || children.length === 0) return
    fetchChildRecords(householdId)
      .then((r) => live && setRecords(r))
      .catch(() => live && setRecords(null))
    return () => {
      live = false
    }
    // 아이 이름이 바뀌거나 새 기록이 생기면 다시 읽는다
  }, [householdId, children.length, confessions.length])

  // 서버에서 못 읽으면(둘러보기 등) 앱에 있는 최근 기록으로
  const all: ChildRecord[] = useMemo(
    () =>
      records ??
      confessions
        .filter((c) => c.child)
        .map((c) => ({
          child: c.child!,
          category: c.category,
          amount: c.amount,
          childKeep: c.childKeep !== false,
          gift: !!c.gift,
          createdAt: c.createdAt,
        })),
    [records, confessions],
  )

  if (children.length === 0) return null

  return (
    <section aria-label="아이 통장" className="space-y-2.5">
      {children.map((name) => {
        const s = summarizeChild(all, name)
        const asset = childAssets[name] ?? 0
        const giftRatio = Math.min(1, s.gift10y / GIFT_LIMIT_MINOR)
        return (
          <div key={name} className="rounded-card bg-card px-4 py-3.5 shadow-card">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-bold text-ink">🧒 {name} 통장</span>
              <span className="tnum text-[15px] font-bold text-ink">
                {asset > 0 ? abbreviateKRW(asset) : '—'}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-sub">
              올해 {name} 앞으로 들어온 돈{' '}
              <b className="tnum font-bold text-ink">+{abbreviateKRW(s.yearTotal)}</b>
            </p>
            {s.yearTotal > 0 && (
              <p className="text-[11.5px] text-cap">
                아동수당·지원금 {abbreviateKRW(s.yearSupport)} · 용돈·선물{' '}
                {abbreviateKRW(s.yearGift)}
                {s.yearToHousehold > 0 && ` · 살림에 보탠 돈 ${abbreviateKRW(s.yearToHousehold)}`}
              </p>
            )}
            <div className="mt-3 rounded-btn bg-bg px-3 py-2.5">
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="font-bold text-sub">부모·조부모가 준 돈 (증여)</span>
                <span className="tnum font-bold text-ink">
                  {abbreviateKRW(s.gift10y)} / {abbreviateKRW(GIFT_LIMIT_MINOR)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${giftRatio >= 0.9 ? 'bg-danger' : 'bg-amber-500'}`}
                  style={{ width: `${giftRatio * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-cap">
                미성년 자녀는 10년간 합쳐 2,000만원까지 증여세가 없어요. '부모·조부모가 준 돈'으로
                적은 기록만 더했어요 · 아동수당은 안 들어가요 · 참고용이에요
              </p>
            </div>
            {s.yearTotal === 0 && (
              <p className="mt-2 text-[11.5px] text-cap">
                소비 기록에서 아이 앞으로 🧒 {name} 버튼을 누르고 "아동수당 10만원"처럼 적어 보세요
              </p>
            )}
          </div>
        )
      })}
    </section>
  )
}
