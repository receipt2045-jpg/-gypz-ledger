import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * 예시 리포트 — 신청 전에 "3만원 내면 뭘 받는지" 보여주는 것.
 *
 * 가상의 부부(민준·다은)지만 숫자는 전부 서로 맞아떨어지게 계산해 뒀다.
 * (저축률 18% = 105/583, 새는 돈 76만 = 583−402−105, 보험 6.5% = 38/583,
 *  목표까지 24년 = 3.06억 ÷ 연 1,260만, 부수입 4%p = 25/583)
 * 섹션 구성은 실제 리포트(buildReportDraft)와 신청 화면의 약속
 * ("통장 쪼개기 · 보험 · 청약 점검")에 맞춘다. 마무리는 상담으로 잇는다.
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
            1.2개월치예요. 둘 중 한 명만 수입이 끊겨도 바로 빚으로 갑니다.
          </p>

          <H>우리집 숫자</H>
          <ul className="space-y-1">
            <li>· 월 평균 수입: 583만원 (부수입 25만원 포함)</li>
            <li>· 월 평균 지출: 402만원</li>
            <li>· 월 평균 저축·투자: 105만원 (저축률 18%)</li>
            <li>· 순자산: 9,400만원 (자산 3.16억 − 부채 2.22억)</li>
            <li>· 비상금: 생활비 1.2개월치</li>
            <li>· 변동지출 큰 순서: 식비 128만원 / 쇼핑 46만원 / 카페 31만원</li>
            <li>
              · <b className="text-ink">새는 돈: 매달 76만원</b>이 기록 없이 사라져요
            </li>
          </ul>

          <H>10년 목표까지</H>
          <p>목표는 4억, 지금은 9,400만원이에요.</p>
          <p className="mt-1.5">
            지금 속도(월 105만원)로는 <b className="text-ink">약 24년</b> 걸려요. 10년 안에
            들어오려면 매달 255만원이 필요한데요. 무리하란 말이 아니라, 새는 돈 76만원만
            잡아도 월 180만원까지 올라가요. 반은 온 거예요.
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

          <H>통장 쪼개기, 이렇게</H>
          <p>월급날에 네 갈래 자동이체를 걸어두세요.</p>
          <ul className="mt-1.5 space-y-1">
            <li>· 저축·투자 105만원 — 지금 그대로</li>
            <li>· 비상금 100만원 — 1,200만원 찰 때까지만</li>
            <li>· 연간비 30만원 — 경조사·명절은 여기서</li>
            <li>· 나머지 348만원이 생활비 — 이 통장 하나로만 쓰세요</li>
          </ul>
          <p className="mt-1.5">
            새는 돈 76만원은 잡으려고 애쓰는 게 아니라, 갈래를 나누면 저절로 잡혀요. 남는
            돈이 눈에 보이는 통장은 하나뿐이니까요.
          </p>

          <H>보험 · 청약 점검</H>
          <p>
            보험은 둘이 합쳐 월 38만원, 수입의 6.5%라 무난해요. 실비가 옛날 세대인지만 한번
            확인해 보세요.
          </p>
          <p className="mt-1.5">
            청약은 두 분 다 있어요. 민준 님 통장이 8년 차예요. 점수가 아까우니 절대 깨지
            마세요.
          </p>

          <H>부수입 이야기</H>
          <p>
            다은 님 스마트스토어가 석 달 평균 25만원이에요. 이 돈이 저축률을 4%p 올려주고
            있어요. 우리집은 지출을 더 쥐어짜는 것보다 이쪽을 키우는 게 빠를 수 있어요.
          </p>

          <H>다음 3개월에 할 일</H>
          <ol className="space-y-1.5">
            <li>1. 비상금 통장 만들고 매달 100만원씩. 석 달이면 300만원이에요.</li>
            <li>2. 연간비 통장에 매달 30만원. 경조사가 와도 저축이 안 밀려요.</li>
            <li>3. 식비는 128만원에서 110만원으로. 정산 때 같이 확인하세요.</li>
          </ol>

          <div className="mt-5 border-t border-line pt-4">
            <p>여기까지가 리포트예요.</p>
            <p className="mt-1.5">
              이 숫자를 놓고 '그래서 우리집은 언제 집 사?'까지 가고 싶으시면{' '}
              <b className="text-ink">1:1 내집마련 상담</b>에서 이어서 봐요.
            </p>
            <p className="mt-3">다음 달에도 잘 모아봐요 🤍</p>
            <p className="mt-1.5 text-ink">결영이네 드림</p>
          </div>
        </div>
      )}
    </div>
  )
}
