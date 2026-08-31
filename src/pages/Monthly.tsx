import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import BudgetBars from '../components/BudgetBars'
import FixedCostCheck from '../components/FixedCostCheck'
import InfoTip from '../components/InfoTip'
import MonthlyReportCard from '../components/MonthlyReportCard'
import OccasionSection from '../components/OccasionSection'
import SectionList from '../components/SectionList'
import { useLedgerStore } from '../lib/store'
import { buildMonthlyCard } from '../lib/monthlyCard'
import { activeYm, resolveLedger, summarize } from '../lib/carryover'
import { formatWon, formatYmKorean, shiftYm } from '../lib/format'
import { GROUP_LABEL, GROUP_ORDER, TERM_TIP } from '../lib/constants'
import { monthConfessions } from '../lib/confessLedger'
import { memberStyle } from '../lib/memberColors'
import type { CategoryGroup } from '../types'

type MemberFilter = 0 | 1 | 2 // 0 = 함께

const BANNER_KEY = 'gypz-concept-banner-closed'

export default function Monthly() {
  const navigate = useNavigate()
  const {
    ledgers,
    snapshots,
    profile,
    confessions,
    occasions,
    addOccasion,
    removeOccasion,
    removeConfession,
    memberNo,
    saveLedger,
    removeMonth,
  } = useLedgerStore()
  const [ym, setYm] = useState(() => activeYm(ledgers))
  const [member, setMember] = useState<MemberFilter>(0)
  // 개념 안내 배너 (브리프 P0 1.2) — 닫으면 이 기기에서 다시 안 뜸
  const [showBanner, setShowBanner] = useState(() => !localStorage.getItem(BANNER_KEY))
  const closeBanner = () => {
    localStorage.setItem(BANNER_KEY, '1')
    setShowBanner(false)
  }

  const ledger = resolveLedger(ledgers, ym)
  const memberNames: [string, string] = [profile.member1Name, profile.member2Name]
  // 내가 이 달 정산을 했는지 — 혼자 끝낸 경우에도 되돌릴 수 있어야 한다
  const me = memberNo ?? 1
  const iSettled = ledger.closed || (ledger.settledMembers ?? []).includes(me)
  // 이 달에 실제로 저장된 기록이 있을 때만 '통째로 지우기'를 보여준다
  // (resolveLedger는 없는 달도 이전 달에서 만들어 주므로 원본을 직접 본다)
  const hasAnyRecord =
    ledgers.some((l) => l.ym === ym) || snapshots.some((s) => s.ym === ym)

  const filteredItems =
    member === 0 ? ledger.items : ledger.items.filter((it) => it.member === member)
  const filteredLedger = { ...ledger, items: filteredItems }
  const s = summarize(filteredLedger)

  // 이번 달 고백 내역 (최근 62일만 로드되므로 오래된 달엔 자연히 비어 있음)
  const monthLog = useMemo(() => {
    const list = monthConfessions(confessions, ym)
    return member === 0 ? list : list.filter((c) => c.memberNo === member)
  }, [confessions, ym, member])
  const [logOpen, setLogOpen] = useState(false)
  const logTotal = monthLog.reduce((sum, c) => sum + c.amount, 0)

  // 비정기 지출 — 보는 달 것만 목록에, 합계는 올해 누적 (연간비 감각 유지)
  const monthOccasions = occasions.filter((o) => o.date.startsWith(ym))
  const yearOccasions = occasions.filter((o) => o.date.startsWith(ym.slice(0, 4)))
  const occasionYearTotal = yearOccasions.reduce((a, o) => a + o.amount, 0)
  // 추가 폼 기본 날짜: 보는 달이 이번 달이면 오늘, 아니면 그 달 1일
  const today = new Date().toLocaleDateString('sv-SE')
  const occasionDefaultDate = today.startsWith(ym) ? today : `${ym}-01`
  // 상단 '비정기 지출 입력' 버튼 → 아래 섹션 폼을 열고 그리로 스크롤
  const [occasionOpen, setOccasionOpen] = useState(false)
  const occasionRef = useRef<HTMLDivElement>(null)
  const openOccasionForm = () => {
    setOccasionOpen(true)
    occasionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const goodWhenOver = (g: CategoryGroup) =>
    g === 'income' || g === 'saving' || g === 'investment'

  const tabs: { key: MemberFilter; label: string }[] = [
    { key: 0, label: '함께 보기' },
    { key: 1, label: profile.member1Name },
    { key: 2, label: profile.member2Name },
  ]

  return (
    <div className="animate-fade-up space-y-4">
      {/* 개념 안내 배너 */}
      {showBanner && (
        <div className="flex items-start justify-between gap-3 rounded-card bg-brand/10 px-4 py-3">
          <div>
            <p className="text-[14px] font-bold text-ink">매일 적는 앱이 아니에요 ❗️</p>
            <p className="mt-0.5 text-[13px] text-sub">
              월말에 '정산하기'로 한 번에 정리합니다
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
        <h1 className="min-w-[128px] text-center text-[18px] font-bold text-ink">
          {formatYmKorean(ym)}
        </h1>
        <button
          onClick={() => setYm(shiftYm(ym, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line"
          aria-label="다음 달"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {!ledger.closed && (
        <p className="-mt-1 text-center text-[12px] font-medium text-cap">
          아직 정산 전이에요 · 계획 금액 기준
        </p>
      )}

      {/* 기록하기 — 예산 세우기(월초) / 정산하기(월말) */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate('/checkup', { state: { ym, mode: 'budget' } })}
          className="h-12 flex-1 rounded-btn bg-white text-[14px] font-bold text-ink shadow-card active:bg-line"
        >
          📝 예산 세우기
        </button>
        <button
          onClick={() => navigate('/checkup', { state: { ym, mode: 'settle' } })}
          className="h-12 flex-1 rounded-btn bg-brand text-[14px] font-bold text-white shadow-cta active:bg-brand-dark"
        >
          ✅ {formatYmKorean(ym).split(' ')[1]} 정산하기
        </button>
      </div>

      {/* 비정기 지출 바로 적기 — 경조사·명절은 월말 정산까지 기다리면 잊어버린다 */}
      <button
        onClick={openOccasionForm}
        className="h-11 w-full rounded-btn bg-white text-[13.5px] font-semibold text-sub shadow-card active:bg-line"
      >
        🧾 비정기 지출 입력 · 경조사, 명절, 자동차 같은 큰돈
      </button>

      {/* 결산이 끝난 달이면 성적표 — 정산 화면을 다시 안 열어도 여기서 공유할 수 있게 */}
      {ledger.closed && <MonthlyReportCard data={buildMonthlyCard(ledger, snapshots, profile)} />}

      {/*
        잘못 정산했으면 되돌리기. 기록은 그대로 두고 정산 표시만 푼다.
        예전엔 closed(부부 둘 다 완료)일 때만 보여서, 혼자 정산한 사람은
        취소할 방법이 없었다 — 정작 되돌리고 싶은 게 그 경우다.
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

      {/*
        잘못 만들어진 달을 앱에서 치울 수 있게. 예전엔 방법이 없어서
        운영자가 DB에서 지워야 했다 (미래 달이 저절로 생기는 문제도 있었다).
      */}
      {hasAnyRecord && (
        <button
          onClick={() => {
            const label = formatYmKorean(ym)
            if (
              !window.confirm(
                `${label} 기록을 통째로 지울까요?\n가계부와 자산이 같이 지워지고, 되돌릴 수 없어요.`,
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

      {/* 고정비 점검 — 금액만으론 알 수 없으니 수입 대비로 견줘 본다 (가구 전체 기준) */}
      <FixedCostCheck items={ledger.items} closed={ledger.closed} />

      {/* 예산 대비 지출 */}
      <div className="rounded-card bg-card px-5 py-4 shadow-card">
        <h3 className="mb-3 text-[15px] font-bold text-ink">예산 대비 지출</h3>
        <BudgetBars items={ledger.items} />
      </div>

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

      {/* 이번 달 고백 내역 — 매일 기록한 것이 여기 쌓인다 */}
      {monthLog.length > 0 && (
        <div className="rounded-card bg-card px-5 py-4 shadow-card">
          <button onClick={() => setLogOpen((v) => !v)} className="flex w-full items-center justify-between">
            <span className="text-[15px] font-bold text-ink">
              🎙️ 이번 달 고백 <span className="text-sub">{monthLog.length}건</span>
            </span>
            <span className="tnum text-[15px] font-bold text-ink">{formatWon(logTotal)}</span>
          </button>
          {logOpen && (
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              {monthLog.map((c) => {
                const d = new Date(c.createdAt)
                const style = memberStyle(c.memberNo, profile)
                return (
                  <div key={c.id} className="flex items-center gap-2.5">
                    <span className="tnum w-10 shrink-0 text-[12px] text-cap">
                      {d.getMonth() + 1}/{d.getDate()}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${style.badge}`}
                    >
                      {memberNames[c.memberNo - 1]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                      {c.category}
                      {c.note && <span className="text-cap"> · {c.note}</span>}
                    </span>
                    <span className="tnum shrink-0 text-[13.5px] font-bold text-ink">
                      {formatWon(c.amount)}
                    </span>
                    {/* 잘못 쓴 고백은 지우고 다시 — 배우자 몫을 대신 적을 수 있으니 대신 지울 수도 있다 */}
                    <button
                      onClick={() => removeConfession(c.id)}
                      className="shrink-0 text-cap active:text-danger"
                      aria-label="고백 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
              <p className="pt-1 text-[12px] leading-relaxed text-cap">
                잘못 쓴 건 지우고 다시 적으면 돼요 · 정산할 때 카테고리별 합계를 한 번에 넣을 수
                있어요
              </p>
            </div>
          )}
        </div>
      )}

      {/* 섹션별 리스트 */}
      <div className="space-y-3">
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
      </div>

      {/* 비정기 지출 — 경조사·명절처럼 월 예산 밖의 지출을 생긴 그 달에 기록 */}
      <div ref={occasionRef} className="scroll-mt-4">
        <OccasionSection
          items={monthOccasions}
          yearItems={yearOccasions}
          yearTotal={occasionYearTotal}
          defaultDate={occasionDefaultDate}
          onAdd={addOccasion}
          onRemove={removeOccasion}
          open={occasionOpen}
          onOpenChange={setOccasionOpen}
          emptyText={`${formatYmKorean(ym).split(' ')[1]}엔 아직 없어요 · 경조사·명절·자동차 같은 큰돈이 생기면 바로 적어두세요`}
        />
      </div>

      {/* 잉여현금 */}
      <div className="rounded-card bg-ink px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <span className="flex items-center text-[15px] font-semibold text-white/80">
            잉여현금
            <InfoTip text={TERM_TIP.surplus} />
          </span>
          <span className={`tnum text-[20px] font-extrabold ${s.surplus < 0 ? 'text-[#FF8A93]' : 'text-white'}`}>
            {formatWon(s.surplus)}
          </span>
        </div>
        <p className="mt-1 text-[12px] text-white/55">
          수입 − 저축 − 투자 − 지출 기준
        </p>
      </div>
    </div>
  )
}
