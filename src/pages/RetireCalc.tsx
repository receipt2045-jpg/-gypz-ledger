import { useMemo, useState } from 'react'
import AmountInput from '../components/AmountInput'
import Card from '../components/Card'
import CalcShell, { CalcRow, NumField } from '../components/CalcShell'
import { useLedgerStore } from '../lib/store'
import { resolveLedger, resolveSnapshot } from '../lib/carryover'
import { abbreviateKRW, currentYm } from '../lib/format'
import { forward, reverse, type RetireInput } from '../lib/retirement'

const short = (n: number) => abbreviateKRW(n).replace(/원$/, '')

/**
 * 노후 준비 계산기 (2026-10-07). 두 방향 — 지금 모으면 노후에 얼마 / 노후에 얼마 쓰려면 지금 얼마.
 * 연금 자산(자산 탭)과 매달 연금 저축(가계부)으로 먼저 채운다.
 */
export default function RetireCalc() {
  const { snapshots, ledgers } = useLedgerStore()
  const ym = currentYm()
  const pensionNow = useMemo(
    () =>
      resolveSnapshot(snapshots, ym)
        .items.filter((it) => it.kind === 'asset' && it.group === 'pension')
        .reduce((a, it) => a + it.amount, 0),
    [snapshots, ym],
  )
  const pensionMonthly = useMemo(
    () =>
      resolveLedger(ledgers, ym)
        .items.filter(
          (it) => (it.group === 'saving' || it.group === 'investment') && /연금/.test(it.category),
        )
        .reduce((a, it) => a + (it.planned || it.actual), 0),
    [ledgers, ym],
  )

  const [mode, setMode] = useState<'forward' | 'reverse'>('forward')
  const [input, setInput] = useState<RetireInput>({
    age: 33,
    retireAge: 60,
    start: pensionNow,
    rate: 5,
    postRate: 3,
    lifeAge: 90,
  })
  const [monthly, setMonthly] = useState(pensionMonthly || 500_000)
  const [want, setWant] = useState(2_000_000)
  const set = (patch: Partial<RetireInput>) => setInput((v) => ({ ...v, ...patch }))

  const valid = input.retireAge > input.age && input.lifeAge > input.retireAge
  const fwd = valid ? forward(input, monthly) : null
  const rev = valid ? reverse(input, want) : null
  const maxBal = fwd ? Math.max(1, ...fwd.series.map((p) => p.balance)) : 1

  return (
    <CalcShell
      title="노후 준비"
      lead="지금 모으는 돈이 노후에 매달 얼마가 되는지, 거꾸로 노후에 쓰고 싶은 돈을 위해 지금 얼마씩 모아야 하는지 봐요."
      cta="노후 계획, 결영이네와 같이"
    >
      <div className="flex gap-1.5" role="tablist">
        {(
          [
            ['forward', '지금 모으면 → 노후에 얼마'],
            ['reverse', '노후에 얼마 → 지금 얼마'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={mode === k}
            onClick={() => setMode(k)}
            className={`flex-1 rounded-full border px-2 py-2 text-[12.5px] font-bold ${
              mode === k ? 'border-brand bg-brand text-white' : 'border-line bg-white text-sub'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CalcRow label="지금 나이">
          <NumField
            label="지금 나이"
            value={input.age}
            onChange={(n) => set({ age: n })}
            unit="세"
          />
        </CalcRow>
        <CalcRow label="은퇴 나이">
          <NumField
            label="은퇴 나이"
            value={input.retireAge}
            onChange={(n) => set({ retireAge: n })}
            unit="세"
          />
        </CalcRow>
        <CalcRow label="몇 살까지 쓸지">
          <NumField
            label="몇 살까지 쓸지"
            value={input.lifeAge}
            onChange={(n) => set({ lifeAge: n })}
            unit="세"
          />
        </CalcRow>
        <CalcRow label="지금 연금 자산" auto={pensionNow ? '자산' : undefined}>
          <AmountInput value={input.start} onChange={(n) => set({ start: n })} />
        </CalcRow>
        {mode === 'forward' ? (
          <CalcRow label="매달 노후 저축" auto={pensionMonthly ? '가계부' : undefined}>
            <AmountInput value={monthly} onChange={setMonthly} />
          </CalcRow>
        ) : (
          <CalcRow label="노후에 매달 쓰고 싶은 돈">
            <AmountInput value={want} onChange={setWant} />
          </CalcRow>
        )}
        <CalcRow label="모으는 동안 수익률">
          <NumField
            label="모으는 동안 수익률"
            value={input.rate}
            onChange={(n) => set({ rate: n })}
            unit="%"
            decimal
          />
        </CalcRow>
        <CalcRow label="은퇴 뒤 수익률">
          <NumField
            label="은퇴 뒤 수익률"
            value={input.postRate}
            onChange={(n) => set({ postRate: n })}
            unit="%"
            decimal
          />
        </CalcRow>
      </Card>

      {!valid && (
        <p className="px-1 text-[13px] font-medium text-danger">
          은퇴 나이는 지금 나이보다, 쓰는 나이는 은퇴 나이보다 많아야 해요.
        </p>
      )}

      {mode === 'forward' && fwd && (
        <Card>
          <p className="text-[12.5px] text-cap">{input.retireAge}세에 모이는 돈</p>
          <p className="tnum text-[24px] font-extrabold text-ink">{short(fwd.balance)}원</p>
          <p className="tnum text-[12.5px] text-sub">
            그중 넣은 돈 {short(fwd.series.at(-1)!.paid)} · 불어난 돈{' '}
            {short(fwd.balance - fwd.series.at(-1)!.paid)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-btn bg-bg px-3 py-2.5">
              <p className="text-[12px] text-cap">원금은 남기고 쓰면</p>
              <p className="tnum text-[16px] font-bold text-ink">매달 {short(fwd.keep)}원</p>
            </div>
            <div className="rounded-btn bg-bg px-3 py-2.5">
              <p className="text-[12px] text-cap">{input.lifeAge}세까지 다 쓰면</p>
              <p className="tnum text-[16px] font-bold text-brand">매달 {short(fwd.useUp)}원</p>
            </div>
          </div>
          {/* 연도별로 쌓이는 모습 — 진한 칸이 불어난 돈 */}
          <div className="mt-4 flex h-28 items-end gap-[2px]" aria-label="연도별 모이는 돈">
            {fwd.series.map((p) => (
              <div
                key={p.age}
                className="relative flex-1 rounded-t bg-brand"
                style={{ height: `${Math.max(2, (p.balance / maxBal) * 100)}%` }}
                title={`${p.age}세 ${short(p.balance)}원`}
              >
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t bg-brand/35"
                  style={{
                    height: `${p.balance ? Math.min(100, (p.paid / p.balance) * 100) : 0}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-cap">
            <span>{input.age}세</span>
            <span>옅은 칸 = 넣은 돈 · 진한 칸 = 불어난 돈</span>
            <span>{input.retireAge}세</span>
          </div>
        </Card>
      )}

      {mode === 'reverse' && rev && (
        <Card>
          <p className="text-[12.5px] text-cap">
            노후에 매달 {short(want)}원을 쓰려면 지금부터 매달
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-btn bg-bg px-3 py-2.5">
              <p className="text-[12px] text-cap">원금은 남기려면</p>
              <p className="tnum text-[16px] font-bold text-ink">
                {rev.monthlyKeep === null ? '—' : `${short(rev.monthlyKeep)}원`}
              </p>
              <p className="tnum mt-0.5 text-[11.5px] text-cap">
                {rev.needKeep === null
                  ? '은퇴 뒤 수익률을 넣어 주세요'
                  : `은퇴 때 ${short(rev.needKeep)} 필요`}
              </p>
            </div>
            <div className="rounded-btn bg-bg px-3 py-2.5">
              <p className="text-[12px] text-cap">{input.lifeAge}세까지 다 쓰려면</p>
              <p className="tnum text-[16px] font-bold text-brand">
                {rev.monthlyUseUp === null ? '—' : `${short(rev.monthlyUseUp)}원`}
              </p>
              <p className="tnum mt-0.5 text-[11.5px] text-cap">
                은퇴 때 {short(rev.needUseUp)} 필요
              </p>
            </div>
          </div>
        </Card>
      )}

      <p className="px-1 text-[12px] leading-relaxed text-cap">
        물가는 넣지 않았어요. 30년 뒤 200만원은 지금 돈 가치로 그보다 적어요. 수익률은 매년 같다고
        보고 계산해요.
      </p>
    </CalcShell>
  )
}
