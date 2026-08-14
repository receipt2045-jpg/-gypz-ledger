import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Info } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import { useLedgerStore } from '../lib/store'
import { memberStyle } from '../lib/memberColors'
import { abbreviateKRW, formatComma, formatWon } from '../lib/format'
import {
  RULES,
  YEAREND_SAVE_KEY,
  cardSpentFromConfessions,
  readYearEndInput,
  recommendCard,
  type MemberStatus,
  type YearEndInput as Saved,
} from '../lib/yearEndTax'

/**
 * 연말정산 — 맞벌이 부부의 '누구 카드로 쓸까' 판단.
 * 세무 신고를 대신하지 않는다. 방향만 잡아주고 자세한 건 상담으로 넘긴다.
 */
export default function YearEndTax() {
  const navigate = useNavigate()
  const { profile, confessions } = useLedgerStore()
  const [v, setV] = useState<Saved>(readYearEndInput)

  const names: [string, string] = [profile.member1Name, profile.member2Name]
  const set = (patch: Partial<Saved>) => {
    const next = { ...v, ...patch }
    setV(next)
    localStorage.setItem(YEAREND_SAVE_KEY, JSON.stringify(next))
  }

  // 고백에 카드 주인을 남긴 만큼은 자동으로 더해진다 (직접 입력분과 합산)
  const [fromApp1, fromApp2] = useMemo(
    () => cardSpentFromConfessions(confessions),
    [confessions],
  )
  const spent1 = v.spent1 + fromApp1
  const spent2 = v.spent2 + fromApp2

  const ready = v.gross1 > 0 && v.gross2 > 0
  const advice = useMemo(
    () => recommendCard({ gross: v.gross1, spent: spent1 }, { gross: v.gross2, spent: spent2 }),
    [v.gross1, v.gross2, spent1, spent2],
  )

  const winnerName =
    advice.winner === 1 ? names[0] : advice.winner === 2 ? names[1] : null

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="mx-auto w-full max-w-app">
        {/* 헤더 */}
        <div className="flex items-center gap-1 px-3 pt-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-sub active:bg-line"
            aria-label="뒤로"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold text-ink">연말정산 미리보기</h1>
        </div>

        <div className="space-y-4 px-5 pt-3">
          <p className="text-[13.5px] leading-relaxed text-sub">
            부부의 카드값은 <b className="text-ink">합쳐지지 않아요.</b> 각자 이름으로 계산되기 때문에,
            누구 카드로 쓰는지에 따라 돌려받는 돈이 달라져요.
          </p>

          {/* 입력 */}
          <div className="space-y-3 rounded-card bg-card px-5 py-4 shadow-card">
            <h2 className="text-[15px] font-bold text-ink">두 분의 연봉</h2>
            <p className="-mt-1.5 text-[12px] text-cap">세전 총급여예요. 대략이어도 괜찮아요.</p>
            {([0, 1] as const).map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span
                  className={`w-14 shrink-0 rounded-full px-2 py-1 text-center text-[12px] font-bold ${memberStyle(
                    (i + 1) as 1 | 2,
                    profile,
                  ).badge}`}
                >
                  {names[i]}
                </span>
                <AmountInput
                  className="flex-1"
                  value={i === 0 ? v.gross1 : v.gross2}
                  onChange={(n) => set(i === 0 ? { gross1: n } : { gross2: n })}
                  placeholder="예: 40,000,000"
                />
              </div>
            ))}
          </div>

          {ready && (
            <>
              {/* 올해 쓴 금액 (선택) */}
              <div className="space-y-3 rounded-card bg-card px-5 py-4 shadow-card">
                <h2 className="text-[15px] font-bold text-ink">올해 각자 카드로 쓴 돈</h2>
                <p className="-mt-1.5 text-[12px] text-cap">
                  아직 모르시면 비워두세요. 넣으면 더 정확해져요.
                </p>
                {([0, 1] as const).map((i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span
                      className={`w-14 shrink-0 rounded-full px-2 py-1 text-center text-[12px] font-bold ${memberStyle(
                        (i + 1) as 1 | 2,
                        profile,
                      ).badge}`}
                    >
                      {names[i]}
                    </span>
                    <AmountInput
                      className="flex-1"
                      value={i === 0 ? v.spent1 : v.spent2}
                      onChange={(n) => set(i === 0 ? { spent1: n } : { spent2: n })}
                    />
                  </div>
                ))}
                {fromApp1 + fromApp2 > 0 && (
                  <p className="px-1 text-[12px] leading-relaxed text-cap">
                    여기에 고백으로 쌓인 카드값을 더해서 계산해요 ·{' '}
                    <span className="tnum font-semibold text-sub">
                      {names[0]} {formatComma(fromApp1)}원 · {names[1]} {formatComma(fromApp2)}원
                    </span>
                  </p>
                )}
              </div>

              {/* 결론 */}
              <div className="rounded-card bg-brand px-5 py-5 text-white shadow-cta">
                <p className="text-[13px] font-semibold text-white/80">지금은</p>
                <p className="mt-1 text-[22px] font-extrabold leading-snug">
                  {advice.winner === 'none'
                    ? '카드 혜택 좋은 쪽으로'
                    : advice.winner === 'either'
                      ? '어느 쪽이든 비슷해요'
                      : `${winnerName} 카드로 쓰는 게 유리해요`}
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">{advice.reason}</p>
              </div>

              {/* 각자 상태 */}
              <div className="space-y-3">
                {([advice.a, advice.b] as MemberStatus[]).map((s, i) => (
                  <div key={i} className="rounded-card bg-card px-5 py-4 shadow-card">
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`rounded-full px-2 py-1 text-[12px] font-bold ${memberStyle(
                          (i + 1) as 1 | 2,
                          profile,
                        ).badge}`}
                      >
                        {names[i]}
                      </span>
                      <span className="text-[12px] font-medium text-cap">
                        세율 약 {Math.round(s.rate * 100)}%
                      </span>
                    </div>
                    <Row label="공제가 시작되는 금액" value={formatWon(s.threshold)} />
                    {s.cleared ? (
                      <>
                        <Row label="문턱" value="넘었어요 ✅" good />
                        <Row
                          label="예상 공제액 (신용카드 기준)"
                          value={formatWon(s.estimatedDeduction)}
                        />
                        {s.limitReached && (
                          <p className="mt-2 text-[12.5px] font-medium text-amber-600">
                            공제 한도({abbreviateKRW(s.limit)})를 채웠어요. 더 써도 공제는 안 늘어요.
                          </p>
                        )}
                      </>
                    ) : (
                      <Row label="문턱까지" value={`${formatWon(s.remaining)} 남음`} />
                    )}
                  </div>
                ))}
              </div>

              {/* 원칙 */}
              <div className="space-y-2.5 rounded-card bg-card px-5 py-4 shadow-card">
                <h2 className="text-[15px] font-bold text-ink">알아두면 이득인 것</h2>
                {RULES.map((r) => (
                  <div key={r.title}>
                    <p className="text-[14px] font-semibold text-ink">{r.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-sub">{r.body}</p>
                  </div>
                ))}
              </div>

              {/* 면책 + 다음 단계 */}
              <div className="rounded-card bg-bg px-4 py-3">
                <p className="flex gap-1.5 text-[12px] leading-relaxed text-cap">
                  <Info size={14} className="mt-px shrink-0" />
                  <span>
                    참고용 계산이에요. 부양가족·의료비·연금저축까지 넣으면 결과가 달라질 수 있어요.
                    실제 신고는 국세청 홈택스 자료를 기준으로 하세요.
                  </span>
                </p>
              </div>

              <button
                disabled
                className="h-14 w-full rounded-btn bg-white text-[15px] font-bold text-cap shadow-card"
              >
                우리 집에 맞게 짚어보기 (준비 중)
              </button>
            </>
          )}

          {!ready && (
            <p className="py-6 text-center text-[13px] text-cap">
              두 분의 연봉을 넣으면 바로 알려드려요
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13.5px] text-sub">{label}</span>
      <span className={`tnum text-[14px] font-bold ${good ? 'text-brand' : 'text-ink'}`}>
        {value}
      </span>
    </div>
  )
}
