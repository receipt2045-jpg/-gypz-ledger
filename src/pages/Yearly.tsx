import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Card from '../components/Card'
import OccasionSection from '../components/OccasionSection'
import { useLedgerStore } from '../lib/store'
import { summarize } from '../lib/carryover'
import { formatComma } from '../lib/format'
import { GROUP_LABEL, GROUP_ORDER } from '../lib/constants'
import type { CategoryGroup } from '../types'

export default function Yearly() {
  const navigate = useNavigate()
  const { ledgers, occasions, removeOccasion, profile } = useLedgerStore()
  const [year, setYear] = useState(profile.startYear || new Date().getFullYear())

  const yms = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`),
    [year],
  )

  const ledgerByYm = useMemo(() => {
    const m = new Map<string, (typeof ledgers)[number]>()
    ledgers.filter((l) => l.ym.startsWith(String(year))).forEach((l) => m.set(l.ym, l))
    return m
  }, [ledgers, year])

  const actualOf = (ym: string, group: CategoryGroup, category: string) => {
    const l = ledgerByYm.get(ym)
    if (!l) return 0
    return l.items
      .filter((it) => it.group === group && it.category === category)
      .reduce((a, it) => a + it.actual, 0)
  }

  const groupTotalOf = (ym: string, group: CategoryGroup) => {
    const l = ledgerByYm.get(ym)
    if (!l) return 0
    return l.items.filter((it) => it.group === group).reduce((a, it) => a + it.actual, 0)
  }

  const catByGroup = useMemo(() => {
    const map = {} as Record<CategoryGroup, string[]>
    GROUP_ORDER.forEach((g) => {
      const set = new Set<string>()
      ledgerByYm.forEach((l) =>
        l.items.filter((it) => it.group === g).forEach((it) => set.add(it.category)),
      )
      map[g] = [...set]
    })
    return map
  }, [ledgerByYm])

  const rateData = yms.map((ym) => {
    const l = ledgerByYm.get(ym)
    const rate = l ? Math.round(summarize(l).savingInvestRate * 100) : 0
    return { label: `${Number(ym.split('-')[1])}월`, rate, has: !!l }
  })

  const yearOccasions = occasions.filter((o) => o.date.startsWith(String(year)))
  const occasionTotal = yearOccasions.reduce((a, o) => a + o.amount, 0)
  const hasData = ledgerByYm.size > 0

  const toMan = (v: number) => (v === 0 ? '' : formatComma(Math.round(v / 10000)))

  return (
    <div className="animate-fade-up space-y-4">
      {/* 연도 선택 */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line"
          aria-label="이전 해"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="min-w-[96px] text-center text-[18px] font-bold text-ink">{year}년</h1>
        <button
          onClick={() => setYear((y) => y + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line"
          aria-label="다음 해"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* 연말정산 미리보기 — '올해의 돈' 화면이라 여기가 입구 (홈 오늘 카드에서도 진입) */}
      <button
        onClick={() => navigate('/year-end-tax')}
        className="w-full rounded-card bg-card px-5 py-4 text-left shadow-card active:bg-line"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-ink">💳 연말정산 미리보기 — 누구 카드로 쓸까?</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-sub">
              부부 카드값은 합쳐지지 않아요. 연봉만 넣으면 지금 누구 카드가 유리한지 알려드려요.
            </p>
          </div>
          <ChevronRight size={20} className="shrink-0 text-cap" />
        </div>
      </button>

      {/* 결산 매트릭스 */}
      <Card className="!px-3 !py-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <h2 className="text-[15px] font-bold text-ink">연간 결산</h2>
          <span className="text-[12px] text-cap">단위: 만원</span>
        </div>
        {hasData ? (
          <div className="thin-scroll overflow-x-auto">
            <table className="tnum w-full border-collapse text-right text-[12px]">
              <thead>
                <tr className="text-cap">
                  <th className="sticky left-0 z-10 min-w-[72px] whitespace-nowrap bg-card px-2 py-1.5 text-left font-semibold">
                    항목
                  </th>
                  {yms.map((ym) => (
                    <th key={ym} className="min-w-[42px] px-1.5 py-1.5 font-semibold">
                      {Number(ym.split('-')[1])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GROUP_ORDER.map((g) => (
                  <FragmentGroup
                    key={g}
                    group={g}
                    categories={catByGroup[g]}
                    yms={yms}
                    actualOf={actualOf}
                    groupTotalOf={groupTotalOf}
                    toMan={toMan}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-2 py-6 text-center text-[13px] text-cap">
            {year}년 결산 데이터가 없어요
          </p>
        )}
      </Card>

      {/* 월별 저축·투자율 */}
      <Card>
        <h2 className="mb-3 text-[15px] font-bold text-ink">월별 저축·투자율</h2>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rateData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#8B95A1' }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: 'rgba(49,130,246,0.06)' }}
                content={({ active, payload }) =>
                  active && payload && payload.length ? (
                    <div className="rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg">
                      {payload[0].payload.label} {payload[0].value}%
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={18}>
                {rateData.map((d, i) => (
                  <Cell key={i} fill={d.has ? '#3182F6' : '#E5E8EB'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 비정기 지출 — 연간 조회 전용 (기록·추가는 가계부 탭) */}
      <OccasionSection
        items={yearOccasions}
        yearTotal={occasionTotal}
        onRemove={removeOccasion}
        emptyText={`${year}년 기록이 없어요 · 가계부 탭에서 적을 수 있어요`}
      />
    </div>
  )
}

function FragmentGroup({
  group,
  categories,
  yms,
  actualOf,
  groupTotalOf,
  toMan,
}: {
  group: CategoryGroup
  categories: string[]
  yms: string[]
  actualOf: (ym: string, g: CategoryGroup, c: string) => number
  groupTotalOf: (ym: string, g: CategoryGroup) => number
  toMan: (v: number) => string
}) {
  if (categories.length === 0) return null
  return (
    <>
      <tr className="bg-brand/5 font-bold text-ink">
        <td className="sticky left-0 z-10 min-w-[72px] whitespace-nowrap bg-[#EAF1FE] px-2 py-1.5 text-left">
          {GROUP_LABEL[group]}
        </td>
        {yms.map((ym) => (
          <td key={ym} className="px-1.5 py-1.5">
            {toMan(groupTotalOf(ym, group))}
          </td>
        ))}
      </tr>
      {categories.map((cat) => (
        <tr key={cat} className="text-sub">
          <td className="sticky left-0 z-10 min-w-[72px] whitespace-nowrap bg-card px-2 py-1.5 pl-4 text-left">
            {cat}
          </td>
          {yms.map((ym) => (
            <td key={ym} className="px-1.5 py-1.5">
              {toMan(actualOf(ym, group, cat))}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

