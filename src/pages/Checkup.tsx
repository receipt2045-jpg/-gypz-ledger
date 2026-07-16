import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, X, Plus, PartyPopper, UserRound } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import AssetIcon from '../components/AssetIcon'
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
const MEMBER_STEP = 0 // 남편/아내 선택
const TOTAL_STEPS = STEPS.length + 2 // 선택 + 금액 스텝들 + 자산 업데이트
const ASSET_STEP = STEPS.length + 1 // index 5
const DONE_STEP = TOTAL_STEPS // index 6

export default function Checkup() {
  const navigate = useNavigate()
  const { ledgers, snapshots, categories, profile, memberNo, saveLedger, saveSnapshot } =
    useLedgerStore()

  // 정산 대상 월은 진입 시점에 고정 (정산 완료 후 activeYm이 다음 달로 넘어가도 유지)
  const [ym] = useState(() => activeYm(ledgers))

  const [items, setItems] = useState<BudgetItem[]>(() =>
    resolveLedger(ledgers, ym).items.map((it) => ({ ...it })),
  )
  const [assets, setAssets] = useState<AssetItem[]>(
    () => resolveSnapshot(snapshots, ym).items.map((it) => ({ ...it })),
  )

  const prevNetWorth = useMemo(
    () => netWorthOf(resolveSnapshot(snapshots, shiftYm(ym, -1))),
    [snapshots, ym],
  )

  const [step, setStep] = useState(MEMBER_STEP)
  const [member, setMember] = useState<1 | 2 | null>(null)

  const memberNames: [string, string] = [profile.member1Name, profile.member2Name]
  const memberName = member ? memberNames[member - 1] : ''
  const partnerName = member ? memberNames[member === 1 ? 1 : 0] : ''
  const settledMembers = resolveLedger(ledgers, ym).settledMembers ?? []

  const selectMember = (m: 1 | 2) => {
    setMember(m)
    // 선택한 사람의 항목만 결산 시작값(actual = planned)으로 채움
    setItems((prev) =>
      prev.map((it) => (it.member === m ? { ...it, actual: it.actual || it.planned } : it)),
    )
    setStep(1)
  }

  const setActual = (id: string, actual: number) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, actual } : it)))
  const addItem = (group: CategoryGroup, category: string) => {
    if (!member) return
    setItems((prev) => [...prev, { ...emptyItem(group, category, member), actual: 0 }])
  }
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id))

  const setAssetAmount = (id: string, amount: number) =>
    setAssets((prev) => prev.map((it) => (it.id === id ? { ...it, amount } : it)))
  const addAsset = (asset: Omit<AssetItem, 'id'>) =>
    setAssets((prev) => [...prev, { ...asset, id: genId() }])
  const removeAsset = (id: string) => setAssets((prev) => prev.filter((it) => it.id !== id))

  const commit = () => {
    if (!member) return
    const merged = Array.from(new Set([...settledMembers, member])) as (1 | 2)[]
    const closed = merged.includes(1) && merged.includes(2)
    saveLedger({ ym, items, closed, settledMembers: merged })
    saveSnapshot({ ym, items: assets })
    setStep(DONE_STEP)
  }

  const goBack = () => {
    if (step === MEMBER_STEP) navigate('/')
    else if (step === 1) setStep(MEMBER_STEP)
    else if (step < DONE_STEP) setStep((s) => s - 1)
  }
  const next = () => setStep((s) => s + 1)

  // ── 구성원 선택 스텝 ──────────────────────
  if (step === MEMBER_STEP) {
    return (
      <Frame>
        <Header
          step={step}
          onBack={goBack}
          title="누가 정산하나요?"
          subtitle="각자 자기 항목만 입력하면 돼요"
        />
        <div className="flex-1 space-y-3 px-5 pt-4">
          {([1, 2] as const).map((m) => {
            const done = settledMembers.includes(m)
            return (
              <button
                key={m}
                onClick={() => selectMember(m)}
                className="flex w-full items-center gap-4 rounded-card bg-card px-5 py-5 text-left shadow-card transition-transform active:scale-[0.98]"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                    m === 1 ? 'bg-brand/10 text-brand' : 'bg-pink-50 text-pink-500'
                  }`}
                >
                  <UserRound size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-[17px] font-bold text-ink">
                    {memberNames[m - 1]}
                    {memberNo === m && (
                      <span className="ml-1.5 rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-sub">
                        나
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[13px] text-sub">
                    {done ? '정산을 마쳤어요 · 다시 수정할 수 있어요' : '아직 정산 전이에요'}
                  </p>
                </div>
                {done ? (
                  <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-[12px] font-bold text-brand">
                    <Check size={13} /> 완료
                  </span>
                ) : (
                  <ChevronRight size={20} className="text-cap" />
                )}
              </button>
            )
          })}
          <p className="px-1 pt-2 text-[12px] leading-relaxed text-cap">
            두 사람 모두 정산을 마치면 {formatMonthKorean(ym)} 결산이 확정돼요.
          </p>
        </div>
      </Frame>
    )
  }

  // ── 완료 화면 ─────────────────────────────
  if (step === DONE_STEP) {
    const bothDone = settledMembers.includes(1) && settledMembers.includes(2)
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
            {bothDone
              ? `${formatMonthKorean(ym)} 정산 완료 🎉`
              : `${memberName} 정산 완료 🙌`}
          </h1>
          <p className="mt-2 text-[14px] text-sub">
            {bothDone
              ? '한 달 수고했어요. 이번 달 성적표예요.'
              : `${partnerName}님이 정산하면 ${formatMonthKorean(ym)} 결산이 확정돼요.`}
          </p>

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
            {!bothDone && (
              <p className="pt-1 text-[11px] text-cap">
                우리집 전체 기준 · {partnerName} 정산 전 예상치예요
              </p>
            )}
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
    // 본인 소유 + 공동 계좌만 갱신 대상으로 노출
    const visibleAssets = assets.filter(
      (a) => !a.owner || a.owner === '공동' || a.owner === memberName,
    )
    return (
      <Frame>
        <Header
          step={step}
          onBack={goBack}
          title="자산 업데이트"
          subtitle={`${memberName} · 내 계좌와 공동 계좌 잔액을 갱신해요`}
        />
        <div className="flex-1 px-5 pb-32">
          <AssetStep
            assets={visibleAssets}
            memberNames={memberNames}
            defaultOwner={memberName}
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
  const def = STEPS[step - 1]
  const stepItems = items.filter((it) => def.groups.includes(it.group) && it.member === member)

  return (
    <Frame>
      <Header
        step={step}
        onBack={goBack}
        title={def.title}
        subtitle={`${memberName} · ${def.subtitle}`}
      />
      <div className="flex-1 px-5 pb-32">
        <MoneyStep
          groups={def.groups}
          items={stepItems}
          categories={categories}
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
  onChange,
  onAdd,
  onRemove,
}: {
  groups: CategoryGroup[]
  items: BudgetItem[]
  categories: Record<CategoryGroup, string[]>
  onChange: (id: string, v: number) => void
  onAdd: (g: CategoryGroup, c: string) => void
  onRemove: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [g, setG] = useState<CategoryGroup>(groups[0])
  const [cat, setCat] = useState(categories[groups[0]][0])

  const submitAdd = () => {
    if (!cat) return
    onAdd(g, cat)
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
            {groups.length > 1 && (
              <p className="mt-0.5 truncate text-[11px] text-cap">{GROUP_LABEL[it.group]}</p>
            )}
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
  memberNames,
  defaultOwner,
  onChange,
  onAdd,
  onRemove,
}: {
  assets: AssetItem[]
  memberNames: [string, string]
  defaultOwner: string
  onChange: (id: string, v: number) => void
  onAdd: (a: Omit<AssetItem, 'id'>) => void
  onRemove: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<'asset' | 'debt'>('asset')
  const [group, setGroup] = useState<AssetGroup>('cash')
  const [name, setName] = useState('')
  const [owner, setOwner] = useState(defaultOwner)
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
            {['공동', ...memberNames].map((o) => (
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
      <AssetIcon group={item.group} kind={item.kind} size={34} />
      <div className="w-[76px] shrink-0">
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
