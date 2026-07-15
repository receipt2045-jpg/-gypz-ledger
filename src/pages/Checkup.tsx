import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, X, Plus, PartyPopper } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import StepProgress from '../components/StepProgress'
import { useLedgerStore } from '../lib/store'
import {
  activeYm,
  emptyItem,
  genId,
  netWorthOf,
  resolveLedger,
  resolveSnapshot,
  summarize,
} from '../lib/carryover'
import {
  abbreviateKRW,
  formatMonthKorean,
  formatPercent,
  formatWon,
  shiftYm,
} from '../lib/format'
import { ASSET_GROUP_LABEL, ASSET_GROUP_ORDER, GROUP_LABEL } from '../lib/constants'
import type { AssetGroup, AssetItem, BudgetItem, CategoryGroup } from '../types'

interface StepDef {
  title: string
  subtitle: string
  groups: CategoryGroup[]
  sameAsLast: boolean // "지난달과 같아요" 노출 여부
}

const STEPS: StepDef[] = [
  { title: '수입', subtitle: '이번 달 벌어들인 돈이에요', groups: ['income'], sameAsLast: true },
  {
    title: '저축·투자',
    subtitle: '모으고 불린 돈을 확인해요',
    groups: ['saving', 'investment'],
    sameAsLast: true,
  },
  { title: '고정지출', subtitle: '매달 비슷하게 나가는 돈이에요', groups: ['fixed'], sameAsLast: true },
  { title: '변동지출', subtitle: '이번 달 실제 쓴 금액을 입력해요', groups: ['variable'], sameAsLast: false },
]
const TOTAL_STEPS = STEPS.length + 1 // + 자산 업데이트
const ASSET_STEP = STEPS.length // index 4
const DONE_STEP = TOTAL_STEPS // index 5

export default function Checkup() {
  const navigate = useNavigate()
  const { ledgers, snapshots, categories, profile, saveLedger, saveSnapshot } = useLedgerStore()

  const ym = useMemo(() => activeYm(ledgers), [ledgers])

  // 드래프트 초기화 (변동지출은 계획값을 시작점으로)
  const [items, setItems] = useState<BudgetItem[]>(() =>
    resolveLedger(ledgers, ym).items.map((it) => ({
      ...it,
      actual: it.actual || it.planned,
    })),
  )
  const [assets, setAssets] = useState<AssetItem[]>(
    () => resolveSnapshot(snapshots, ym).items.map((it) => ({ ...it })),
  )

  const prevNetWorth = useMemo(
    () => netWorthOf(resolveSnapshot(snapshots, shiftYm(ym, -1))),
    [snapshots, ym],
  )

  const [step, setStep] = useState(0)

  const setActual = (id: string, actual: number) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, actual } : it)))
  const addItem = (group: CategoryGroup, category: string, member: 1 | 2) =>
    setItems((prev) => [...prev, { ...emptyItem(group, category, member), actual: 0 }])
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id))

  const setAssetAmount = (id: string, amount: number) =>
    setAssets((prev) => prev.map((it) => (it.id === id ? { ...it, amount } : it)))
  const addAsset = (asset: Omit<AssetItem, 'id'>) =>
    setAssets((prev) => [...prev, { ...asset, id: genId() }])
  const removeAsset = (id: string) => setAssets((prev) => prev.filter((it) => it.id !== id))

  const commit = () => {
    saveLedger({ ym, items, closed: true })
    saveSnapshot({ ym, items: assets })
    setStep(DONE_STEP)
  }

  const goBack = () => {
    if (step === 0) navigate('/')
    else if (step < DONE_STEP) setStep((s) => s - 1)
  }
  const next = () => setStep((s) => s + 1)

  // ── 완료 화면 ─────────────────────────────
  if (step === DONE_STEP) {
    const s = summarize({ ym, items, closed: true })
    const newNetWorth = netWorthOf({ ym, items: assets })
    const nwDelta = newNetWorth - prevNetWorth
    return (
      <Frame>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center animate-fade-up">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-brand/10">
            <PartyPopper size={40} className="text-brand" />
          </div>
          <h1 className="text-[24px] font-extrabold text-ink">
            {formatMonthKorean(ym)} 정산 완료 🎉
          </h1>
          <p className="mt-2 text-[14px] text-sub">한 달 수고했어요. 이번 달 성적표예요.</p>

          <div className="mt-7 w-full space-y-2.5 rounded-card bg-card p-5 text-left shadow-card">
            <ResultRow label="저축·투자율" value={formatPercent(s.savingInvestRate)} accent />
            <ResultRow
              label="잉여현금"
              value={formatWon(s.surplus)}
              danger={s.surplus < 0}
            />
            <ResultRow
              label="순자산 증감"
              value={`${nwDelta >= 0 ? '+' : '−'}${abbreviateKRW(Math.abs(nwDelta))}`}
              accent={nwDelta >= 0}
              danger={nwDelta < 0}
            />
          </div>
        </div>
        <BottomBar>
          <button
            onClick={() => navigate('/')}
            className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark"
          >
            홈으로
          </button>
        </BottomBar>
      </Frame>
    )
  }

  // ── 자산 업데이트 스텝 ────────────────────
  if (step === ASSET_STEP) {
    return (
      <Frame>
        <Header step={step} onBack={goBack} title="자산 업데이트" subtitle="계좌별 현재 잔액을 갱신해요" />
        <div className="flex-1 px-5 pb-32">
          <AssetStep
            assets={assets}
            onChange={setAssetAmount}
            onAdd={addAsset}
            onRemove={removeAsset}
          />
        </div>
        <BottomBar>
          <button
            onClick={commit}
            className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark"
          >
            정산 완료하기
          </button>
        </BottomBar>
      </Frame>
    )
  }

  // ── 금액 입력 스텝 (수입/저축·투자/고정/변동) ──
  const def = STEPS[step]
  const stepItems = items.filter((it) => def.groups.includes(it.group))

  return (
    <Frame>
      <Header step={step} onBack={goBack} title={def.title} subtitle={def.subtitle} />
      <div className="flex-1 px-5 pb-32">
        <MoneyStep
          groups={def.groups}
          items={stepItems}
          categories={categories}
          memberNames={[profile.member1Name, profile.member2Name]}
          onChange={setActual}
          onAdd={addItem}
          onRemove={removeItem}
        />
      </div>
      <BottomBar>
        <div className="space-y-2">
          <button
            onClick={next}
            className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark"
          >
            다음
          </button>
          {def.sameAsLast && (
            <button
              onClick={next}
              className="h-11 w-full rounded-btn bg-white text-[14px] font-semibold text-sub active:bg-line"
            >
              지난달과 같아요
            </button>
          )}
        </div>
      </BottomBar>
    </Frame>
  )
}

// ── 레이아웃 헬퍼 ─────────────────────────────
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="relative flex min-h-screen w-full max-w-app flex-col bg-bg shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        {children}
      </div>
    </div>
  )
}

function Header({
  step,
  onBack,
  title,
  subtitle,
}: {
  step: number
  onBack: () => void
  title: string
  subtitle: string
}) {
  return (
    <div className="sticky top-0 z-20 bg-bg px-5 pb-4 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onBack} className="text-ink active:opacity-60" aria-label="뒤로">
          <ChevronLeft size={26} />
        </button>
        <div className="flex-1">
          <StepProgress current={step} total={TOTAL_STEPS} />
        </div>
        <span className="tnum text-[13px] font-semibold text-cap">
          {step + 1}/{TOTAL_STEPS}
        </span>
      </div>
      <h1 className="text-[24px] font-extrabold text-ink">{title}</h1>
      <p className="mt-1 text-[14px] text-sub">{subtitle}</p>
    </div>
  )
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-app -translate-x-1/2 border-t border-line/60 bg-bg/95 px-5 pb-4 pt-3 backdrop-blur">
      {children}
    </div>
  )
}

function ResultRow({
  label,
  value,
  accent,
  danger,
}: {
  label: string
  value: string
  accent?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px] text-sub">{label}</span>
      <span
        className={`tnum text-[17px] font-bold ${danger ? 'text-danger' : accent ? 'text-brand' : 'text-ink'}`}
      >
        {value}
      </span>
    </div>
  )
}

// ── 금액 입력 스텝 ─────────────────────────────
function MoneyStep({
  groups,
  items,
  categories,
  memberNames,
  onChange,
  onAdd,
  onRemove,
}: {
  groups: CategoryGroup[]
  items: BudgetItem[]
  categories: Record<CategoryGroup, string[]>
  memberNames: [string, string]
  onChange: (id: string, v: number) => void
  onAdd: (g: CategoryGroup, c: string, m: 1 | 2) => void
  onRemove: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [g, setG] = useState<CategoryGroup>(groups[0])
  const [cat, setCat] = useState(categories[groups[0]][0])
  const [mem, setMem] = useState<1 | 2>(1)

  const submitAdd = () => {
    if (!cat) return
    onAdd(g, cat, mem)
    setAdding(false)
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="py-6 text-center text-[13px] text-cap">항목을 추가해 주세요</p>
      )}
      {items.map((it) => (
        <div
          key={it.id}
          className="flex items-center gap-2.5 rounded-card bg-card px-4 py-3 shadow-card"
        >
          <div className="w-[76px] shrink-0">
            <p className="truncate text-[15px] font-semibold text-ink">{it.category}</p>
            <p className="mt-0.5 truncate text-[11px] text-cap">
              {memberNames[it.member - 1]}
              {groups.length > 1 ? ` · ${GROUP_LABEL[it.group]}` : ''}
            </p>
          </div>
          <AmountInput className="flex-1" value={it.actual} onChange={(v) => onChange(it.id, v)} />
          <button
            onClick={() => onRemove(it.id)}
            className="shrink-0 text-cap active:text-danger"
            aria-label="삭제"
          >
            <X size={18} />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="space-y-2 rounded-card bg-card p-4 shadow-card">
          {groups.length > 1 && (
            <select
              value={g}
              onChange={(e) => {
                const ng = e.target.value as CategoryGroup
                setG(ng)
                setCat(categories[ng][0])
              }}
              className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
            >
              {groups.map((gr) => (
                <option key={gr} value={gr}>
                  {GROUP_LABEL[gr]}
                </option>
              ))}
            </select>
          )}
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
          >
            {categories[g].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            {([1, 2] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMem(m)}
                className={`flex-1 rounded-btn py-2.5 text-[14px] font-semibold ${
                  mem === m ? 'bg-brand text-white' : 'bg-bg text-sub'
                }`}
              >
                구성원 {m}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAdding(false)}
              className="h-11 flex-1 rounded-btn bg-bg text-[14px] font-semibold text-sub active:bg-line"
            >
              취소
            </button>
            <button
              onClick={submitAdd}
              className="h-11 flex-1 rounded-btn bg-brand text-[14px] font-bold text-white active:bg-brand-dark"
            >
              추가
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setG(groups[0])
            setCat(categories[groups[0]][0])
            setAdding(true)
          }}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-line bg-transparent text-[14px] font-semibold text-sub active:bg-white"
        >
          <Plus size={17} /> 항목 추가
        </button>
      )}
    </div>
  )
}

// ── 자산 업데이트 스텝 ─────────────────────────
function AssetStep({
  assets,
  onChange,
  onAdd,
  onRemove,
}: {
  assets: AssetItem[]
  onChange: (id: string, v: number) => void
  onAdd: (a: Omit<AssetItem, 'id'>) => void
  onRemove: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<'asset' | 'debt'>('asset')
  const [group, setGroup] = useState<AssetGroup>('cash')
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('공동')
  const [amount, setAmount] = useState(0)

  const submit = () => {
    if (!name.trim() || amount <= 0) return
    onAdd({ kind, group, name: name.trim(), owner, amount })
    setName('')
    setAmount(0)
    setAdding(false)
  }

  const assetItems = assets.filter((it) => it.kind === 'asset')
  const debtItems = assets.filter((it) => it.kind === 'debt')

  return (
    <div className="space-y-3">
      {assetItems.map((it) => (
        <AssetRow key={it.id} item={it} onChange={onChange} onRemove={onRemove} />
      ))}
      {debtItems.length > 0 && (
        <p className="px-1 pt-2 text-[13px] font-bold text-danger">부채</p>
      )}
      {debtItems.map((it) => (
        <AssetRow key={it.id} item={it} onChange={onChange} onRemove={onRemove} debt />
      ))}

      {adding ? (
        <div className="space-y-2 rounded-card bg-card p-4 shadow-card">
          <div className="flex gap-2">
            {(['asset', 'debt'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 rounded-btn py-2.5 text-[14px] font-semibold ${
                  kind === k
                    ? k === 'debt'
                      ? 'bg-danger text-white'
                      : 'bg-brand text-white'
                    : 'bg-bg text-sub'
                }`}
              >
                {k === 'asset' ? '자산' : '부채'}
              </button>
            ))}
          </div>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as AssetGroup)}
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
          >
            {ASSET_GROUP_ORDER.map((gr) => (
              <option key={gr} value={gr}>
                {ASSET_GROUP_LABEL[gr]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 (예: 토스 비상금)"
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand placeholder:text-cap"
          />
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
          >
            {['공동', '남편', '아내'].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <AmountInput value={amount} onChange={setAmount} placeholder="현재 잔액" />
          <div className="flex gap-2">
            <button
              onClick={() => setAdding(false)}
              className="h-11 flex-1 rounded-btn bg-bg text-[14px] font-semibold text-sub active:bg-line"
            >
              취소
            </button>
            <button
              onClick={submit}
              className="h-11 flex-1 rounded-btn bg-brand text-[14px] font-bold text-white active:bg-brand-dark"
            >
              추가
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-line bg-transparent text-[14px] font-semibold text-sub active:bg-white"
        >
          <Plus size={17} /> 자산·부채 추가
        </button>
      )}
    </div>
  )
}

function AssetRow({
  item,
  onChange,
  onRemove,
  debt,
}: {
  item: AssetItem
  onChange: (id: string, v: number) => void
  onRemove: (id: string) => void
  debt?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-card bg-card px-4 py-3 shadow-card">
      <div className="w-[88px] shrink-0">
        <p className="truncate text-[14px] font-semibold text-ink">{item.name}</p>
        <p className="mt-0.5 text-[11px] text-cap">
          {debt ? '부채' : ASSET_GROUP_LABEL[item.group]}
          {item.owner ? ` · ${item.owner}` : ''}
        </p>
      </div>
      <AmountInput className="flex-1" value={item.amount} onChange={(v) => onChange(item.id, v)} />
      <button
        onClick={() => onRemove(item.id)}
        className="shrink-0 text-cap active:text-danger"
        aria-label="삭제"
      >
        <X size={18} />
      </button>
    </div>
  )
}
