import PcColumns from '../components/PcColumns'
import RecipeLink from '../components/RecipeLink'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, Mic, Trash2, X } from 'lucide-react'
import BudgetBars, { budgetCats } from '../components/BudgetBars'
import MonthCalendar, { type DayMark } from '../components/MonthCalendar'
import FixedCostCheck from '../components/FixedCostCheck'
import MonthlyReportCard from '../components/MonthlyReportCard'
import MonthOverview from '../components/MonthOverview'
import OccasionSection from '../components/OccasionSection'
import SectionList from '../components/SectionList'
import { useLedgerStore } from '../lib/store'
import { useMonthConfessions } from '../lib/useMonthConfessions'
import { buildMonthlyCard } from '../lib/monthlyCard'
import { openingYm, resolveLedger } from '../lib/carryover'
import { currentYm, formatWon, formatYmKorean, periodLabel, shiftYm, ymOfDay } from '../lib/format'
import { GROUP_LABEL, GROUP_ORDER, NO_SPEND, visibleCategories } from '../lib/constants'
import EditRow from '../components/ConfessEditRow'
import { FilterStrip, isFilterOn, type FilterState } from '../components/ExcelFilter'
import ConfessTable, {
  confessCols,
  filterConfessions,
  FilterSummary,
} from '../components/ConfessTable'
import { confessSums, monthConfessions } from '../lib/confessLedger'
import { noSpendDays } from '../lib/noSpend'
import { memberStyle } from '../lib/memberColors'
import type { CategoryGroup } from '../types'

type MemberFilter = 0 | 1 | 2 // 0 = 함께

const BANNER_KEY = 'gypz-concept-banner-closed'

export default function Monthly() {
  const navigate = useNavigate()
  const {
    ledgers,
    snapshots,
    categories: allCategories,
    profile,
    confessions,
    occasions,
    addOccasion,
    removeOccasion,
    updateOccasion,
    removeConfession,
    updateConfession,
    memberNo,
    saveLedger,
    removeMonth,
  } = useLedgerStore()
  // 처음 보이는 달 — 다음 달 예산을 미리 세웠어도 이번 달부터 (11-01 의견: "로그인하면 12월부터 봐져요")
  const [ym, setYm] = useState(() => openingYm(ledgers))
  // 62일보다 앞선 달을 열면 그 달 소비 기록을 서버에서 더 읽어 온다 (2026-11-17)
  useMonthConfessions(ym)
  // 오늘 내가 소비 기록을 했는지 — 탭 바와 같은 기준(로컬 날짜)
  const todayKey = new Date().toLocaleDateString('sv-SE')
  const confessedToday = confessions.some(
    (c) =>
      c.memberNo === (memberNo ?? 1) &&
      new Date(c.createdAt).toLocaleDateString('sv-SE') === todayKey,
  )
  const [member, setMember] = useState<MemberFilter>(0)
  // 개념 안내 배너 (브리프 P0 1.2) — 닫으면 이 기기에서 다시 안 뜸
  const [showBanner, setShowBanner] = useState(() => !localStorage.getItem(BANNER_KEY))
  const closeBanner = () => {
    localStorage.setItem(BANNER_KEY, '1')
    setShowBanner(false)
  }

  const ledger = resolveLedger(ledgers, ym)
  const memberNames: [string, string] = [profile.member1Name, profile.member2Name]
  // 소비 기록 줄을 누르면 그 자리에서 고친다 (2026-11-24) — 아이 없는 집엔 아동수당 칸을 숨긴 목록으로
  const [editingLog, setEditingLog] = useState<string | null>(null)
  const categories = useMemo(
    () => visibleCategories(allCategories, profile.childNames),
    [allCategories, profile.childNames],
  )
  // 내가 이 달 정산을 했는지 — 혼자 끝낸 경우에도 되돌릴 수 있어야 한다
  const me = memberNo ?? 1
  const iSettled = ledger.closed || (ledger.settledMembers ?? []).includes(me)
  // 이 달에 실제로 저장된 기록이 있을 때만 '통째로 지우기'를 보여준다
  // (resolveLedger는 없는 달도 이전 달에서 만들어 주므로 원본을 직접 본다)
  const hasAnyRecord = ledgers.some((l) => l.ym === ym) || snapshots.some((s) => s.ym === ym)

  // 공동 항목(예산 표의 '공동' 칸)은 한 사람 것이 아니라 사람별 보기에선 뺀다
  const filteredItems =
    member === 0 ? ledger.items : ledger.items.filter((it) => it.member === member && !it.shared)

  // 이 달 고백 내역 — 오래된 달은 useMonthConfessions가 읽어 온 뒤 채워진다
  // 2026-11-24 개편: 사람별 보기는 '항목별 내역' 안에서만 — 달력·요약은 늘 우리집 전체
  const monthLog = useMemo(() => monthConfessions(confessions, ym), [confessions, ym])
  // 아래 '자세히 보기'에서 펼친 줄 하나
  const [folded, setFolded] = useState<string | null>(null)
  // 소비 합계엔 들어온 돈(수입 기록)을 섞지 않는다 — 수입도 바로 적을 수 있게 된 뒤로 필요해졌다
  const spendLog = monthLog.filter((c) => c.kind !== 'income')
  const logTotal = spendLog.reduce((sum, c) => sum + c.amount, 0)
  // 소비 기록 달력으로 보기 (2026-11-24 결영 요청) — 고른 걸 이 기기에 기억한다
  const [logView, setLogViewState] = useState<'list' | 'calendar'>(() => {
    try {
      return localStorage.getItem('moabuli.monthly.logView') === 'list' ? 'list' : 'calendar'
    } catch {
      return 'calendar'
    }
  })
  const setLogView = (v: 'list' | 'calendar') => {
    setLogViewState(v)
    try {
      localStorage.setItem('moabuli.monthly.logView', v)
    } catch {
      /* 기억 못 해도 그대로 */
    }
  }
  const [logDay, setLogDay] = useState<string | null>(todayKey)
  const dayKey = (c: { createdAt: string }) => new Date(c.createdAt).toLocaleDateString('sv-SE')
  // ── 소비 기록 거르기 (2026-11-25 결영 요청: "가계부 탭 소비 기록에도 필터 넣어줘") ──
  // 2026-11-25 "필터는 엑셀처럼 보이게" — 날짜·구분·종류·누가·메모 칸 이름 옆 ▾. 달력 표시와 목록이 같이 걸러진다
  const [logF, setLogF] = useState<FilterState>({})
  const logCols = confessCols(monthLog, memberNames)
  const logFiltering = isFilterOn(logF)
  const filteredLog = filterConfessions(monthLog, logF)
  // 위 합계와 같은 기준 — 수입이 아닌 건 쓴 돈(−), 수입은 들어온 돈(+)
  const logMarks: Record<string, DayMark> = {}
  for (const c of filteredLog) {
    if (c.category === NO_SPEND) continue
    const d = (logMarks[dayKey(c)] ??= {})
    if (c.kind === 'income') d.plus = (d.plus ?? 0) + c.amount
    else d.minus = (d.minus ?? 0) + c.amount
  }
  // 무지출 하트는 거르지 않을 때만 — 거른 달력에선 헷갈린다
  if (!logFiltering)
    for (const day of noSpendDays(ym, monthLog, confessions, todayKey))
      (logMarks[day] ??= {}).heart = true
  const logDayIn = logDay && logDay.startsWith(ym) ? logDay : null
  const shownLog =
    logView === 'calendar'
      ? logDayIn
        ? filteredLog.filter((c) => dayKey(c) === logDayIn)
        : []
      : filteredLog

  // 비정기 지출 — 보는 달 것만 목록에, 합계는 올해 누적 (연간비 감각 유지)
  const monthOccasions = occasions.filter((o) => ymOfDay(o.date) === ym)
  const yearOccasions = occasions.filter((o) => o.date.startsWith(ym.slice(0, 4)))
  const occasionYearTotal = yearOccasions.reduce((a, o) => a + o.amount, 0)
  // 추가 폼 기본 날짜: 보는 달이 이번 달이면 오늘, 아니면 그 달 1일
  const today = new Date().toLocaleDateString('sv-SE')
  const occasionDefaultDate = today.startsWith(ym) ? today : `${ym}-01`
  // 비정기 지출 입력 폼 열림
  const [occasionOpen, setOccasionOpen] = useState(false)

  const goodWhenOver = (g: CategoryGroup) => g === 'income' || g === 'saving' || g === 'investment'

  const tabs: { key: MemberFilter; label: string }[] = [
    { key: 0, label: '함께 보기' },
    { key: 1, label: profile.member1Name },
    { key: 2, label: profile.member2Name },
  ]

  const confessed = confessSums(confessions, ym)
  const budget = budgetCats(ledger.items, confessed, ledger.settledMembers ?? [], ledger.closed)
  const label = formatYmKorean(ym).split(' ')[1]

  // 누가 얼마 — 공동 기록은 적은 사람 합계에 섞지 않는다
  const personSplit = (
    <div className="grid grid-cols-3 gap-1.5">
      {(
        [
          [memberNames[0], spendLog.filter((c) => !c.shared && c.memberNo === 1)],
          [memberNames[1], spendLog.filter((c) => !c.shared && c.memberNo === 2)],
          ['공동', spendLog.filter((c) => c.shared)],
        ] as const
      ).map(([name, list]) => (
        <div key={name} className="rounded-btn bg-bg px-2 py-2 text-center">
          <p className="truncate text-[11.5px] font-bold text-sub">{name}</p>
          <p className="tnum mt-0.5 text-[13px] font-bold text-ink">
            {formatWon(list.reduce((s, c) => s + c.amount, 0))}
          </p>
        </div>
      ))}
    </div>
  )

  // 기록 한 줄 — 배우자 몫을 대신 적을 수 있으니 대신 지울 수도 있다
  const logRow = (c: (typeof monthLog)[number]) => {
    const d = new Date(c.createdAt)
    const style = memberStyle(c.memberNo, profile)
    if (editingLog === c.id)
      return (
        <EditRow
          key={c.id}
          c={c}
          categories={categories}
          memberNames={memberNames}
          onSave={(patch) => {
            updateConfession(c.id, patch)
            setEditingLog(null)
          }}
          onCancel={() => setEditingLog(null)}
        />
      )
    return (
      <div key={c.id} className="flex items-center gap-2.5">
        {/* 줄 전체를 누르면 그 자리에서 고친다 — 금액·종류·메모·날짜·누가 썼는지 (2026-11-24 요청) */}
        <button
          onClick={() => setEditingLog(c.id)}
          aria-label={`${c.category} 기록 고치기`}
          className="-my-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-btn py-1 text-left active:bg-bg"
        >
          {logView === 'list' && (
            <span className="tnum w-10 shrink-0 text-[12px] text-cap">
              {d.getMonth() + 1}/{d.getDate()}
            </span>
          )}
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
              c.shared ? 'bg-line text-sub' : style.badge
            }`}
          >
            {c.shared ? '공동' : memberNames[c.memberNo - 1]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] text-ink">{c.category}</span>
            {c.note && (
              <span className="mt-0.5 block break-words text-[12px] leading-snug text-sub">
                {c.note}
              </span>
            )}
          </span>
          <span
            className={`tnum shrink-0 text-[13.5px] font-bold ${c.kind === 'income' ? 'text-brand' : 'text-ink'}`}
          >
            {c.kind === 'income' ? '+' : ''}
            {formatWon(c.amount)}
          </span>
        </button>
        {/* 지우기 전에 묻고, 누르는 영역을 넓힌다 (2026-11-19 점검: 아이콘 크기 그대로라 잘못 눌렀다) */}
        <button
          onClick={() => {
            if (window.confirm(`${c.category} ${formatWon(c.amount)} 기록을 지울까요?`))
              removeConfession(c.id)
          }}
          className="-m-2 shrink-0 p-2 text-cap active:text-danger"
          aria-label="기록 삭제"
        >
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  /** 접어 두는 줄 — 누르면 아래로 펼친다 */
  const fold = (key: string, title: string, summary: string, body: ReactNode) => (
    <div className="rounded-card bg-card px-5 py-3.5 shadow-card">
      <button
        onClick={() => setFolded((cur) => (cur === key ? null : key))}
        aria-expanded={folded === key}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="text-[15px] font-bold text-ink">{title}</span>
        <span className="tnum flex items-center gap-1 text-[13.5px] font-bold text-sub">
          {summary}
          <ChevronDown
            size={16}
            className={`text-cap transition-transform ${folded === key ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {folded === key && <div className="mt-3 border-t border-line pt-3">{body}</div>}
    </div>
  )

  return (
    <div className="animate-fade-up space-y-4">
      {/* 개념 안내 배너 */}
      {showBanner && (
        <div className="flex items-start justify-between gap-3 rounded-card bg-brand/10 px-4 py-3">
          <div>
            <p className="text-[14px] font-bold text-ink">매일은 소비 기록만, 월말엔 정산 ❗️</p>
            <p className="mt-0.5 text-[13px] text-sub">
              쓴 돈은 그날그날 말로 남기고, 월말에 '정산하기'로 한 번에 정리해요
            </p>
          </div>
          <button onClick={closeBanner} className="shrink-0 pt-0.5 text-cap" aria-label="배너 닫기">
            <X size={17} />
          </button>
        </div>
      )}

      {/* 월 선택 */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          onClick={() => setYm(shiftYm(ym, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line"
          aria-label="이전 달"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-[128px] text-center">
          <h1 className="text-[18px] font-bold text-ink">{formatYmKorean(ym)}</h1>
          {periodLabel(ym) && <p className="text-[12px] text-cap">{periodLabel(ym)}</p>}
        </div>
        <button
          onClick={() => setYm(shiftYm(ym, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line"
          aria-label="다음 달"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* 기록하기 — 예산 세우기(월초) / 정산하기(월말). 달 고르자마자 보이게 맨 위로 (2026-11-17 의견) */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate('/budget', { state: { ym } })}
          className="h-12 flex-1 rounded-btn bg-white text-[14px] font-bold text-ink shadow-card active:bg-line"
        >
          📝 예산 세우기
        </button>
        <button
          onClick={() => navigate('/checkup', { state: { ym, mode: 'settle' } })}
          className="h-12 flex-1 rounded-btn bg-brand text-[14px] font-bold text-white shadow-cta active:bg-brand-dark"
        >
          ✅ {label} 정산하기
        </button>
      </div>

      {/*
        2026-11-24 개편(목업 A): 위엔 남는 돈 + 고정비·변동비·소비 기록 세 칸과 달력,
        나머지(예산 대비·고정비 점검·항목별·비정기)는 아래 한 줄씩 접어 두고 누르면 연다.
        PC는 왼쪽에 요약·달력, 오른쪽에 자세히.
      */}
      <PcColumns
        left={
          <>
            <MonthOverview
              ledger={ledger}
              confessed={confessed}
              logTotal={logTotal}
              logCount={spendLog.length}
              logDetail={
                <div className="space-y-2.5">
                  {personSplit}
                  <button
                    onClick={() => navigate('/confess')}
                    className="h-10 w-full rounded-btn bg-brand/10 text-[13px] font-bold text-brand active:bg-brand/20"
                  >
                    소비 기록 적으러 가기
                  </button>
                </div>
              }
            />

            {/* 오늘의 소비 기록 — 매일 쓰는 입구 */}
            <button
              onClick={() => navigate('/confess')}
              className="flex w-full items-center gap-3 rounded-card bg-white px-4 py-3.5 text-left shadow-card active:bg-line"
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                <Mic size={20} className="text-brand" />
                {!confessedToday && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white" />
                )}
              </span>
              <span className="flex-1">
                <span className="block text-[14.5px] font-bold text-ink">오늘의 소비 기록</span>
                <span className="mt-0.5 block text-[12.5px] text-sub">
                  {/* 다른 달을 보는 중엔 '오늘 기록 끝'이 맞지 않는다 (2026-11-19 점검) */}
                  {ym !== currentYm()
                    ? '오늘 쓴 돈은 여기서 적어요'
                    : confessedToday
                      ? '오늘 기록 끝 ✅ · 더 적을 게 있으면 눌러요'
                      : '오늘 쓴 돈을 말해주세요'}
                </span>
              </span>
              <span className="flex shrink-0 items-center text-[13px] font-bold text-brand">
                기록하기 <ChevronRight size={15} />
              </span>
            </button>

            {/* 집밥 플래너로 바로 (2026-11-26 결영 요청) */}
            <RecipeLink />

            {/* 이번 달 소비 기록 — 달력(기본) / 목록 */}
            <div className="rounded-card bg-card px-5 py-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 text-[15px] font-bold text-ink">
                  {label} 소비 기록
                  <span className="tnum mt-0.5 block text-[12.5px] font-semibold text-sub">
                    {monthLog.length}건 · {formatWon(logTotal)}
                  </span>
                </p>
                <div className="flex shrink-0 gap-0.5 rounded-full bg-bg p-0.5" role="tablist">
                  {(['calendar', 'list'] as const).map((v) => (
                    <button
                      key={v}
                      role="tab"
                      aria-selected={logView === v}
                      onClick={() => setLogView(v)}
                      className={`rounded-full px-3 py-1 text-[12px] font-bold ${
                        logView === v ? 'bg-white text-ink shadow-card' : 'text-sub'
                      }`}
                    >
                      {v === 'list' ? '목록' : '달력'}
                    </button>
                  ))}
                </div>
              </div>
              {/* 남편 · 아내 · 공동 나눠 보기 — 공동 기록이 하나라도 있는 달만 */}
              {monthLog.some((c) => c.shared) && <div className="mt-2.5">{personSplit}</div>}
              {/* 엑셀처럼 거르기 — 칸 이름 옆 ▾ (2026-11-25). 목록은 표 머리줄에, 달력은 위에 한 줄로 */}
              {monthLog.length > 0 && (logView === 'calendar' || logFiltering) && (
                <div className="mt-3 space-y-2">
                  {logView === 'calendar' && (
                    <FilterStrip cols={logCols} state={logF} onChange={setLogF} />
                  )}
                  {logFiltering && <FilterSummary rows={filteredLog} onClear={() => setLogF({})} />}
                </div>
              )}
              <div className="mt-3 space-y-2">
                {logView === 'calendar' && (
                  <div className="pb-1">
                    <MonthCalendar
                      ym={ym}
                      marks={logMarks}
                      selected={logDayIn}
                      onPick={setLogDay}
                      today={todayKey}
                    />
                    <p className="mt-1.5 text-[11.5px] text-cap">
                      − 쓴 돈 · <span className="text-brand">+</span> 들어온 돈 ·{' '}
                      <span className="text-rose-500">♥</span> 무지출 · 날짜를 누르면 그날 기록
                    </p>
                    {logDayIn && (
                      <p className="mt-3 text-[12.5px] font-bold text-sub">
                        {Number(logDayIn.slice(5, 7))}월 {Number(logDayIn.slice(8, 10))}일 기록
                        {shownLog.length === 0 && (
                          <span className="font-medium text-cap"> · 없어요</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
                {logView === 'list' && monthLog.length === 0 && (
                  <p className="py-1 text-[13px] text-sub">{label}엔 아직 소비 기록이 없어요</p>
                )}
                {/* 목록은 엑셀처럼 표로 (2026-11-25 결영 요청: "목록 부분을 엑셀 형식으로") */}
                {logView === 'list' && monthLog.length > 0 && (
                  <ConfessTable
                    rows={monthLog}
                    filter={logF}
                    onFilter={setLogF}
                    showSummary={false}
                    today={todayKey}
                    categories={categories}
                    memberNames={memberNames}
                    profile={profile}
                    onUpdate={updateConfession}
                    onRemove={removeConfession}
                  />
                )}
                {logView === 'calendar' && shownLog.map(logRow)}
              </div>
            </div>
          </>
        }
        right={
          <>
            <h3 className="px-1 pt-1 text-[13px] font-bold text-sub">자세히 보기</h3>

            {fold(
              'budget',
              '예산 대비 지출',
              budget.planned > 0 ? `${Math.round((budget.actual / budget.planned) * 100)}%` : '',
              <BudgetBars
                items={ledger.items}
                confessed={confessed}
                settledMembers={ledger.settledMembers ?? []}
                closed={ledger.closed}
              />,
            )}

            {/* 고정비 점검 — 금액만으론 알 수 없으니 수입 대비로 견줘 본다 (스스로 접히는 카드) */}
            <FixedCostCheck items={ledger.items} closed={ledger.closed} collapsible />

            {fold(
              'items',
              '항목별 내역',
              '',
              <div className="space-y-3">
                {/* 부부 토글 */}
                <div className="flex gap-1 rounded-btn bg-line/60 p-1">
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setMember(t.key)}
                      className={`flex-1 rounded-[10px] py-2 text-[14px] font-semibold transition-colors ${
                        member === t.key ? 'bg-white text-ink shadow-card' : 'text-sub'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {GROUP_ORDER.map((g) => (
                  <SectionList
                    key={g}
                    title={GROUP_LABEL[g]}
                    items={filteredItems.filter((it) => it.group === g)}
                    closed={ledger.closed}
                    goodWhenOver={goodWhenOver(g)}
                    memberNames={memberNames}
                  />
                ))}
              </div>,
            )}

            {/* 비정기 지출 — 경조사·명절처럼 월 예산 밖의 지출을 생긴 그 달에 기록 */}
            <OccasionSection
              items={monthOccasions}
              yearItems={yearOccasions}
              yearTotal={occasionYearTotal}
              defaultDate={occasionDefaultDate}
              onAdd={addOccasion}
              onRemove={removeOccasion}
              onUpdate={updateOccasion}
              open={occasionOpen}
              onOpenChange={setOccasionOpen}
              emptyText={`${label}엔 아직 없어요 · 경조사·명절·자동차 같은 큰돈이 생기면 바로 적어두세요`}
            />

            {/* 결산이 끝난 달이면 성적표 — 정산 화면을 다시 안 열어도 여기서 공유할 수 있게 */}
            {ledger.closed && (
              <MonthlyReportCard data={buildMonthlyCard(ledger, snapshots, profile)} />
            )}

            {/*
              잘못 정산했으면 되돌리기. 기록은 그대로 두고 정산 표시만 푼다.
              혼자 정산한 사람도 취소할 수 있어야 한다.
            */}
            {iSettled && (
              <button
                onClick={() => {
                  const msg = ledger.closed
                    ? '이 달 정산을 취소할까요? 입력한 기록은 그대로 남아요.'
                    : '내 정산을 취소할까요? 입력한 기록은 그대로 남아요.'
                  if (!window.confirm(msg)) return
                  saveLedger({
                    ...ledger,
                    closed: false,
                    // 배우자가 이미 끝냈으면 그건 건드리지 않는다
                    settledMembers: (ledger.settledMembers ?? []).filter((m) => m !== me),
                  })
                }}
                className="w-full py-1 text-center text-[12.5px] font-semibold text-cap active:opacity-60"
              >
                잘못 정산했나요? 정산 취소하기
              </button>
            )}

            {/* 잘못 만들어진 달을 앱에서 치울 수 있게 */}
            {hasAnyRecord && (
              <button
                onClick={() => {
                  const name = formatYmKorean(ym)
                  if (
                    !window.confirm(
                      `${name} 기록을 통째로 지울까요?\n가계부와 자산이 같이 지워지고, 되돌릴 수 없어요.`,
                    )
                  )
                    return
                  removeMonth(ym)
                  setYm(shiftYm(ym, -1))
                }}
                className="w-full py-1 text-center text-[12.5px] font-semibold text-cap active:text-danger"
              >
                {formatYmKorean(ym)} 기록 통째로 지우기
              </button>
            )}
          </>
        }
      />
    </div>
  )
}
