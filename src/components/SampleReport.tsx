import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * 예시 리포트 — 신청 전에 "3만원 내면 뭘 받는지" 보여주는 것.
 *
 * 가상의 부부(민준·다은)지만 숫자는 전부 서로 맞아떨어지게 계산해 뒀다.
 * (저축률 18% = 105/583, 목표까지 24년 = 3.06억 ÷ 연 1,260만)
 * 실제 리포트 생성기(buildReportDraft)와 같은 섹션 구성을 쓴다 —
 * 예시와 실물이 다르게 생기면 안 되니까.
 */

const H = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-1.5 mt-5 text-[14px] font-extrabold text-ink">{children}</h3>
)

export default function SampleReport() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-bold text-ink">실제로 이렇게 받아요</span>
          <span className="rounded-full bg-line px-2 py-0.5 text-[10.5px] font-bold text-cap">예시</span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-cap transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="mt-3 rounded-btn border border-line bg-white px-4 py-4 text-[13px] leading-relaxed text-sub">
          <p className="text-[11px] font-bold text-cap">
            가상의 부부 예시예요. 실제 리포트는 우리집 숫자로 만들어져요.
          </p>

          <p className="mt-4 text-ink">민준·다은 님, 결영이네입니다.</p>
          <p className="mt-2">최근 6개월 숫자를 봤어요. 한 줄로 말씀드리면 —</p>
          <p className="mt-2">
            <b className="text-ink">비상금이 얇아요.</b> 지금 통장에 있는 현금이 생활비
            1.2개월치인데요. 둘 중 한 명만 수입이 끊겨도 바로 빚으로 갑니다.
          </p>

          <H>우리집 숫자</H>
          <ul className="space-y-1">
            <li>· 월 평균 수입: 583만원</li>
            <li>· 월 평균 지출: 402만원</li>
            <li>· 월 평균 저축·투자: 105만원 (저축률 18%)</li>
            <li>· 순자산: 9,400만원 (자산 3.16억 − 부채 2.22억)</li>
            <li>· 비상금: 생활비 1.2개월치</li>
            <li>· 변동지출 큰 순서: 식비 128만원 / 쇼핑 46만원 / 카페 31만원</li>
          </ul>

          <H>10년 목표까지</H>
          <p>목표는 4억, 지금은 9,400만원이에요.</p>
          <p className="mt-1.5">
            지금 속도(월 105만원)로는 <b className="text-ink">약 24년</b> 걸려요. 10년 안에
            들어오려면 매달 255만원씩 모아야 하는데요. 무리하란 말이 아니라, 아래 세 가지만
            고치면 월 160만원까지는 만들 수 있어요.
          </p>

          <H>지금 제일 급한 것</H>
          <p>
            <b className="text-ink">비상금 통장 만들기.</b>
          </p>
          <p className="mt-1.5">
            저축을 늘리기 전에 이것부터예요. 월 지출 3개월치, 1,200만원이 모일 때까지는 투자
            말고 파킹통장에 넣으세요. 저희도 이거 없이 투자부터 했다가 급전 필요할 때 주식
            팔아서 손해 봤어요.
          </p>

          <H>다음 3개월에 할 일</H>
          <ol className="space-y-1.5">
            <li>1. 비상금 통장을 따로 만들고 매달 100만원씩 넣으세요. 석 달이면 300만원이에요.</li>
            <li>
              2. 경조사·명절이 월 32만원꼴로 나가는데요. 연간비 통장에 매달 30만원씩 미리
              넣어두세요.
            </li>
            <li>3. 식비 128만원에 한 달 예산 110만원을 정하고, 정산 때 같이 확인하세요.</li>
          </ol>

          <H>점검표</H>
          <ul className="space-y-1">
            <li>· 통장 쪼개기: 비상금 통장 분리 필요</li>
            <li>· 보험: 고정지출 비중 31% — 무난함 ✓</li>
            <li>· 청약: 두 분 다 있음 ✓</li>
          </ul>

          <p className="mt-5">궁금한 점은 편하게 답장 주세요. 다음 달에도 잘 모아봐요 🤍</p>
          <p className="mt-1.5 text-ink">결영이네 드림</p>
        </div>
      )}
    </div>
  )
}
