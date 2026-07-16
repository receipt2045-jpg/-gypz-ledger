import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  PartyPopper,
  StickyNote,
  UserRound,
} from 'lucide-react'
import AiCoachCard from '../components/AiCoachCard'
import AmountInput from '../components/AmountInput'
import AssetEditor from '../components/AssetEditor'
import StepProgress from '../components/StepProgress'
import { buildSummary } from '../lib/aiCoach'
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
  formatYmKorean,
  shiftYm,
} from '../lib/format'
import { GROUP_LABEL } from '../lib/constants'
import type { AssetItem, BudgetItem, CategoryGroup } from '../types'

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
  const { ledgers, snapshots, categories, profile, memberNo, saveLedger, saveSnapshot, addCategory } =
    useLedgerStore()

  // 정산 대상 월 — 첫 화면에서 지난 달로 변경 가능, 이후 스텝에선 고정
  const [ym, setYm] = useState(() => activeYm(ledgers))
  const latestYm = activeYm(ledgers) // 이보다 미래 달은 선택 불가

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
  const [showErrors, setShowErrors] = useState(false) // 금액 검증 (브리프 P1 2.2)

  const memberNames: [string, string] = [profile.member1Name, profile.member2Name]
  const memberName = member ? memberNames[member - 1] : ''
  const partnerName = member ? memberNames[member === 1 ? 1 : 0] : ''
  const settledMembers = resolveLedger(ledgers, ym).settledMembers ?? []
  // '지난달과 같아요'는 직전 정산 기록이 있을 때만 활성 (브리프 P2 3.3)
  const hasPrevLedger = ledgers.some((l) => l.ym < ym && l.items.length > 0)

  // 정산할 달 변경: 해당 월 데이터로 입력 초안을 다시 만든다 (첫 화면에서만 노출)
  const changeYm = (delta: number) => {
    const ny = shiftYm(ym, delta)
    if (ny > latestYm) return
    setYm(ny)
    setItems(resolveLedger(ledgers, ny).items.map((it) => ({ ...it })))
    setAssets(resolveSnapshot(snapshots, ny).items.map((it) => ({ ...it })))
  }

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
  const setNote = (id: string, note: string) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, note: note.trim() || undefined } : it)),
    )
  const addItem = (group: CategoryGroup, category: string) => {
    if (!member) return
    setItems((prev) => [...prev, { ...emptyItem(group, category, member), actual: 0 }])
  }
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id))

  const setAssetAmount = (id: string, amount: number) =>
    setAssets((prev) => prev.map((it) => (it.id === id ? { ...it, amount } : it)))
  const setAssetNote = (id: string, note: string) =>
    setAssets((prev) =>
      prev.map((it) => (it.id === id ? { ...it, note: note.trim() || undefined } : it)),
    )
  const updateAsset = (id: string, patch: Partial<Omit<AssetItem, 'id'>>) =>
    setAssets((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
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
    setShowErrors(false)
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
          {/* 정산할 달 선택 — 지난 달 정산·수정 가능 */}
          <div className="flex items-center justify-center gap-2 pb-1">
            <button
              onClick={() => changeYm(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line"
              aria-label="이전 달"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-[130px] text-center">
              <p className="text-[16px] font-bold text-ink">{formatYmKorean(ym)}</p>
              <p className="text-[11px] text-cap">정산할 달</p>
            </div>
            <button
              onClick={() => changeYm(1)}
              disabled={ym >= latestYm}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line disabled:opacity-25"
              aria-label="다음 달"
            >
              <ChevronRight size={20} />
            </button>
          </div>
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
        <div className="flex flex-1 flex-col items-center px-6 pb-28 pt-14 text-center animate-fade-up">
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

          {/* AI 코치 진단 (브리프 P3 4.1) */}
          <AiCoachCard summary={buildSummary(ym, items)} />
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
          caption={`${formatYmKorean(ym)} 정산`}
        />
        <div className="flex-1 px-5 pb-32">
          <AssetEditor
            assets={visibleAssets}
            memberNames={memberNames}
            defaultOwner={memberName}
            onChange={setAssetAmount}
            onNote={setAssetNote}
            onUpdate={updateAsset}
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

  // 빈값·0원 항목이 있으면 다음 단계로 못 넘어감 (삭제하거나 금액 입력)
  const stepInvalid = stepItems.some((it) => !it.actual || it.actual <= 0)
  const tryNext = () => {
    if (stepInvalid) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    next()
  }

  return (
    <Frame>
      <Header
        step={step}
        onBack={goBack}
        title={def.title}
        subtitle={`${memberName} · ${def.subtitle}`}
        caption={`${formatYmKorean(ym)} 정산`}
      />
      <div className="flex-1 px-5 pb-32">
        <MoneyStep
          groups={def.groups}
          items={stepItems}
          categories={categories}
          showErrors={showErrors}
          onChange={setActual}
          onNote={setNote}
          onAdd={addItem}
          onRemove={removeItem}
          onCreateCategory={addCategory}
        />
      </div>
      <BottomBar>
        <div className="space-y-2">
          <button
            onClick={tryNext}
            className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark"
          >
            다음
          </button>
          {def.sameAsLast &&
            (hasPrevLedger ? (
              <button
                onClick={tryNext}
                className="h-11 w-full rounded-btn bg-white text-[14px] font-semibold text-sub active:bg-line"
              >
                지난달과 같아요
              </button>
            ) : (
              // 첫 정산엔 지난달 데이터가 없어 비활성 + 안내 (브리프 P2 3.3)
              <button
                disabled
                className="h-11 w-full rounded-btn bg-white text-[13px] font-medium text-cap"
              >
                지난달 정산 기록이 있으면 그대로 불러옵니다
              </button>
            ))}
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
  caption,
}: {
  step: number
  onBack: () => void
  title: string
  subtitle: string
  caption?: string // 정산 월 표기 (브리프 P2 3.1)
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
      {caption && <p className="mb-0.5 text-[13px] font-semibold text-brand">{caption}</p>}
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
const NEW_CAT = '__new__' // '+ 새 카테고리' 옵션 값

function MoneyStep({
  groups,
  items,
  categories,
  showErrors,
  onChange,
  onNote,
  onAdd,
  onRemove,
  onCreateCategory,
}: {
  groups: CategoryGroup[]
  items: BudgetItem[]
  categories: Record<CategoryGroup, string[]>
  showErrors: boolean
  onChange: (id: string, v: number) => void
  onNote: (id: string, note: string) => void
  onAdd: (g: CategoryGroup, c: string) => void
  onRemove: (id: string) => void
  onCreateCategory: (g: CategoryGroup, name: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [g, setG] = useState<CategoryGroup>(groups[0])
  const [cat, setCat] = useState(categories[groups[0]][0])
  const [newCatName, setNewCatName] = useState('')
  const [memoOpen, setMemoOpen] = useState<string | null>(null)

  // '기타'가 없는 기존 데이터에도 항상 노출 (브리프 P1 2.1)
  const catOptions = categories[g].includes('기타') ? categories[g] : [...categories[g], '기타']

  const submitAdd = () => {
    if (cat === NEW_CAT) {
      const name = newCatName.trim()
      if (!name) return
      onCreateCategory(g, name) // 설정의 카테고리 목록에도 저장
      onAdd(g, name)
    } else {
      if (!cat) return
      onAdd(g, cat)
    }
    setNewCatName('')
    setAdding(false)
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="py-6 text-center text-[13px] text-cap">항목을 추가해 주세요</p>
      )}
      {items.map((it) => {
        const invalid = showErrors && (!it.actual || it.actual <= 0)
        const memoVisible = memoOpen === it.id || !!it.note
        return (
          <div key={it.id} className="rounded-card bg-card px-4 py-3 shadow-card">
            <div className="flex items-center gap-2.5">
              <div className="w-[76px] shrink-0">
                <p className="truncate text-[15px] font-semibold text-ink">{it.category}</p>
                {groups.length > 1 && (
                  <p className="mt-0.5 truncate text-[11px] text-cap">{GROUP_LABEL[it.group]}</p>
                )}
              </div>
              <AmountInput
                className="flex-1"
                value={it.actual}
                error={invalid}
                onChange={(v) => onChange(it.id, v)}
              />
              <button
                onClick={() => setMemoOpen(memoOpen === it.id ? null : it.id)}
                className={`shrink-0 ${memoVisible ? 'text-brand' : 'text-cap'} active:text-brand`}
                aria-label="메모"
              >
                <StickyNote size={16} />
              </button>
              <button
                onClick={() => onRemove(it.id)}
                className="shrink-0 text-cap active:text-danger"
                aria-label="삭제"
              >
                <X size={18} />
              </button>
            </div>
            {memoVisible && (
              <input
                type="text"
                value={it.note ?? ''}
                onChange={(e) => onNote(it.id, e.target.value)}
                placeholder="메모 (선택)"
                className="mt-2 w-full rounded-btn border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand placeholder:text-cap"
              />
            )}
            {invalid && (
              <p className="mt-1.5 text-right text-[12px] font-medium text-danger">
                금액을 입력해 주세요 ❗️
              </p>
            )}
          </div>
        )
      })}

      {adding ? (
        <div className="space-y-2 rounded-card bg-card p-4 shadow-card">
          {/* 드롭다운 가로 배치: '추가' 버튼 위치가 흔들리지 않게 고정 (브리프 P1 2.3) */}
          <div className="flex gap-2">
            {groups.length > 1 && (
              <select
                value={g}
                onChange={(e) => {
                  const ng = e.target.value as CategoryGroup
                  setG(ng)
                  setCat(categories[ng][0])
                }}
                className="min-w-0 flex-1 rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
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
              className="min-w-0 flex-1 rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
            >
              {catOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NEW_CAT}>+ 새 카테고리</option>
            </select>
          </div>
          {cat === NEW_CAT && (
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
              placeholder="새 카테고리 이름"
              autoFocus
              className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand placeholder:text-cap"
            />
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setAdding(false)
                setNewCatName('')
              }}
              className="h-11 flex-1 rounded-btn bg-bg text-[14px] font-semibold text-sub active:bg-line"
            >
              취소
            </button>
            <button
              onClick={submitAdd}
              disabled={cat === NEW_CAT && !newCatName.trim()}
              className="h-11 flex-1 rounded-btn bg-brand text-[14px] font-bold text-white active:bg-brand-dark disabled:opacity-40"
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
