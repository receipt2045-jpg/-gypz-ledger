import { useEffect, useMemo, useRef, useState } from 'react'
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
  Keyboard,
  Mic,
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
  Trash2,
  Umbrella,
  Utensils,
  Wallet,
} from 'lucide-react'
import WeeklyCostCard from '../components/WeeklyCostCard'
import { useLedgerStore } from '../lib/store'
import { pickReaction, streakOf, type Reaction } from '../lib/reactions'
import { formatComma, formatWon } from '../lib/format'
import { parseConfessionText, type ParsedEntry } from '../lib/confessParser'
import { GROUP_LABEL, NO_SPEND } from '../lib/constants'
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

// ── 인앱 음성인식 지원 판별 ──────────────────────
// iOS 홈화면 PWA에선 Web Speech API가 동작하지 않으므로 마이크 버튼을 숨긴다.
// (그 경우에도 키보드의 딕테이션 키로 같은 경험 가능)
function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>
  const ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | undefined
  if (!ctor) return null
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  if (isIos && standalone) return null
  return ctor
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

/** 확인 화면에서 다루는 항목 (파싱 결과 + 수정 추적) */
interface DraftEntry extends ParsedEntry {
  key: number
  origCategory: string
}

/**
 * 일일 고백 — 줄글/음성 입력이 기본.
 * "점심 9천원, 커피 5,500원" → 파싱 → 확인 → 저장 → 모아/불리 반응.
 * 버튼식(카테고리 그리드 → 숫자패드)은 보조 수단으로 유지.
 */
export default function Confess() {
  const navigate = useNavigate()
  const {
    categories,
    memberNo,
    confessions,
    aliases,
    profile,
    addConfession,
    removeConfession,
    learnAliases,
  } = useLedgerStore()

  // 모드: 줄글(text, 기본) / 버튼(picker)
  const [mode, setMode] = useState<'text' | 'picker'>('text')

  // 줄글 흐름
  const [draft, setDraft] = useState('')
  const [parseMsg, setParseMsg] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftEntry[] | null>(null)
  const [skipped, setSkipped] = useState<string[]>([])
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const SR = useMemo(speechRecognitionCtor, [])

  // 버튼 흐름 (기존)
  const [sel, setSel] = useState<{ kind: CategoryGroup; category: string } | null>(null)
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')

  // 반응 화면 (공통)
  const [result, setResult] = useState<{
    reaction: Reaction
    streak: number
    saved: { category: string; amount: number; note?: string }[]
  } | null>(null)

  useEffect(() => () => recRef.current?.stop(), [])

  // 자주 쓰는 순 정렬 (최근 고백 횟수 기준)
  const freq = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of confessions) m.set(c.category, (m.get(c.category) ?? 0) + 1)
    return m
  }, [confessions])

  const sortByFreq = (list: string[]) =>
    [...list].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0))

  // 어느 날짜로 적을지 — 며칠 밀렸을 때 지난 날짜로도 적을 수 있게
  const today = new Date().toLocaleDateString('sv-SE')
  const [logDate, setLogDate] = useState(today)

  // 누구 카드로 썼는지 — 연말정산 카드 공제가 명의자 기준이라 쌓아두면 추천이 정확해진다
  const [cardOwner, setCardOwner] = useState<1 | 2>(memberNo ?? 1)
  const memberNames: [string, string] = [profile.member1Name, profile.member2Name]

  // 내가 쓴 기록 (최근 14일) — 잘못 쓴 걸 그 자리에서 지울 수 있게
  const myRecent = useMemo(() => {
    const me = memberNo ?? 1
    const since = new Date()
    since.setDate(since.getDate() - 14)
    return confessions
      .filter((c) => c.memberNo === me && new Date(c.createdAt) >= since)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [confessions, memberNo])

  // 날짜별로 묶어서 보여준다
  const recentByDate = useMemo(() => {
    const m = new Map<string, typeof myRecent>()
    for (const c of myRecent) {
      const d = new Date(c.createdAt).toLocaleDateString('sv-SE')
      m.set(d, [...(m.get(d) ?? []), c])
    }
    return [...m.entries()]
  }, [myRecent])

  // 고른 날짜에 이미 기록했는지 (무지출 버튼 노출 여부)
  const confessedToday = myRecent.some(
    (c) => new Date(c.createdAt).toLocaleDateString('sv-SE') === logDate,
  )

  const groups: { title: string; kind: CategoryGroup; cats: string[] }[] = [
    { title: '변동지출', kind: 'variable', cats: sortByFreq(categories.variable) },
    { title: '고정지출', kind: 'fixed', cats: sortByFreq(categories.fixed) },
    { title: '저축', kind: 'saving', cats: categories.saving },
    { title: '투자', kind: 'investment', cats: categories.investment },
  ]

  // ── 저장 (양쪽 흐름 공통) ───────────────────
  const finishSave = (entries: { category: string; kind: CategoryGroup; amount: number; note?: string }[]) => {
    // 지난 날짜를 골랐으면 그 날 낮 12시로 — 시간대가 밀려 하루 어긋나는 걸 막는다
    const createdAt =
      logDate === today ? new Date().toISOString() : new Date(`${logDate}T12:00:00`).toISOString()
    let last = null as ReturnType<typeof addConfession> | null
    for (const e of entries) {
      last = addConfession({
        category: e.category,
        kind: e.kind,
        amount: e.amount,
        note: e.note,
        createdAt,
        // 카드값이 아닌 것(저축·투자·수입)에는 카드 주인을 남기지 않는다
        cardOwner: e.kind === 'variable' || e.kind === 'fixed' ? cardOwner : undefined,
      })
    }
    if (!last) return
    const all = useLedgerStore.getState().confessions
    // 여러 건이면 지출(변동·고정) 중 최고액을 저격 대상으로
    const spend = entries.filter((e) => e.kind === 'variable' || e.kind === 'fixed')
    const headline = (spend.length ? spend : entries).reduce((a, b) => (b.amount > a.amount ? b : a))
    const reaction = pickReaction({ category: headline.category, kind: headline.kind, amount: headline.amount }, all)
    const streak = streakOf(all, memberNo ?? 1)
    setResult({ reaction, streak, saved: entries.map(({ category, amount, note }) => ({ category, amount, note })) })
  }

  // ── 무지출: 0원으로 바로 저장 (확인 단계 없음) ─
  const saveNoSpend = () => {
    finishSave([{ category: NO_SPEND, kind: 'variable', amount: 0 }])
  }

  // ── 줄글: 파싱 → 확인 단계로 ────────────────
  const runParse = () => {
    const r = parseConfessionText(draft, categories, aliases)
    if (r.entries.length === 0) {
      setParseMsg('금액을 찾지 못했어요. "커피 5천원, 점심 9,000원"처럼 적어주세요.')
      return
    }
    setParseMsg(null)
    setSkipped(r.skipped)
    setDrafts(r.entries.map((e, i) => ({ ...e, key: i, origCategory: e.category })))
  }

  // ── 줄글: 확인 → 저장 ───────────────────────
  const saveDrafts = () => {
    if (!drafts?.length) return
    // 카테고리를 고쳤거나 매칭에 실패했던 항목은 별칭으로 학습 (다음부턴 자동)
    const patch: Record<string, string> = {}
    for (const d of drafts) {
      const word = d.note?.split(' ')[0]
      if (!word || word.length < 2) continue
      if (d.category !== d.origCategory || !d.matched) patch[word] = d.category
    }
    if (Object.keys(patch).length) learnAliases(patch)
    finishSave(drafts)
  }

  const toggleMic = () => {
    if (!SR) return
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new SR()
    recRef.current = rec
    rec.lang = 'ko-KR'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (ev) => {
      const text = Array.from({ length: ev.results.length }, (_, i) => ev.results[i][0].transcript)
        .join(' ')
        .trim()
      if (text) setDraft((d) => (d.trim() ? `${d.trim()}, ${text}` : text))
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    setListening(true)
    rec.start()
  }

  const reset = () => {
    setSel(null)
    setAmount(0)
    setNote('')
    setResult(null)
    setDraft('')
    setDrafts(null)
    setSkipped([])
    setParseMsg(null)
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
  if (result) {
    const total = result.saved.reduce((s, e) => s + e.amount, 0)
    return (
      <Frame>
        <Top onBack={() => navigate('/')} title="오늘의 고백" />
        <div className="flex flex-1 flex-col px-5 pt-2 animate-fade-up">
          {/* 방금 고백한 내용 */}
          <div className="mb-5 rounded-card bg-card px-5 py-4 shadow-card">
            {result.saved.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-[14px] text-sub">
                  {e.category}
                  {e.note && <span className="text-cap"> · {e.note}</span>}
                </span>
                <span className="tnum text-[15px] font-bold text-ink">{formatWon(e.amount)}</span>
              </div>
            ))}
            {result.saved.length > 1 && (
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                <span className="text-[13px] font-bold text-sub">모두</span>
                <span className="tnum text-[20px] font-extrabold text-ink">{formatWon(total)}</span>
              </div>
            )}
          </div>

          {/* 캐릭터 말풍선 */}
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

          {/* 불리 실행 액션 */}
          {result.reaction.action && (
            <button
              onClick={() => navigate('/monthly')}
              className="mt-4 flex w-full items-center justify-between gap-2 rounded-card bg-amber-50 px-4 py-3 text-left active:bg-amber-100"
            >
              <span className="text-[14px] font-bold text-amber-700">{result.reaction.action}</span>
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

  // ── 줄글: 확인 화면 ────────────────────────
  if (drafts) {
    const expense: { kind: CategoryGroup; label: string; cats: string[] }[] = [
      { kind: 'variable', label: GROUP_LABEL.variable, cats: categories.variable },
      { kind: 'fixed', label: GROUP_LABEL.fixed, cats: categories.fixed },
    ]
    return (
      <Frame>
        <Top
          onBack={() => setDrafts(null)}
          title="이렇게 기록할까요?"
          subtitle="카테고리와 금액을 눌러 고칠 수 있어요"
        />
        <div className="flex-1 space-y-3 px-5 pb-10 pt-1">
          {drafts.map((d) => {
            const Icon = ICONS[d.category] ?? Coins
            return (
              <div key={d.key} className="rounded-card bg-card px-4 py-3 shadow-card">
                <div className="flex items-center gap-3">
                  <Icon size={20} className="shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <select
                      value={`${d.kind}:${d.category}`}
                      onChange={(e) => {
                        const [kind, category] = e.target.value.split(':') as [CategoryGroup, string]
                        setDrafts((prev) =>
                          prev!.map((x) => (x.key === d.key ? { ...x, kind, category } : x)),
                        )
                      }}
                      className={`w-full appearance-none bg-transparent text-[15px] font-bold outline-none ${
                        d.matched ? 'text-ink' : 'text-amber-600'
                      }`}
                    >
                      {expense.map((g) => (
                        <optgroup key={g.kind} label={g.label}>
                          {g.cats.map((c) => (
                            <option key={c} value={`${g.kind}:${c}`}>
                              {c}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {d.note && <p className="truncate text-[12px] text-cap">{d.note}</p>}
                  </div>
                  <input
                    inputMode="numeric"
                    value={formatComma(d.amount)}
                    onChange={(e) => {
                      const v = Math.min(Number(e.target.value.replace(/[^\d]/g, '')) || 0, 999_999_999)
                      setDrafts((prev) => prev!.map((x) => (x.key === d.key ? { ...x, amount: v } : x)))
                    }}
                    className="tnum w-24 shrink-0 rounded-btn border border-line bg-white px-2 py-1.5 text-right text-[15px] font-bold text-ink outline-none focus:border-brand"
                  />
                  <span className="text-[13px] text-sub">원</span>
                  <button
                    onClick={() => setDrafts((prev) => prev!.filter((x) => x.key !== d.key))}
                    aria-label="삭제"
                    className="shrink-0 text-cap active:text-ink"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                {!d.matched && (
                  <p className="mt-1.5 text-[12px] text-amber-600">
                    어디에 쓴 건지 몰라서 기타로 두었어요. 고쳐주시면 다음부턴 기억할게요.
                  </p>
                )}
              </div>
            )
          })}

          {skipped.length > 0 && (
            <p className="px-1 text-[12px] text-cap">
              금액이 없어 건너뛴 부분: {skipped.join(' / ')}
            </p>
          )}
        </div>
        <BottomBar>
          <button
            onClick={saveDrafts}
            disabled={drafts.length === 0 || drafts.some((d) => d.amount <= 0)}
            className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark disabled:opacity-40"
          >
            {drafts.length}건 고백하기
          </button>
        </BottomBar>
      </Frame>
    )
  }

  // ── 버튼 모드: 금액 입력 (기존 숫자패드) ─────
  if (mode === 'picker' && sel) {
    const save = () => {
      if (!sel || amount <= 0) return
      finishSave([{ category: sel.category, kind: sel.kind, amount, note: note.trim() || undefined }])
    }
    return (
      <Frame>
        <Top onBack={() => setSel(null)} title={sel.category} />
        <div className="flex flex-1 flex-col px-5">
          <p className="tnum py-6 text-center text-[36px] font-extrabold text-ink">
            {amount === 0 ? <span className="text-cap">0</span> : formatComma(amount)}
            <span className="ml-1 text-[20px] font-bold text-sub">원</span>
          </p>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={40}
            placeholder="한 마디 남기기 (선택)"
            className="mb-3 w-full rounded-btn border border-line bg-white px-4 py-3 text-center text-[14px] text-ink outline-none focus:border-brand placeholder:text-cap"
          />

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

  // ── 버튼 모드: 카테고리 그리드 (기존) ────────
  if (mode === 'picker') {
    return (
      <Frame>
        <Top onBack={() => setMode('text')} title="무엇에 썼나요?" subtitle="기록하면 모아·불리가 바로 반응해요" />
        <div className="flex-1 space-y-5 px-5 pb-10 pt-1">
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

  // ── 줄글 입력 (기본 화면) ────────────────────
  return (
    <Frame>
      <Top
        onBack={() => navigate('/')}
        title="오늘 뭐에 썼나요?"
        subtitle="쓴 것들을 한 번에 적어주세요. 나눠서 기록해 드려요"
      />
      <div className="flex-1 space-y-4 px-5 pb-10 pt-1">
        <WeeklyCostCard confessions={confessions} />

        {/* 언제 쓴 건지 — 며칠 밀렸으면 지난 날짜로 적을 수 있다 */}
        <div className="flex items-center gap-2 rounded-card bg-card px-4 py-3 shadow-card">
          <span className="shrink-0 text-[13px] font-bold text-sub">언제 쓴 건가요?</span>
          <input
            type="date"
            value={logDate}
            max={today}
            onChange={(e) => setLogDate(e.target.value || today)}
            className="tnum min-w-0 flex-1 rounded-btn border border-line bg-white px-2.5 py-1.5 text-[13.5px] text-ink outline-none focus:border-brand"
          />
          {logDate !== today && (
            <button
              onClick={() => setLogDate(today)}
              className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-[12px] font-bold text-brand active:bg-brand/20"
            >
              오늘로
            </button>
          )}
        </div>

        {/* 누구 카드로 썼는지 — 연말정산 카드 추천이 이걸로 정확해진다 */}
        <div className="rounded-card bg-card px-4 py-3 shadow-card">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[13px] font-bold text-sub">누구 카드로 썼어요?</span>
            <div className="flex flex-1 gap-1.5">
              {([1, 2] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setCardOwner(m)}
                  className={`min-w-0 flex-1 truncate rounded-btn py-2 text-[13px] font-bold transition-colors ${
                    cardOwner === m ? 'bg-ink text-white' : 'bg-bg text-sub active:bg-line'
                  }`}
                >
                  {memberNames[m - 1]}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-cap">
            연말정산 카드 공제는 명의자별로 계산돼요. 쌓이면 누구 카드를 쓸지 알려드려요
          </p>
        </div>

        <div className="rounded-card bg-card p-3 shadow-card">
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              if (parseMsg) setParseMsg(null)
            }}
            rows={4}
            placeholder={'"점심 9천원, 커피 5,500원"\n이라고 말해보세요'}
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-cap"
          />
          <div className="mt-1 flex items-center justify-between">
            <button
              onClick={() => setMode('picker')}
              className="flex items-center gap-1.5 text-[13px] font-bold text-sub active:text-ink"
            >
              <Keyboard size={15} /> 버튼으로 고르기
            </button>
            {SR && (
              <button
                onClick={toggleMic}
                aria-label="음성으로 입력"
                className={`flex h-11 w-11 items-center justify-center rounded-full shadow-card transition-colors ${
                  listening ? 'animate-pulse bg-red-500 text-white' : 'bg-brand text-white active:bg-brand-dark'
                }`}
              >
                <Mic size={19} />
              </button>
            )}
          </div>
        </div>

        {listening && (
          <p className="text-center text-[13px] font-bold text-red-500">
            듣고 있어요… 말이 끝나면 자동으로 받아 적어요
          </p>
        )}
        {parseMsg && <p className="px-1 text-[13px] font-bold text-amber-600">{parseMsg}</p>}

        {/* 무지출 — 안 쓴 날도 기록해야 연속이 안 끊긴다 */}
        {!confessedToday && (
          <button
            onClick={saveNoSpend}
            className="flex w-full items-center justify-between rounded-card bg-card px-4 py-3.5 text-left shadow-card active:bg-line"
          >
            <span>
              <span className="block text-[14px] font-bold text-ink">
                🍚 {logDate === today ? '오늘은' : '이 날은'} 안 썼어요
              </span>
              <span className="mt-0.5 block text-[12px] text-sub">
                0원도 기록이에요. 연속 일수가 안 끊겨요
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-cap" />
          </button>
        )}

        {/* 내가 쓴 기록 (최근 14일) — 잘못 쓴 건 여기서 바로 지운다 */}
        {recentByDate.length > 0 && (
          <div className="rounded-card bg-card px-4 py-3.5 shadow-card">
            <p className="mb-2 text-[13px] font-bold text-cap">
              내 기록 · 잘못 썼으면 지우고 다시 적어요
            </p>
            <div className="space-y-3">
              {recentByDate.map(([date, list]) => (
                <div key={date}>
                  <p className="tnum text-[12px] font-bold text-sub">
                    {date === today ? '오늘' : date.slice(5).replace('-', '월 ') + '일'}
                  </p>
                  <div className="divide-y divide-line/70">
                    {list.map((c) => (
                      <div key={c.id} className="flex items-center gap-2.5 py-2.5">
                        <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                          {c.category}
                          {c.note && <span className="text-cap"> · {c.note}</span>}
                        </span>
                        <span className="tnum shrink-0 text-[14px] font-bold text-ink">
                          {formatWon(c.amount)}
                        </span>
                        <button
                          onClick={() => removeConfession(c.id)}
                          aria-label="고백 삭제"
                          className="shrink-0 text-cap active:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <BottomBar>
        <button
          onClick={runParse}
          disabled={!draft.trim()}
          className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark disabled:opacity-40"
        >
          확인하기
        </button>
      </BottomBar>
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
