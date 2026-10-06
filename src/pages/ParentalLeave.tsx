import SiteFooter from '../components/SiteFooter'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronDown, ChevronLeft, Download, Share2, X } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import Card from '../components/Card'
import {
  DEFAULT_INPUT,
  LEAVE_SAVE_KEY,
  MONTH_OPTIONS,
  MONTHS_MAX,
  RULES,
  onLeave,
  readLeaveInput,
  simulate,
  type DaycareFrom,
  type EarnerState,
  type LeaveInput,
  type LeaveMonth,
  type LeaveRun,
  type Order,
  type Who,
} from '../lib/parentalLeave'
import { encodeLeave, shareLeaveLink, sharedFromHash } from '../lib/leaveShare'
import { leaveCardFile } from '../lib/leaveCard'
import { leaveNumbersFromLedgers, type LedgerNumbers } from '../lib/leaveFromLedger'
import { useLedgerStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { fetchHouseholdData, getMyMembership } from '../lib/db'
import { formatMonthKorean } from '../lib/format'
import type { MonthlyLedger } from '../types'

const ONETEAM_URL = 'https://oneteamm.netlify.app'

/** 원 → "160" (만원 단위, 반올림). 부호는 붙이지 않는다 */
const man = (n: number) => Math.round(Math.abs(n) / 10_000).toLocaleString('ko-KR')

/**
 * 육아휴직 하면 우리 집은 어떻게 될까 — 로그인 없이 열리는 공개 계산기.
 * 영상·SNS에서 바로 들어오는 자리라 가입을 요구하지 않는다.
 * 위에서부터: 한 줄 결론 + 구간 칸 → 우리집 숫자로 바꿔보라는 안내 → 달마다 막대 → (접힌) 자세히 보기 →
 * 우리집 숫자 → 고치기 → 원팀프로젝트.
 */
export default function ParentalLeave() {
  // 남편·아내가 보낸 링크(#/leave?s=...)로 들어오면 그 숫자로 연다
  const [fromShare] = useState(() => sharedFromHash(window.location.hash))
  const [v, setV] = useState<LeaveInput>(() => fromShare ?? readLeaveInput())
  const [openAdjust, setOpenAdjust] = useState(false)

  const set = (patch: Partial<LeaveInput>) => {
    const next = { ...v, ...patch }
    setV(next)
    try {
      localStorage.setItem(LEAVE_SAVE_KEY, JSON.stringify(next))
    } catch {
      /* 시크릿 모드에서는 저장하지 않는다 */
    }
  }

  const r = useMemo(() => simulate(v), [v])
  const both = v.who === 'both'

  return (
    <div className="flex min-h-screen justify-center bg-bg">
      <div className="w-full max-w-app px-5 pb-16 pt-6 lg:max-w-[1040px] lg:px-10">
        {/* PC: 왼쪽 결과, 오른쪽 우리집 숫자·고치기·나누기 (2026-10-06). 폰은 그대로 한 줄 */}
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
          <div className="min-w-0">
            {/* ── 한 줄 결론 */}
            <BackToApp />
            {/* 이미 가계부를 쓰는 사람 — 내 숫자로 한 번에 채운다 */}
            <LedgerImport input={v} onApply={(patch) => set(patch)} />

            <header className="px-1 pt-2">
              <h1 className="text-[23px] font-bold leading-[1.6] text-ink">
                {r.monthlyNow >= 0 ? (
                  <>
                    매달 <Blank>{man(r.monthlyNow)}</Blank>만원 모으던 우리집,
                  </>
                ) : (
                  <>
                    지금도 매달 <Blank>{man(r.monthlyNow)}</Blank>만원 적자인 우리집,
                  </>
                )}
                <br />
                육아휴직하면 한 달에 <span aria-hidden>🍼</span>
              </h1>
            </header>

            <RunBoxes runs={r.runs} showWho={both} />
            {/* 처음 온 사람은 위 숫자가 예시라는 걸 모른다 — 어디를 고치면 되는지 바로 알려준다 */}
            <button
              onClick={() =>
                document
                  .getElementById('our-numbers')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-btn bg-white py-3 text-[14px] font-bold text-brand"
            >
              우리집 숫자로 바꿔보세요
              <ChevronDown size={17} />
            </button>
            <MonthBars months={r.months} now={r.monthlyNow} />
            <CalcTable runs={r.runs} />
          </div>
          <div className="min-w-0 lg:[&>*:first-child]:mt-0">
            {/* ── 우리집 숫자 */}
            <div id="our-numbers" className="mt-4 scroll-mt-4">
              <Card>
                <p className="text-[15px] font-bold text-ink">우리집 숫자로 바꿔보세요</p>
                <p className="mt-1 text-[12.5px] text-cap">
                  {encodeLeave(v) === encodeLeave(DEFAULT_INPUT)
                    ? '지금 보이는 건 예시 숫자예요. 바꾸면 위 결과가 바로 달라져요.'
                    : fromShare
                      ? '공유받은 숫자로 계산했어요. 바꾸면 위 결과가 바로 달라져요.'
                      : '바꾸면 위 결과가 바로 달라져요.'}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label="아내 월 실수령">
                    <AmountInput value={v.payWife} onChange={(n) => set({ payWife: n })} />
                  </Field>
                  <Field label="남편 월 실수령">
                    <AmountInput value={v.payHusband} onChange={(n) => set({ payHusband: n })} />
                  </Field>
                  <Field label="월 고정비">
                    <AmountInput value={v.fixed} onChange={(n) => set({ fixed: n })} />
                  </Field>
                  <Field label="월 변동비">
                    <AmountInput value={v.variable} onChange={(n) => set({ variable: n })} />
                  </Field>
                </div>

                <p className="mb-1.5 mt-4 text-[13.5px] font-medium text-sub">누가 쉬어요?</p>
                <Segment<Who>
                  value={v.who}
                  onChange={(who) => set({ who })}
                  options={[
                    ['wife', '아내'],
                    ['husband', '남편'],
                    ['both', '둘 다'],
                  ]}
                />
              </Card>
            </div>

            {/* ── 고치기 */}
            <Card className="mt-4">
              <button
                onClick={() => setOpenAdjust((o) => !o)}
                className="flex w-full items-center justify-between"
                aria-expanded={openAdjust}
              >
                <span className="text-[15px] font-bold text-ink">우리집에 맞게 고치기</span>
                <ChevronDown
                  size={18}
                  className={`text-cap transition-transform ${openAdjust ? 'rotate-180' : ''}`}
                />
              </button>

              {openAdjust && (
                <div className="mt-4 space-y-4">
                  {v.who !== 'husband' && (
                    <PersonLeave
                      name="아내"
                      months={v.monthsWife}
                      insured={v.insuredWife}
                      side={v.sideWife}
                      paidLimit={r.paidLimit}
                      onChange={(p) =>
                        set({
                          ...(p.months !== undefined && { monthsWife: p.months }),
                          ...(p.insured !== undefined && {
                            insuredWife: p.insured,
                          }),
                          ...(p.side !== undefined && { sideWife: p.side }),
                        })
                      }
                    />
                  )}
                  {v.who !== 'wife' && (
                    <PersonLeave
                      name="남편"
                      months={v.monthsHusband}
                      insured={v.insuredHusband}
                      side={v.sideHusband}
                      paidLimit={r.paidLimit}
                      onChange={(p) =>
                        set({
                          ...(p.months !== undefined && {
                            monthsHusband: p.months,
                          }),
                          ...(p.insured !== undefined && {
                            insuredHusband: p.insured,
                          }),
                          ...(p.side !== undefined && { sideHusband: p.side }),
                        })
                      }
                    />
                  )}
                  <Note>
                    {r.paidLimit === 18
                      ? '둘 다 3개월 이상 육아휴직을 쓰면 한 사람당 18개월까지 급여가 나와요. 13개월째부터도 월급의 80%, 최대 160만원이에요.'
                      : both
                        ? '한 사람이 급여를 못 받으면 다른 사람도 12개월까지만 급여가 나와요.'
                        : '한 명만 쉬면 12개월까지 급여가 나와요. 둘 다 3개월 이상 쉬면 한 사람당 18개월까지 늘어나요.'}
                  </Note>
                  {both && (
                    <Field label="어떻게 쉬어요?">
                      <Segment<Order>
                        value={v.order}
                        onChange={(order) => set({ order })}
                        options={[
                          ['seq', '번갈아 (아내 먼저)'],
                          ['sim', '같이'],
                        ]}
                      />
                      <Note>
                        둘 다 쉬면 각자 첫 6개월은 급여 상한이 250만원에서 450만원까지 올라가요.
                        아이가 태어난 지 18개월 안에 둘 다 휴직을 시작할 때만이에요.
                      </Note>
                    </Field>
                  )}

                  <Field label="늘어나는 양육비 (월)">
                    <AmountInput value={v.childCost} onChange={(childCost) => set({ childCost })} />
                    <Note>영유아 키우는 집 평균 150만원이에요. 우리집 예상으로 바꿔도 돼요.</Note>
                  </Field>

                  <Field label="어린이집은 언제부터?">
                    <Segment<DaycareFrom>
                      value={v.daycareFrom}
                      onChange={(daycareFrom) => set({ daycareFrom })}
                      options={[
                        [0, '안 보내요'],
                        [7, '7개월부터'],
                        [13, '돌 지나서'],
                      ]}
                    />
                    <Note>어린이집에 다니는 달엔 부모급여가 보육료만큼 줄어요.</Note>
                  </Field>
                </div>
              )}
            </Card>

            {/* ── 나누기 */}
            <ShareBox input={v} result={r} showWho={both} />

            {/* ── 원팀프로젝트 */}
            <div className="mt-5 rounded-card border-[1.5px] border-brand bg-white p-5">
              <p className="text-[12px] font-bold text-brand">결영이네 원팀프로젝트</p>
              <p className="mt-1 text-[18px] font-bold leading-snug text-ink">
                적자 나는 달, 없도록 미리 공부해요.
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-sub">
                <b className="font-bold text-ink">부부가 함께</b> 재테크 시작하면 돈 모으는 속도가
                빨라져요.
              </p>
              <a
                href={ONETEAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white"
              >
                원팀프로젝트 보러가기
                <ArrowRight size={17} />
              </a>
            </div>
            <p className="mt-3 text-center text-[12.5px] text-cap">
              가계부부터 써보고 싶다면{' '}
              <a href="#/" className="font-semibold text-brand">
                모아불리 시작하기
              </a>
            </p>

            {/* ── 출처 */}
            <div className="mt-8 px-1 text-[12px] leading-relaxed text-cap">
              <p className="font-semibold text-sub">이 숫자는 어디서 왔나요</p>
              <ul className="mt-1.5 space-y-1">
                <li>
                  · 육아휴직 기간 — 한 명만 쉬면 12개월, 부부가 각자 3개월 이상 쉬면 한 사람당
                  18개월
                </li>
                <li>
                  · 육아휴직급여 — 한 명만 쉬면 1~3개월 최대 250만원, 4~6개월 최대 200만원,
                  7개월부터 월급의 80% 최대 160만원. 부부가 둘 다 쉬면 각자 첫 6개월 최대
                  250·250·300·350·400·450만원. 최소 70만원. 고용노동부 고용보험
                </li>
                <li>
                  · 부모급여 — 만 0세 월 100만원, 만 1세 월 50만원. 어린이집에 다니면 보육료를 빼고
                  0세는 41.6만원, 1세는 0원. 두 돌 뒤 집에서 보면 가정양육수당 월 10만원. 아동수당
                  월 10만원. 보건복지부
                </li>
                <li>
                  · 양육비 — 육아정책연구소 KICCE 소비실태조사 2025, 2024년 가구당 양육비용 월
                  149.8만원. 집 안 모든 자녀에게 든 돈의 합이에요
                </li>
                <li>· 기준일 {RULES.updated}</li>
              </ul>
              <p className="mt-3">
                아이가 태어나자마자 휴직을 시작하고, 고정비·변동비는 지금 그대로 쓴다고 봤어요.
                급여는 세전 월급(통상임금) 기준이라 실수령으로 넣으면 실제로는 같거나 조금 더
                받아요. 방향을 보는 용도로만 쓰시고, 정확한 금액은 고용보험에서 확인하세요.
              </p>
            </div>
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  )
}

/**
 * 로그인한 사람의 가계부 숫자. 계산기는 로그인 밖 화면이라,
 * 앱 안에서 넘어왔으면 이미 불러온 가계부를 쓰고, 링크로 바로 열었으면 로그인돼 있을 때만 따로 읽는다.
 */
function useMyLedgers(): MonthlyLedger[] | null {
  const storeLedgers = useLedgerStore((st) => (st.status === 'ready' ? st.ledgers : null))
  const [fetched, setFetched] = useState<MonthlyLedger[] | null>(null)
  useEffect(() => {
    if (storeLedgers) return
    let live = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return
      const m = await getMyMembership()
      if (!m) return
      const hh = await fetchHouseholdData(m.householdId)
      if (live) setFetched(hh.ledgers)
    })().catch(() => {
      /* 못 읽으면 카드를 띄우지 않는다 — 계산기는 그대로 쓸 수 있다 */
    })
    return () => {
      live = false
    }
  }, [storeLedgers])
  return storeLedgers ?? fetched
}

const manLabel = (n: number) => `${Math.round(n / 10_000).toLocaleString('ko-KR')}만`

/** 앱 안(정보 탭·홈 알림)에서 들어왔으면 돌아갈 길 — 이 화면엔 탭 바가 없다 */
function BackToApp() {
  const inApp = useLedgerStore((st) => st.status === 'ready')
  if (!inApp) return null
  return (
    <button
      onClick={() => window.history.back()}
      className="-ml-1 mb-3 flex items-center gap-0.5 text-[14px] font-semibold text-sub"
    >
      <ChevronLeft size={19} />
      가계부로 돌아가기
    </button>
  )
}

/** 내 가계부 숫자로 계산하기 — 누르기 전엔 아무것도 바꾸지 않는다 */
function LedgerImport({
  input,
  onApply,
}: {
  input: LeaveInput
  onApply: (patch: Partial<LeaveInput>) => void
}) {
  const ledgers = useMyLedgers()
  const nums: LedgerNumbers | null = useMemo(
    () => (ledgers ? leaveNumbersFromLedgers(ledgers) : null),
    [ledgers],
  )
  const [before, setBefore] = useState<Partial<LeaveInput> | null>(null)
  if (!nums) return null

  const month = formatMonthKorean(nums.ym)
  const basis = nums.closed ? `${month} 정산 기준` : `${month} 예산 기준`

  if (before) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-card bg-white px-4 py-3">
        <Check size={17} className="shrink-0 text-emerald-600" />
        <span className="flex-1 text-[13.5px] font-medium text-ink">
          {month} 가계부 숫자로 계산했어요
        </span>
        <button
          onClick={() => {
            onApply(before)
            setBefore(null)
          }}
          className="shrink-0 text-[12.5px] font-bold text-brand"
        >
          되돌리기
        </button>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-card bg-brand/10 p-4">
      <p className="text-[14.5px] font-bold text-brand">📒 내 가계부 숫자로 계산할까요?</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-brand">
        {basis} · 아내 {manLabel(nums.payWife)} · 남편 {manLabel(nums.payHusband)}
        <br />
        고정비 {manLabel(nums.fixed)} · 변동비 {manLabel(nums.variable)}
      </p>
      <button
        onClick={() => {
          setBefore({
            payWife: input.payWife,
            payHusband: input.payHusband,
            fixed: input.fixed,
            variable: input.variable,
          })
          onApply({
            payWife: nums.payWife,
            payHusband: nums.payHusband,
            fixed: nums.fixed,
            variable: nums.variable,
          })
        }}
        className="mt-3 w-full rounded-btn bg-brand py-3 text-[14px] font-bold text-white"
      >
        내 가계부 숫자로 계산하기
      </button>
    </div>
  )
}

/** 남편한테 링크로 보내기 · 결과를 이미지로 저장하기 */
function ShareBox({
  input,
  result,
  showWho,
}: {
  input: LeaveInput
  result: ReturnType<typeof simulate>
  showWho: boolean
}) {
  const [msg, setMsg] = useState<string | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const onShare = async () => {
    const res = await shareLeaveLink(input)
    setMsg(
      res === 'copied'
        ? '링크를 복사했어요. 카톡에 붙여넣어 보내세요.'
        : res === 'failed'
          ? '공유가 안 되는 브라우저예요. 주소창의 링크를 복사해 보내주세요.'
          : null,
    )
  }

  const onImage = async () => {
    setBusy(true)
    const file = await leaveCardFile(result, showWho)
    setBusy(false)
    if (!file) setMsg('이 브라우저에서는 이미지를 만들 수 없어요.')
    else setImage(file)
  }

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <button
          onClick={onShare}
          className="flex items-center justify-center gap-1.5 rounded-btn bg-white py-3.5 text-[14.5px] font-bold text-ink"
        >
          <Share2 size={17} className="text-brand" />
          남편한테 공유하기
        </button>
        <button
          onClick={onImage}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 rounded-btn bg-white py-3.5 text-[14.5px] font-bold text-ink disabled:opacity-60"
        >
          <Download size={17} className="text-brand" />
          이미지로 저장하기
        </button>
      </div>
      {msg && <p className="mt-2 text-center text-[12.5px] text-sub">{msg}</p>}
      {image && <ImageSheet file={image} onClose={() => setImage(null)} />}
    </>
  )
}

/** 만든 이미지를 보여주고 저장 — 카톡 안 브라우저처럼 다운로드가 막힌 곳은 길게 눌러 저장 */
function ImageSheet({ file, onClose }: { file: File; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const canShareFile =
    typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  const onSave = async () => {
    if (canShareFile) {
      try {
        await navigator.share({ files: [file], title: '모아불리 육아휴직 계산' })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="이미지로 저장하기"
    >
      <div
        className="w-full max-w-app rounded-t-card bg-white p-5 pb-8 sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-bold text-ink">이미지로 저장하기</p>
          <button onClick={onClose} aria-label="닫기" className="text-cap">
            <X size={20} />
          </button>
        </div>
        {url && (
          <img
            src={url}
            alt="육아휴직 계산 결과 이미지"
            className="mt-3 w-full rounded-btn border border-line"
          />
        )}
        <button
          onClick={onSave}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white"
        >
          <Download size={17} />
          {canShareFile ? '사진에 저장하거나 보내기' : '이미지 저장하기'}
        </button>
        <p className="mt-2 text-center text-[12px] text-cap">
          저장이 안 되면 이미지를 길게 눌러 저장하세요.
        </p>
      </div>
    </div>
  )
}

function Blank({ children }: { children: React.ReactNode }) {
  return <span className="tnum mx-0.5 inline-block rounded-lg bg-white px-2">{children}</span>
}

/** 같은 숫자가 이어지는 달을 한 칸씩 — 모여요 / 적자예요 */
function RunBoxes({ runs, showWho }: { runs: LeaveRun[]; showWho: boolean }) {
  if (runs.length === 0) return null
  return (
    <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {runs.map((run) => {
        const deficit = run.month.saved < 0
        const tone = deficit ? 'text-danger' : 'text-brand'
        return (
          <div
            key={run.from}
            className={`min-w-[78px] flex-1 rounded-[12px] px-1 py-2.5 text-center ${
              deficit ? 'bg-danger/10' : 'bg-brand/10'
            }`}
          >
            <p className={`text-[11.5px] font-medium ${tone}`}>{periodLabel(run)}</p>
            <p className={`tnum mt-0.5 text-[18px] font-bold leading-tight ${tone}`}>
              {deficit ? '−' : ''}
              {man(run.month.saved)}만
            </p>
            <p className={`mt-0.5 text-[11.5px] ${tone}`}>{deficit ? '적자예요' : '모여요'}</p>
            {showWho && <p className={`mt-1 text-[11px] ${tone}`}>{whoLabel(run.month)}</p>}
          </div>
        )
      })}
    </div>
  )
}

const periodLabel = (run: LeaveRun) =>
  run.from === run.to ? `${run.from}개월` : `${run.from}~${run.to}개월`

function whoLabel(m: LeaveMonth): string {
  const w = onLeave(m.wifeState)
  const h = onLeave(m.husbandState)
  if (w && h) return '둘 다 휴직'
  return w ? '아내 휴직' : '남편 휴직'
}

/** 달마다 막대 — 회색은 지금 모으는 돈, 파랑은 휴직 중 모이는 돈, 빨강은 적자 */
function MonthBars({ months, now }: { months: LeaveMonth[]; now: number }) {
  if (months.length === 0) return null
  const W = 340
  const values = months.map((m) => m.saved)
  const top = Math.max(now, ...values, 1)
  const bottom = Math.min(0, now, ...values)
  const H = 130
  const scale = H / (top - bottom)
  const zeroY = 10 + top * scale
  const slot = W / months.length
  const bw = Math.min(20, slot * 0.65)
  const nowH = Math.max(now, 0) * scale

  return (
    <Card className="mt-4">
      <svg
        viewBox={`0 0 ${W} 170`}
        className="block w-full"
        role="img"
        aria-label="달마다 모이는 돈"
      >
        {months.map((m, i) => {
          const x = i * slot + (slot - bw) / 2
          const h = Math.abs(m.saved) * scale
          const tick = i === 0 || (i + 1) % 6 === 0
          return (
            <g key={m.t}>
              <rect
                x={x}
                y={zeroY - nowH}
                width={bw}
                height={nowH}
                rx={2.5}
                className="fill-[#D1D6DB]"
              />
              {m.saved >= 0 ? (
                <rect x={x} y={zeroY - h} width={bw} height={h} rx={2.5} className="fill-brand" />
              ) : (
                <rect x={x} y={zeroY} width={bw} height={h} rx={2.5} className="fill-danger" />
              )}
              {tick && (
                <text
                  x={Math.max(20, Math.min(x + bw / 2, W - 20))}
                  y={166}
                  textAnchor="middle"
                  className="fill-cap text-[11px]"
                >
                  {m.t}개월
                </text>
              )}
            </g>
          )
        })}
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} className="stroke-line" strokeWidth={1} />
      </svg>
      <div className="mt-1.5 flex justify-center gap-4 text-[12px] text-sub">
        <Legend className="bg-[#D1D6DB]" label="지금" />
        <Legend className="bg-brand" label="육아휴직하면" />
        {values.some((x) => x < 0) && <Legend className="bg-danger" label="적자" />}
      </div>
    </Card>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  )
}

/** 한 달에 들어오고 나가는 돈 — 평균 없이 칸마다 실제 금액 */
function CalcTable({ runs }: { runs: LeaveRun[] }) {
  const [open, setOpen] = useState(false)
  if (runs.length === 0) return null
  const cell = 'tnum px-1.5 py-1 text-right'
  const earner = (amount: number, state: EarnerState) => (
    <span className={state === 'paid' ? 'text-brand' : state === 'work' ? '' : 'text-danger'}>
      {man(amount)}
      {state !== 'work' && (
        <span className="block text-[10.5px] leading-tight">{STATE_TAG[state]}</span>
      )}
    </span>
  )
  return (
    <Card className="mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
        aria-expanded={open}
      >
        <span className="text-[15px] font-bold text-ink">자세히 보기</span>
        <ChevronDown
          size={18}
          className={`text-cap transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <>
          <div className="-mx-1 mt-2 overflow-x-auto">
            <table className="w-full min-w-max text-[12.5px] text-sub">
              <thead>
                <tr className="text-[11.5px] text-cap">
                  <th className="py-1 pl-1 text-left font-medium">만원</th>
                  {runs.map((run) => (
                    <th key={run.from} className="px-1.5 py-1 text-right font-medium">
                      {periodLabel(run)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <GroupRow label="들어오는 돈" span={runs.length} />
                <tr>
                  <td className="py-1 pl-1">아내</td>
                  {runs.map((run) => (
                    <td key={run.from} className={cell}>
                      {earner(run.month.wife, run.month.wifeState)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1 pl-1">남편</td>
                  {runs.map((run) => (
                    <td key={run.from} className={cell}>
                      {earner(run.month.husband, run.month.husbandState)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1 pl-1">부모급여·수당</td>
                  {runs.map((run) => (
                    <td key={run.from} className={cell}>
                      {man(run.month.gov)}
                    </td>
                  ))}
                </tr>
                <GroupRow label="나가는 돈" span={runs.length} />
                <tr>
                  <td className="py-1 pl-1">고정비·변동비</td>
                  {runs.map((run) => (
                    <td key={run.from} className={cell}>
                      {man(run.month.spend)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1 pl-1">늘어나는 양육비</td>
                  {runs.map((run) => (
                    <td key={run.from} className={cell}>
                      {man(run.month.childCost)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-line">
                  <td className="py-1.5 pl-1 font-bold text-ink">모이는 돈</td>
                  {runs.map((run) => {
                    const deficit = run.month.saved < 0
                    return (
                      <td
                        key={run.from}
                        className={`${cell} py-1.5 font-bold ${deficit ? 'text-danger' : 'text-brand'}`}
                      >
                        {deficit ? '−' : ''}
                        {man(run.month.saved)}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <Note>
            육아휴직급여는 한 명만 쉬면 첫 3개월 최대 250만, 4~6개월 200만, 이후 월급의 80% 최대
            160만원이에요. 부모급여는 만 0세 100만원, 돌 지나면 50만원이고 두 돌 뒤엔 집에서 보면
            양육수당 10만원이에요. 아동수당 10만원을 더했어요.
          </Note>
        </>
      )}
    </Card>
  )
}

function GroupRow({ label, span }: { label: string; span: number }) {
  return (
    <tr>
      <td colSpan={span + 1} className="pb-0.5 pl-1 pt-2.5 text-[11.5px] text-cap">
        {label}
      </td>
    </tr>
  )
}

function Segment<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  return (
    <div className="flex gap-2">
      {options.map(([key, label]) => (
        <button
          key={String(key)}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`flex-1 rounded-btn border py-2.5 text-[13.5px] font-semibold ${
            value === key ? 'border-brand bg-brand/5 text-brand' : 'border-line bg-white text-sub'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const STATE_TAG: Record<Exclude<EarnerState, 'work'>, string> = {
  paid: '휴직급여',
  unpaid: '무급',
  side: '쉬는 중',
}

/** 한 사람의 휴직 — 기간, 급여를 받을 수 있나, 못 받으면 쉬는 동안 버는 돈 */
function PersonLeave({
  name,
  months,
  insured,
  side,
  paidLimit,
  onChange,
}: {
  name: string
  months: number
  insured: boolean
  side: number
  paidLimit: number
  onChange: (p: { months?: number; insured?: boolean; side?: number }) => void
}) {
  return (
    <div className="space-y-3 rounded-btn bg-bg p-3.5">
      <Field label={`${name} 휴직 기간 (개월)`}>
        <MonthPicker value={months} onChange={(m) => onChange({ months: m })} />
        {insured && months > paidLimit && (
          <Note>
            {paidLimit + 1 === months
              ? `${months}개월째는 무급이에요.`
              : `${paidLimit + 1}~${months}개월째는 무급이에요.`}
          </Note>
        )}
      </Field>
      <Field label={`${name} 육아휴직급여`}>
        <Segment<'yes' | 'no'>
          value={insured ? 'yes' : 'no'}
          onChange={(x) => onChange({ insured: x === 'yes' })}
          options={[
            ['yes', '받아요'],
            ['no', '못 받아요'],
          ]}
        />
        <Note>프리랜서·자영업자이거나 고용보험 가입이 180일이 안 되면 못 받아요.</Note>
      </Field>
      {!insured && (
        <Field label="쉬는 동안 버는 돈 (월)">
          <AmountInput value={side} onChange={(n) => onChange({ side: n })} />
          <Note>쉬면서도 조금씩 일하면 적어 주세요. 없으면 0원으로 둬요.</Note>
        </Field>
      )}
    </div>
  )
}

/** 3 · 6 · 12 · 18 · 24~ (개월) — 마지막을 고르면 −/+로 개월 수를 고른다 */
function MonthPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const long = value >= 24
  return (
    <>
      <div className="flex gap-1.5">
        {MONTH_OPTIONS.map((m) => {
          const on = m === 24 ? long : value === m
          return (
            <button
              key={m}
              onClick={() => onChange(m)}
              aria-pressed={on}
              aria-label={m === 24 ? '24개월 이상' : `${m}개월`}
              className={`flex-1 whitespace-nowrap rounded-btn border py-2.5 text-[14px] font-semibold ${
                on ? 'border-brand bg-brand/5 text-brand' : 'border-line bg-white text-sub'
              }`}
            >
              {m === 24 ? '24~' : m}
            </button>
          )
        })}
      </div>
      {long && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <StepButton
            label="한 달 줄이기"
            disabled={value <= 24}
            onClick={() => onChange(value - 1)}
          >
            −
          </StepButton>
          <span className="tnum w-16 text-center text-[16px] font-bold text-ink">{value}개월</span>
          <StepButton
            label="한 달 늘리기"
            disabled={value >= MONTHS_MAX}
            onClick={() => onChange(value + 1)}
          >
            +
          </StepButton>
        </div>
      )}
    </>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-9 w-9 rounded-full border border-line bg-white text-[18px] font-bold text-sub disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[13.5px] font-medium text-sub">{label}</p>
      {children}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[12px] leading-relaxed text-cap">{children}</p>
}
