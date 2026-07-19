import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Baby,
  Banknote,
  Bitcoin,
  BookOpen,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Coins,
  Delete,
  Dog,
  Gift,
  HeartPulse,
  Home,
  MonitorPlay,
  PiggyBank,
  Plane,
  Receipt,
  Shield,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Umbrella,
  Utensils,
  Wallet,
} from 'lucide-react'
import WeeklyCostCard from '../components/WeeklyCostCard'
import { useLedgerStore } from '../lib/store'
import { pickReaction, streakOf, type Reaction } from '../lib/reactions'
import { formatComma, formatWon } from '../lib/format'
import type { CategoryGroup } from '../types'

// 카테고리 아이콘 매핑 (없으면 Coins)
const ICONS: Record<string, typeof Coins> = {
  식비: Utensils,
  생활용품: ShoppingBasket,
  건강: HeartPulse,
  육아: Baby,
  꾸밈: Sparkles,
  자기계발: BookOpen,
  여행: Plane,
  자동차: Car,
  문화생활: Clapperboard,
  세금: Receipt,
  반려견: Dog,
  경조사: Gift,
  보험: Shield,
  통신: Smartphone,
  용돈: Wallet,
  주거: Home,
  구독: MonitorPlay,
  주택청약: Building2,
  예금: PiggyBank,
  적금: PiggyBank,
  연금: Umbrella,
  목적저금: Target,
  주식: TrendingUp,
  부동산: Building2,
  코인: Bitcoin,
  주수입: Banknote,
  부수입: Banknote,
  투자수익: TrendingUp,
}

const QUICK_CHIPS = [1_000, 5_000, 10_000, 50_000]

/**
 * 일일 고백 (원팀가계부 P0)
 * 카테고리 탭 → 금액 탭 → 저장, 3탭 이내 · 키보드 없음.
 * 저장 즉시 모아/불리 말풍선 반응(로컬 규칙) + 스트릭.
 */
export default function Confess() {
  const navigate = useNavigate()
  const { categories, memberNo, confessions, addConfession } = useLedgerStore()

  const [sel, setSel] = useState<{ kind: CategoryGroup; category: string } | null>(null)
  const [amount, setAmount] = useState(0)
  const [result, setResult] = useState<{ reaction: Reaction; streak: number } | null>(null)

  // 자주 쓰는 순 정렬 (최근 고백 횟수 기준, 나머지는 기본 순서)
  const freq = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of confessions) m.set(c.category, (m.get(c.category) ?? 0) + 1)
    return m
  }, [confessions])

  const sortByFreq = (list: string[]) =>
    [...list].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0))

  const groups: { title: string; kind: CategoryGroup; cats: string[] }[] = [
    { title: '변동지출', kind: 'variable', cats: sortByFreq(categories.variable) },
    { title: '고정지출', kind: 'fixed', cats: sortByFreq(categories.fixed) },
    { title: '저축', kind: 'saving', cats: categories.saving },
    { title: '투자', kind: 'investment', cats: categories.investment },
  ]

  const save = () => {
    if (!sel || amount <= 0) return
    const full = addConfession({ category: sel.category, kind: sel.kind, amount })
    const all = useLedgerStore.getState().confessions
    const reaction = pickReaction(full, all)
    const streak = streakOf(all, memberNo ?? 1)
    setResult({ reaction, streak })
  }

  const reset = () => {
    setSel(null)
    setAmount(0)
    setResult(null)
  }

  const tapDigit = (d: string) => {
    if (d === '⌫') {
      setAmount((a) => Math.floor(a / 10))
      return
    }
    setAmount((a) => {
      const next = a * 10 + (d === '00' ? 0 : Number(d))
      const withDouble = d === '00' ? a * 100 : next
      return Math.min(withDouble, 999_999_999)
    })
  }

  // ── 반응 화면 ─────────────────────────────
  if (result && sel) {
    return (
      <Frame>
        <Top onBack={() => navigate('/')} title="오늘의 고백" />
        <div className="flex flex-1 flex-col px-5 pt-2 animate-fade-up">
          {/* 방금 고백한 내용 */}
          <div className="mb-5 rounded-card bg-card px-5 py-4 text-center shadow-card">
            <p className="text-[13px] text-sub">{sel.category}</p>
            <p className="tnum text-[26px] font-extrabold text-ink">{formatWon(amount)}</p>
          </div>

          {/* 캐릭터 말풍선 (스티커 슬롯은 추후 이미지 예정 — 지금은 이름표+이모지) */}
          <div className="space-y-3">
            {result.reaction.bubbles.map((b, i) => (
              <div key={i} className={`flex ${b.who === '불리' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${b.who === '불리' ? 'text-right' : ''}`}>
                  <p
                    className={`mb-1 text-[12px] font-bold ${
                      b.who === '모아' ? 'text-brand' : 'text-amber-600'
                    }`}
                  >
                    {b.who === '모아' ? '🐷 모아' : '📈 불리'}
                    {/* TODO: 캐릭터 스티커 슬롯 (5~6종 자체 제작 예정) */}
                  </p>
                  <div
                    className={`inline-block rounded-2xl px-4 py-3 text-left text-[14px] leading-relaxed shadow-card ${
                      b.who === '모아' ? 'rounded-tl-sm bg-card text-ink' : 'rounded-tr-sm bg-brand text-white'
                    }`}
                  >
                    {b.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 불리 실행 액션 (면죄부 방지 — 다음 행동으로 연결) */}
          {result.reaction.action && (
            <button
              onClick={() => navigate('/monthly')}
              className="mt-4 flex w-full items-center justify-between gap-2 rounded-card bg-amber-50 px-4 py-3 text-left active:bg-amber-100"
            >
              <span className="text-[14px] font-bold text-amber-700">
                {result.reaction.action}
              </span>
              <ChevronRight size={18} className="shrink-0 text-amber-500" />
            </button>
          )}

          {/* 스트릭 */}
          <p className="mt-6 text-center text-[14px] font-bold text-ink">
            🔥 {result.streak}일 연속 고백 중!
          </p>
        </div>
        <BottomBar>
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="h-14 flex-1 rounded-btn bg-white text-[15px] font-bold text-ink shadow-cta active:bg-line"
            >
              한 건 더 고백
            </button>
            <button
              onClick={() => navigate('/')}
              className="h-14 flex-1 rounded-btn bg-brand text-[15px] font-bold text-white shadow-cta active:bg-brand-dark"
            >
              홈으로
            </button>
          </div>
        </BottomBar>
      </Frame>
    )
  }

  // ── 금액 입력 (숫자 패드, 키보드 없음) ─────
  if (sel) {
    return (
      <Frame>
        <Top onBack={() => setSel(null)} title={sel.category} />
        <div className="flex flex-1 flex-col px-5">
          <p className="tnum py-6 text-center text-[36px] font-extrabold text-ink">
            {amount === 0 ? <span className="text-cap">0</span> : formatComma(amount)}
            <span className="ml-1 text-[20px] font-bold text-sub">원</span>
          </p>

          {/* 퀵칩: 탭 한 번으로 금액 추가 */}
          <div className="mb-3 flex justify-center gap-2">
            {QUICK_CHIPS.map((v) => (
              <button
                key={v}
                onClick={() => setAmount((a) => Math.min(a + v, 999_999_999))}
                className="rounded-full bg-card px-3.5 py-2 text-[13px] font-bold text-ink shadow-card active:bg-line"
              >
                +{formatComma(v)}
              </button>
            ))}
          </div>

          {/* 숫자 패드 */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'].map((d) => (
              <button
                key={d}
                onClick={() => tapDigit(d)}
                className="flex h-16 items-center justify-center rounded-card bg-card text-[22px] font-bold text-ink shadow-card active:bg-line"
              >
                {d === '⌫' ? <Delete size={22} /> : d}
              </button>
            ))}
          </div>
        </div>
        <BottomBar>
          <button
            onClick={save}
            disabled={amount <= 0}
            className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark disabled:opacity-40"
          >
            고백하기
          </button>
        </BottomBar>
      </Frame>
    )
  }

  // ── 카테고리 선택 (아이콘 그리드) ──────────
  return (
    <Frame>
      <Top onBack={() => navigate('/')} title="무엇에 썼나요?" subtitle="툭 던지면 모아·불리가 바로 반응해요" />
      <div className="flex-1 space-y-5 px-5 pb-10 pt-1">
        {/* 면죄부 방지 — 이번 주 기회비용 */}
        <WeeklyCostCard confessions={confessions} />

        {groups.map(
          (g) =>
            g.cats.length > 0 && (
              <section key={g.kind}>
                <p className="mb-2 px-1 text-[13px] font-bold text-sub">{g.title}</p>
                <div className="grid grid-cols-4 gap-2">
                  {g.cats.map((cat) => {
                    const Icon = ICONS[cat] ?? Coins
                    return (
                      <button
                        key={cat}
                        onClick={() => setSel({ kind: g.kind, category: cat })}
                        className="flex flex-col items-center gap-1.5 rounded-card bg-card px-1 py-3 shadow-card transition-transform active:scale-95"
                      >
                        <Icon size={22} className="text-brand" />
                        <span className="w-full truncate text-center text-[12px] font-medium text-ink">
                          {cat}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ),
        )}
      </div>
    </Frame>
  )
}

// ── 레이아웃 헬퍼 ─────────────────────────────
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="relative flex min-h-screen w-full max-w-app flex-col bg-bg pb-28 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        {children}
      </div>
    </div>
  )
}

function Top({
  onBack,
  title,
  subtitle,
}: {
  onBack: () => void
  title: string
  subtitle?: string
}) {
  return (
    <div className="sticky top-0 z-20 bg-bg px-5 pb-3 pt-4">
      <button onClick={onBack} className="mb-2 text-ink active:opacity-60" aria-label="뒤로">
        <ChevronLeft size={26} />
      </button>
      <h1 className="text-[22px] font-extrabold text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-[13px] text-sub">{subtitle}</p>}
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
