import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import AmountInput from '../components/AmountInput'
import { useLedgerStore } from '../lib/store'
import { summarize } from '../lib/carryover'
import { formatComma, formatWon } from '../lib/format'
import { GROUP_LABEL, GROUP_ORDER, OCCASION_CATEGORIES } from '../lib/constants'
import type { CategoryGroup } from '../types'

export default function Yearly() {
  const { ledgers, occasions, addOccasion, removeOccasion, profile } = useLedgerStore()
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

      {/* 경조사 / 연간비 */}
      <OccasionSection
        year={year}
        items={yearOccasions}
        total={occasionTotal}
        onAdd={addOccasion}
        onRemove={removeOccasion}
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

function OccasionSection({
  year,
  items,
  total,
  onAdd,
  onRemove,
}: {
  year: number
  items: { id: string; date: string; category: string; title: string; amount: number }[]
  total: number
  onAdd: (e: { date: string; category: string; title: string; amount: number }) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(`${year}-01-01`)
  const [category, setCategory] = useState(OCCASION_CATEGORIES[0])
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState(0)

  const submit = () => {
    if (!title.trim() || amount <= 0) return
    onAdd({ date, category, title: title.trim(), amount })
    setTitle('')
    setAmount(0)
    setOpen(false)
  }

  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-ink">경조사 · 연간비</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-[12px] font-bold text-brand"
        >
          <Plus size={14} /> 추가
        </button>
      </div>
      <p className="mb-2 text-[12px] text-cap">
        올해 합계 <span className="tnum font-semibold text-sub">{formatWon(total)}</span>
      </p>

      {open && (
        <div className="mb-3 space-y-2 rounded-btn bg-bg p-3">
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="tnum flex-1 rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
            >
              {OCCASION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="내용 (예: 친구 결혼식)"
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand placeholder:text-cap"
          />
          <AmountInput value={amount} onChange={setAmount} placeholder="금액" />
          <button
            onClick={submit}
            className="h-11 w-full rounded-btn bg-brand text-[15px] font-bold text-white active:bg-brand-dark"
          >
            추가하기
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-3 text-center text-[13px] text-cap">기록된 경조사가 없어요</p>
      ) : (
        <div className="divide-y divide-line/70">
          {items.map((o) => (
            <div key={o.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-ink">{o.title}</p>
                <p className="mt-0.5 text-[12px] text-cap">
                  {o.date.replace(/-/g, '.')} · {o.category}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="tnum text-[15px] font-semibold text-ink">
                  {formatWon(o.amount)}
                </span>
                <button
                  onClick={() => onRemove(o.id)}
                  className="text-cap active:text-danger"
                  aria-label="삭제"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
