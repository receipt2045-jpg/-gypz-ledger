import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import Card from '../components/Card'
import CalcShell, { CalcRow, NumField } from '../components/CalcShell'
import { useLedgerStore } from '../lib/store'
import { netWorthOf, resolveSnapshot } from '../lib/carryover'
import { abbreviateKRW, currentYm, formatComma } from '../lib/format'
import {
  HOME_COST_BASE_DATE,
  computeHomeCost,
  defaultBondDiscount,
  type BondRegion,
  type HomeCostInput,
} from '../lib/homeCost'

const short = (n: number) => abbreviateKRW(n).replace(/원$/, '')

function Chips<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
            value === v ? 'border-brand bg-brand text-white' : 'border-line bg-white text-sub'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/**
 * 집 살 때 드는 돈 (2026-10-07). 집값 말고 잔금날 더 나가는 돈 — 세금·복비·법무사·등기·채권·대출 인지세.
 * 집값·대출은 로드맵의 '내 집 마련' 계획으로 먼저 채우고, 끝에 '필요한 우리 돈'을 순자산과 견준다.
 * 세율·요율은 lib/homeCost.ts 한 곳에 기준일과 함께 둔다.
 */
export default function HomeCostCalc() {
  const { profile, snapshots } = useLedgerStore()
  const house = (profile.roadmap?.events ?? []).find(
    (e) => e.kind === 'house' && (e.price ?? 0) > 0,
  )
  const netWorth = useMemo(() => netWorthOf(resolveSnapshot(snapshots, currentYm())), [snapshots])

  const [input, setInput] = useState<HomeCostInput>({
    price: house?.price ?? 500_000_000,
    bondRegion: 'metro',
    adjusted: false,
    over85: false,
    homesAfter: 1,
    firstHome: false,
    temporaryTwo: false,
    loan: house?.loan ?? 0,
    publicPrice: 0,
    bondDiscount: defaultBondDiscount(),
    brokerRate: 0,
    lawyerFee: 0,
  })
  const set = (patch: Partial<HomeCostInput>) => setInput((v) => ({ ...v, ...patch }))
  const [more, setMore] = useState(false)
  const r = computeHomeCost(input)
  const need = input.price - input.loan + r.total

  return (
    <CalcShell
      title="집 살 때 드는 돈"
      lead="계약서 금액 말고 잔금날 함께 나가는 돈이에요. 세금, 복비, 법무사, 채권까지 한 번에 봐요."
      cta="이 집, 사도 될지 결영이네와 같이"
    >
      <Card>
        <CalcRow label="집값 (매매가)" auto={house?.price ? '로드맵' : undefined}>
          <AmountInput value={input.price} onChange={(n) => set({ price: n })} />
        </CalcRow>
        <div className="space-y-3 py-3">
          <div>
            <p className="mb-1.5 text-[13px] text-sub">집이 있는 곳</p>
            <Chips<BondRegion>
              label="집이 있는 곳"
              value={input.bondRegion}
              onChange={(v) => set({ bondRegion: v })}
              options={[
                ['metro', '서울·광역시'],
                ['other', '그 밖의 지역'],
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] text-sub">조정대상지역인가요?</p>
            <Chips<'y' | 'n'>
              label="조정대상지역"
              value={input.adjusted ? 'y' : 'n'}
              onChange={(v) => set({ adjusted: v === 'y' })}
              options={[
                ['y', '네'],
                ['n', '아니요'],
              ]}
            />
            <p className="mt-1 px-0.5 text-[11.5px] text-cap">
              2주택부터 세율이 달라져요. 모르면 국토교통부 조정대상지역 현황에서 확인하세요
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] text-sub">전용면적</p>
            <Chips<'n' | 'y'>
              label="전용면적"
              value={input.over85 ? 'y' : 'n'}
              onChange={(v) => set({ over85: v === 'y' })}
              options={[
                ['n', '85㎡ 이하 (34평형까지)'],
                ['y', '85㎡ 초과'],
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] text-sub">이 집을 사고 나면 우리집은</p>
            <Chips<number>
              label="이 집을 사고 나면"
              value={input.homesAfter}
              onChange={(v) => set({ homesAfter: v })}
              options={[
                [1, '1주택'],
                [2, '2주택'],
                [3, '3주택'],
                [4, '4주택 이상'],
              ]}
            />
            <div className="mt-2 space-y-1.5">
              {input.homesAfter === 1 && (
                <label className="flex items-center gap-2 text-[13px] text-sub">
                  <input
                    type="checkbox"
                    checked={input.firstHome}
                    onChange={(e) => set({ firstHome: e.target.checked })}
                    className="h-4 w-4 accent-[#3182F6]"
                  />
                  생애 처음 사는 집이에요 (부부 모두 집을 가져본 적 없음)
                </label>
              )}
              {input.homesAfter === 2 && (
                <label className="flex items-center gap-2 text-[13px] text-sub">
                  <input
                    type="checkbox"
                    checked={input.temporaryTwo}
                    onChange={(e) => set({ temporaryTwo: e.target.checked })}
                    className="h-4 w-4 accent-[#3182F6]"
                  />
                  잠깐 2주택이에요 (살던 집을 기한 안에 팔 거예요)
                </label>
              )}
            </div>
          </div>
        </div>
        <CalcRow label="주택담보대출" auto={house?.loan ? '로드맵' : undefined}>
          <AmountInput value={input.loan} onChange={(n) => set({ loan: n })} />
        </CalcRow>
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className="mt-2 flex w-full items-center justify-between rounded-btn bg-bg px-3 py-2.5 text-[12.5px] font-bold text-sub"
        >
          자세히 · 공시가격, 채권 할인율, 복비·법무사 견적
          {more ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        {more && (
          <div className="mt-1">
            <CalcRow label="공시가격 (모르면 비워 두기)">
              <AmountInput value={input.publicPrice} onChange={(n) => set({ publicPrice: n })} />
            </CalcRow>
            <CalcRow label="채권 할인율">
              <NumField
                label="채권 할인율"
                value={input.bondDiscount}
                onChange={(n) => set({ bondDiscount: n })}
                unit="%"
                decimal
              />
            </CalcRow>
            <CalcRow label="복비 협의 요율 (비우면 상한)">
              <NumField
                label="복비 협의 요율"
                value={input.brokerRate}
                onChange={(n) => set({ brokerRate: n })}
                unit="%"
                decimal
              />
            </CalcRow>
            <CalcRow label="법무사 견적 (비우면 기준표)">
              <AmountInput value={input.lawyerFee} onChange={(n) => set({ lawyerFee: n })} />
            </CalcRow>
          </div>
        )}
      </Card>

      <Card>
        <p className="text-[12.5px] text-cap">잔금날 집값 말고 더 나가는 돈</p>
        <p className="tnum text-[26px] font-extrabold text-ink">약 {short(r.total)}원</p>
        <p className="tnum text-[12.5px] text-sub">
          {formatComma(r.total)}원 · 집값의{' '}
          {((r.total / Math.max(1, input.price)) * 100).toFixed(2)}%
        </p>
        <div className="mt-3 space-y-3">
          {r.groups.map((g) => (
            <div key={g.title}>
              <p className="flex justify-between text-[13.5px] font-bold text-ink">
                <span>{g.title}</span>
                <span className="tnum">{short(g.total)}원</span>
              </p>
              <div className="mt-1 space-y-1">
                {g.items.map((it) => (
                  <div key={it.label} className="flex justify-between gap-3 text-[12.5px]">
                    <span className="text-sub">
                      {it.label}
                      {it.note && <span className="ml-1 text-cap">· {it.note}</span>}
                    </span>
                    <span className="tnum shrink-0 text-ink">{formatComma(it.amount)}원</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {r.bankPays.length > 0 && (
          <p className="mt-3 rounded-btn bg-bg px-3 py-2 text-[12px] leading-relaxed text-sub">
            은행이 내는 돈(합계에 안 넣음): {r.bankPays.join(' · ')}
          </p>
        )}
      </Card>

      <div className="rounded-card bg-[#FFF8E6] px-4 py-3.5">
        <p className="text-[15px] font-bold text-ink">필요한 우리 돈 {short(need)}원</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#854F0B]">
          집값 − 대출 + 드는 돈
          {netWorth > 0 &&
            (netWorth >= need
              ? ` · 지금 우리집 순자산 ${short(netWorth)}원으로 가능해요`
              : ` · 지금 우리집 순자산 ${short(netWorth)}원보다 ${short(need - netWorth)}원 모자라요`)}
        </p>
        <p className="mt-1 text-[11.5px] text-[#854F0B]/80">
          순자산에는 전세보증금처럼 바로 못 쓰는 돈도 들어 있어요
        </p>
      </div>

      <p className="px-1 text-[12px] leading-relaxed text-cap">
        {HOME_COST_BASE_DATE} 기준 세율·요율로 계산한 어림값이에요. 복비·법무사비는 협의 금액이라
        보통 이보다 적게 나오고, 채권 할인율은 매일 바뀌어요. 계약 전 구청 세무과와 법무사에게 꼭
        확인하세요.
      </p>
    </CalcShell>
  )
}
