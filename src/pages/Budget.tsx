import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Copy, X } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import PcShell from '../components/PcShell'
import { LOAN_CATEGORY, addLoanItems, loanLedgerAmounts } from '../lib/loan'
import { useLedgerStore } from '../lib/store'
import * as db from '../lib/db'
import { activeYm, emptyItem, resolveLedger, resolveSnapshot } from '../lib/carryover'
import {
  abbreviateKRW,
  currentYm,
  formatComma,
  formatMonthKorean,
  periodLabel,
  shiftYm,
} from '../lib/format'
import { memberStyle } from '../lib/memberColors'
import {
  COLS,
  NO_CONTRIBUTIONS,
  ROWS,
  cellItems,
  cellSum,
  colOf,
  leftOf,
  mergeBudget,
  rowOf,
  sharedNeed,
  splitContributions,
  totalIncome,
  totalLeft,
  type Col,
  type RowKey,
} from '../lib/budgetPlan'
import type { BudgetItem, CategoryGroup, Contributions } from '../types'

const short = (n: number) => (n === 0 ? '0' : abbreviateKRW(n).replace(/원$/, ''))
const JOINT_DOT = 'bg-violet-500'

type Sel = { row: RowKey | 'con'; col: Col }

/**
 * 예산 세우기 (2026-10-07) — 남편 · 공동 · 아내 세 칸 표.
 * 월급 → 공동통장으로 → 저축·투자 → 고정비 → 생활비를 빼 나가 '남는 돈'을 0으로 맞춘다.
 * 지난달 예산을 미리 채워 두고, 칸을 누르면 아래(PC는 오른쪽)에서 항목을 고친다.
 * 예전 단계별 화면(/checkup 예산 모드)은 맨 아래 링크로 남겨 둔다.
 */
export default function Budget() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    ledgers,
    snapshots,
    categories,
    profile,
    memberNo,
    saveLedger,
    addCategory,
    refreshCategories,
  } = useLedgerStore()
  useEffect(() => {
    void refreshCategories()
  }, [refreshCategories])

  const navYm = (location.state as { ym?: string } | null)?.ym
  const [ym, setYm] = useState(() => navYm ?? activeYm(ledgers))
  const latestYm = ledgers.length ? ledgers[ledgers.length - 1].ym : ym
  const maxYm = [shiftYm(latestYm, 1), shiftYm(currentYm(), 1)].sort().at(-1)!

  // '가계부에도 넣기'를 켠 대출은 '대출 상환' 고정비로 미리 채운다 (정산 화면과 같은 규칙)
  const load = (ofYm: string) => {
    const ledger = resolveLedger(ledgers, ofYm)
    const items = addLoanItems(
      ledger.items.map((it) => ({ ...it })),
      loanLedgerAmounts(resolveSnapshot(snapshots, ofYm).items, profile.member2Name),
      (m, amount) => ({ ...emptyItem('fixed', LOAN_CATEGORY, m), planned: amount, actual: amount }),
    )
    return { items, con: ledger.contributions ?? NO_CONTRIBUTIONS }
  }
  const [baseline, setBaseline] = useState(() => load(ym))
  const [items, setItems] = useState<BudgetItem[]>(baseline.items)
  const [con, setCon] = useState<Contributions>(baseline.con)
  const [sel, setSel] = useState<Sel | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const needsLoanCategory = items.some(
    (it) => it.category === LOAN_CATEGORY && it.group === 'fixed',
  )
  useEffect(() => {
    if (needsLoanCategory && !categories.fixed.includes(LOAN_CATEGORY))
      addCategory('fixed', LOAN_CATEGORY)
  }, [needsLoanCategory, categories.fixed, addCategory])

  const filledFromLast = !ledgers.some((l) => l.ym === ym) && ledgers.some((l) => l.ym < ym)
  const dirty =
    JSON.stringify(items) !== JSON.stringify(baseline.items) ||
    con[1] !== baseline.con[1] ||
    con[2] !== baseline.con[2]

  const changeYm = (delta: number) => {
    const ny = shiftYm(ym, delta)
    if (ny > maxYm) return
    if (dirty && !window.confirm('고친 내용을 저장하지 않고 다른 달로 갈까요?')) return
    const next = load(ny)
    setYm(ny)
    setBaseline(next)
    setItems(next.items)
    setCon(next.con)
    setSel(null)
    setSavedAt(null)
  }

  const name = (c: Col) =>
    c === 'j' ? '공동' : c === 1 ? profile.member1Name : profile.member2Name
  const dot = (c: Col) => (c === 'j' ? JOINT_DOT : memberStyle(c, profile).dot)

  const left = totalLeft(items, con)
  const income = totalIncome(items)
  const decided = income - left

  // ── 고치기 ──
  const touch = () => setSavedAt(null)
  const setPlanned = (id: string, v: number) => {
    touch()
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, planned: v } : it)))
  }
  const removeItem = (id: string) => {
    touch()
    setItems((prev) => prev.filter((it) => it.id !== id))
  }
  /** 누구 돈인지 바꾸기 — 남편 → 공동 → 아내 (월급은 공동이 없다) */
  const moveItem = (id: string) => {
    touch()
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const order: Col[] = it.group === 'income' ? [1, 2] : [1, 'j', 2]
        const next = order[(order.indexOf(colOf(it)) + 1) % order.length]
        return next === 'j' ? { ...it, shared: true } : { ...it, shared: undefined, member: next }
      }),
    )
  }
  const ownerOf = (c: Col): 1 | 2 => (c === 'j' ? (memberNo ?? 1) : c)
  const addItem = (group: CategoryGroup, category: string, col: Col) => {
    touch()
    const exists = items.find(
      (it) => it.group === group && it.category === category && colOf(it) === col,
    )
    if (exists) return
    const base = emptyItem(group, category, ownerOf(col))
    setItems((prev) => [...prev, col === 'j' ? { ...base, shared: true } : base])
  }
  /** 남는 돈을 그 칸 저축으로 — 저축 항목이 있으면 첫 번째에 더하고, 없으면 만든다 */
  const sweep = (col: Col) => {
    const amount = leftOf(items, con, col)
    if (amount <= 0) return
    touch()
    const target = cellItems(items, 'save', col).find((it) => it.group === 'saving')
    if (target) {
      setItems((prev) =>
        prev.map((it) => (it.id === target.id ? { ...it, planned: it.planned + amount } : it)),
      )
    } else {
      const cat = categories.saving.includes('적금') ? '적금' : (categories.saving[0] ?? '적금')
      const base = { ...emptyItem('saving', cat, ownerOf(col)), planned: amount }
      setItems((prev) => [...prev, col === 'j' ? { ...base, shared: true } : base])
    }
    setSel({ row: 'save', col })
  }
  const setConOf = (m: 1 | 2, v: number) => {
    touch()
    setCon((c) => ({ ...c, [m]: v }))
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    const local = resolveLedger(ledgers, ym)
    const hid = useLedgerStore.getState().householdId
    let server = local
    if (hid) {
      try {
        server = (await db.fetchLedger(hid, ym)) ?? local
      } catch {
        server = local
      }
    }
    const merged = mergeBudget(server.items, baseline.items, items)
    const useCon = con[1] > 0 || con[2] > 0 || server.contributions !== undefined
    saveLedger({
      ym,
      items: merged,
      closed: server.closed,
      settledMembers: server.settledMembers ?? [],
      ...(useCon ? { contributions: con } : {}),
    })
    setBaseline({ items: merged, con })
    setItems(merged)
    setSaving(false)
    setSavedAt(new Date().toISOString())
  }

  const period = periodLabel(ym)

  return (
    <PcShell active="/monthly">
      <div className="flex min-h-screen justify-center bg-[#e6e9ed] lg:bg-bg">
        <div className="relative flex min-h-screen w-full max-w-app flex-col bg-bg pb-28 lg:max-w-[960px]">
          {/* 머리 */}
          <div className="flex items-center gap-1 px-3 pt-4">
            <button
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink active:bg-line"
              aria-label="뒤로"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex-1">
              <h1 className="text-[19px] font-extrabold text-ink">{formatMonthKorean(ym)} 예산</h1>
              {period && <p className="text-[12px] text-cap">{period}</p>}
            </div>
            <div className="flex items-center">
              <button
                onClick={() => changeYm(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line"
                aria-label="이전 달"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => changeYm(1)}
                disabled={ym >= maxYm}
                className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line disabled:opacity-25"
                aria-label="다음 달"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-2.5 px-4 pt-2">
            {filledFromLast && (
              <p className="flex items-center gap-1.5 rounded-btn bg-brand/10 px-3 py-2 text-[12.5px] font-medium text-brand">
                <Copy size={14} className="shrink-0" />
                지난달 예산을 채워 뒀어요. 바뀐 칸만 고치세요.
              </p>
            )}

            {/* 아직 정하지 않은 돈 */}
            <div className="rounded-card bg-card p-4 shadow-card lg:flex lg:items-center lg:gap-6">
              <div className="flex-1">
                <p className="text-[13px] text-sub">아직 정하지 않은 돈</p>
                <p
                  className={`tnum text-[28px] font-extrabold tracking-tight ${
                    left < 0 ? 'text-danger' : left === 0 ? 'text-emerald-600' : 'text-brand'
                  }`}
                >
                  {left === 0 && income > 0
                    ? '0원 · 다 정했어요'
                    : left < 0
                      ? `${short(-left)}원 넘쳐요`
                      : `${short(left)}원`}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{
                      width: `${income > 0 ? Math.max(0, Math.min(100, (decided / income) * 100)) : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[12px] text-cap">
                  {income > 0
                    ? `우리집 월급 ${short(income)} 중 ${short(Math.max(0, decided))} 정했어요 · 0원이 되면 계획 끝`
                    : '월급 칸부터 눌러서 채워 주세요'}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-3 lg:space-y-0">
              {/* 표 */}
              <div className="rounded-card bg-card px-2 py-3 shadow-card">
                <p className="mb-2 flex items-center gap-1 px-1 text-[12px] font-medium text-brand">
                  칸 안의 숫자를 누르면 고칠 수 있어요
                </p>
                <table className="w-full table-fixed border-collapse text-[13.5px]">
                  <colgroup>
                    <col className="w-[29%]" />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th />
                      {COLS.map((c) => (
                        <th
                          key={String(c)}
                          className="px-1.5 pb-2 text-right text-[12px] font-medium text-cap"
                        >
                          <span className={`mr-1 inline-block h-2 w-2 rounded-full ${dot(c)}`} />
                          {name(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <Row label="월급">
                      {COLS.map((c) =>
                        c === 'j' ? (
                          <Dash key="j" />
                        ) : (
                          <Cell
                            key={c}
                            value={cellSum(items, 'income', c)}
                            selected={sel?.row === 'income' && sel.col === c}
                            onClick={() => setSel({ row: 'income', col: c })}
                            label={`${name(c)} 월급`}
                          />
                        ),
                      )}
                    </Row>
                    <Row label="↳ 공동통장으로" muted>
                      {COLS.map((c) => (
                        <Cell
                          key={String(c)}
                          value={c === 'j' ? con[1] + con[2] : con[c]}
                          sign={c === 'j' ? '+' : '−'}
                          tone={c === 'j' ? 'joint' : 'muted'}
                          selected={sel?.row === 'con'}
                          onClick={() => setSel({ row: 'con', col: c })}
                          label={`${name(c)} 공동통장`}
                        />
                      ))}
                    </Row>
                    {ROWS.filter((r) => r.key !== 'income').map((r) => (
                      <Row key={r.key} label={`− ${r.label}`}>
                        {COLS.map((c) => (
                          <Cell
                            key={String(c)}
                            value={cellSum(items, r.key, c)}
                            selected={sel?.row === r.key && sel.col === c}
                            onClick={() => setSel({ row: r.key, col: c })}
                            label={`${name(c)} ${r.label}`}
                          />
                        ))}
                      </Row>
                    ))}
                    <tr>
                      <td className="border-t-[1.5px] border-ink py-2 pl-1 text-[13.5px] font-bold text-ink">
                        = 남는 돈
                      </td>
                      {COLS.map((c) => {
                        const v = leftOf(items, con, c)
                        return (
                          <td
                            key={String(c)}
                            className={`tnum border-t-[1.5px] border-ink px-1.5 py-2 text-right font-bold ${
                              v < 0 ? 'text-danger' : v === 0 ? 'text-emerald-600' : 'text-brand'
                            }`}
                          >
                            {v === 0 ? (
                              <span className="inline-flex items-center gap-0.5">
                                <Check size={13} />0
                              </span>
                            ) : (
                              short(v)
                            )}
                            {v > 0 && (
                              <button
                                onClick={() => sweep(c)}
                                className="mt-0.5 block w-full rounded-md bg-brand/10 px-1 py-0.5 text-[10.5px] font-bold text-brand"
                              >
                                저축으로
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
                <p className="mt-1 px-1 text-[11.5px] text-cap">
                  누른 칸의 항목은 <span className="lg:hidden">아래</span>
                  <span className="hidden lg:inline">오른쪽</span>에 나와요 · 남는 돈은 자동 계산
                </p>
              </div>

              {/* 고른 칸 */}
              <div className="rounded-card border-[1.5px] border-brand/30 bg-card p-4 shadow-card">
                {!sel ? (
                  <div className="text-[13px] leading-relaxed text-sub">
                    <p className="text-[14.5px] font-bold text-ink">칸을 눌러 보세요</p>
                    <p className="mt-1">숫자 칸을 누르면 그 칸에 든 항목이 여기에 나와요.</p>
                    <p className="mt-1">
                      관리비·식비처럼 같이 쓰는 돈은 항목 옆 이름표를 눌러 &lsquo;공동&rsquo;으로
                      옮기면 공동통장에서 나가요.
                    </p>
                  </div>
                ) : sel.row === 'con' ? (
                  <ConPanel
                    con={con}
                    need={sharedNeed(items)}
                    names={[profile.member1Name, profile.member2Name]}
                    dots={[dot(1), dot(2)]}
                    onChange={setConOf}
                    onSplit={(mode) => {
                      touch()
                      setCon(splitContributions(items, mode))
                    }}
                  />
                ) : (
                  <CellPanel
                    key={`${sel.row}-${sel.col}`}
                    row={sel.row}
                    col={sel.col}
                    title={`${name(sel.col)} · ${rowOf(sel.row).label}`}
                    items={cellItems(items, sel.row, sel.col)}
                    categories={categories}
                    ownerName={(it) => name(colOf(it))}
                    ownerDot={(it) => dot(colOf(it))}
                    onAmount={setPlanned}
                    onMove={moveItem}
                    onRemove={removeItem}
                    onAdd={(g, cat) => addItem(g, cat, sel.col)}
                  />
                )}
              </div>
            </div>

            <button
              onClick={() => navigate('/checkup', { state: { ym, mode: 'budget' } })}
              className="block w-full py-2 text-center text-[12.5px] text-cap underline-offset-2 active:underline"
            >
              예전처럼 단계별로 입력하기
            </button>
          </div>

          <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-app -translate-x-1/2 border-t border-line/60 bg-bg/95 px-5 pb-4 pt-3 backdrop-blur lg:left-[calc(50%+110px)] lg:max-w-[960px]">
            <button
              onClick={save}
              disabled={saving || (!dirty && !filledFromLast)}
              className={`h-[52px] w-full rounded-btn text-[16px] font-bold transition-colors disabled:opacity-50 ${
                left === 0 && income > 0 ? 'bg-brand text-white' : 'bg-brand/10 text-brand'
              }`}
            >
              {savedAt && !dirty ? '저장했어요' : saving ? '저장 중…' : '예산으로 저장'}
            </button>
          </div>
        </div>
      </div>
    </PcShell>
  )
}

function Row({
  label,
  muted,
  children,
}: {
  label: string
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <tr>
      <td
        className={`border-t border-bg py-1 pl-1 text-[13px] ${muted ? 'text-sub' : 'font-medium text-ink'}`}
      >
        {label}
      </td>
      {children}
    </tr>
  )
}

function Dash() {
  return <td className="border-t border-bg px-1.5 py-1 text-right text-cap/60">–</td>
}

function Cell({
  value,
  selected,
  onClick,
  label,
  sign,
  tone,
}: {
  value: number
  selected: boolean
  onClick: () => void
  label: string
  sign?: '+' | '−'
  tone?: 'muted' | 'joint'
}) {
  const color =
    value === 0
      ? 'text-cap/60'
      : tone === 'joint'
        ? 'text-violet-600 font-bold'
        : tone === 'muted'
          ? 'text-sub'
          : 'text-ink font-semibold'
  return (
    <td className="border-t border-bg px-0.5 py-1">
      <button
        onClick={onClick}
        aria-label={`${label} ${formatComma(value)}원`}
        className={`tnum flex w-full items-center justify-end gap-1 rounded-lg border px-1.5 py-2 text-right ${color} ${
          selected
            ? 'border-brand bg-brand/10 ring-2 ring-brand/15'
            : 'border-line bg-white hover:border-brand/50 active:bg-bg'
        }`}
      >
        <span className="truncate">
          {value > 0 && sign ? sign : ''}
          {short(value)}
        </span>
      </button>
    </td>
  )
}

function ConPanel({
  con,
  need,
  names,
  dots,
  onChange,
  onSplit,
}: {
  con: Contributions
  need: number
  names: [string, string]
  dots: [string, string]
  onChange: (m: 1 | 2, v: number) => void
  onSplit: (mode: 'half' | 'income') => void
}) {
  return (
    <div>
      <p className="text-[15px] font-bold text-ink">공동통장으로 보내는 돈</p>
      <p className="mt-0.5 text-[12.5px] text-sub">
        공동통장에서 나갈 돈 {short(need)}원 · 지금 {short(con[1] + con[2])}원 모여요
      </p>
      <div className="mt-3 space-y-2">
        {([1, 2] as const).map((m) => (
          <label key={m} className="flex items-center gap-2 text-[13.5px] text-sub">
            <span className="w-16 shrink-0">
              <span className={`mr-1 inline-block h-2 w-2 rounded-full ${dots[m - 1]}`} />
              {names[m - 1]}
            </span>
            <AmountInput value={con[m]} onChange={(v) => onChange(m, v)} className="flex-1" />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => onSplit('half')}
          className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-sub active:bg-bg"
        >
          나갈 돈 반반
        </button>
        <button
          onClick={() => onSplit('income')}
          className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-sub active:bg-bg"
        >
          월급 비율로
        </button>
      </div>
      {need === 0 && (
        <p className="mt-3 text-[12px] leading-relaxed text-cap">
          아직 공동 칸에 항목이 없어요. 고정비·생활비 칸에서 항목 옆 이름표를 눌러
          &lsquo;공동&rsquo;으로 옮기면 공동통장에서 나가요.
        </p>
      )}
    </div>
  )
}

function CellPanel({
  row,
  col,
  title,
  items,
  categories,
  ownerName,
  ownerDot,
  onAmount,
  onMove,
  onRemove,
  onAdd,
}: {
  row: RowKey
  col: Col
  title: string
  items: BudgetItem[]
  categories: Record<CategoryGroup, string[]>
  ownerName: (it: BudgetItem) => string
  ownerDot: (it: BudgetItem) => string
  onAmount: (id: string, v: number) => void
  onMove: (id: string) => void
  onRemove: (id: string) => void
  onAdd: (group: CategoryGroup, category: string) => void
}) {
  const sum = items.reduce((a, it) => a + it.planned, 0)
  const groups = rowOf(row).groups
  const [adding, setAdding] = useState(items.length === 0)
  const used = useMemo(() => new Set(items.map((it) => `${it.group}:${it.category}`)), [items])
  const GROUP_NAME: Partial<Record<CategoryGroup, string>> = { saving: '저축', investment: '투자' }
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-bold text-ink">{title}</p>
        <p className="tnum text-[15px] font-bold text-ink">{formatComma(sum)}원</p>
      </div>
      {items.length > 0 && (
        <div className="mt-2 divide-y divide-bg">
          {items.map((it, i) => (
            <div key={it.id} className="py-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="flex-1 truncate text-[13.5px] font-medium text-ink">
                  {it.category}
                </span>
                <button
                  onClick={() => onMove(it.id)}
                  className="flex items-center gap-1 rounded-full bg-bg px-2 py-0.5 text-[11.5px] font-bold text-sub active:bg-line"
                  aria-label={`${it.category} 누구 돈인지 바꾸기`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${ownerDot(it)}`} />
                  {ownerName(it)} ⇄
                </button>
                <button
                  onClick={() => onRemove(it.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-cap active:bg-bg"
                  aria-label={`${it.category} 지우기`}
                >
                  <X size={14} />
                </button>
              </div>
              <AmountInput
                value={it.planned}
                onChange={(v) => onAmount(it.id, v)}
                autoFocus={items.length === 1 && i === 0}
              />
            </div>
          ))}
        </div>
      )}
      {items.length === 0 && (
        <p className="mt-1 text-[12.5px] text-cap">
          {col === 'j' ? '공동통장에서 나갈 항목을 골라 주세요' : '항목을 골라 금액을 넣어 주세요'}
        </p>
      )}
      {adding ? (
        <div className="mt-2 space-y-2">
          {groups.map((g) => (
            <div key={g}>
              {groups.length > 1 && (
                <p className="mb-1 text-[11.5px] font-bold text-cap">{GROUP_NAME[g]}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {categories[g]
                  .filter((cat) => !used.has(`${g}:${cat}`))
                  .map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        onAdd(g, cat)
                        setAdding(false)
                      }}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-sub active:bg-bg"
                    >
                      + {cat}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 text-[13px] font-bold text-brand">
          + 항목 추가
        </button>
      )}
    </div>
  )
}
