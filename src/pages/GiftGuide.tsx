import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import ShareArticle, { ShareHero, ShareSection } from '../components/ShareArticle'
import {
  GIFT_LIMIT_MINOR,
  PERIODIC_RATE,
  periodicGiftValue,
  periodicMaxMonthly,
} from '../lib/childMoney'

/** 원 → "2,047" (만원 단위) */
const man = (n: number) => (n / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
const UPDATED = '2026년 10월 27일'
const MONTHLY_OPTIONS = [100_000, 150_000, 195_000, 200_000, 300_000] as const
const YEAR_OPTIONS = [5, 10] as const

/**
 * 아이 통장 증여 신고 정리 (2026-10-27) — 로그인 없이 열리는 공개 자료.
 * 얼마까지 세금이 없나 → 0원이어도 왜 신고하나 → 한 번에 / 그때그때 / 정기금 / 기한 지나서 →
 * 홈택스 순서 → 조심할 것. 모아불리 아이 통장 카드의 '신고하는 법'이 여기로 온다.
 */
export default function GiftGuide() {
  const navigate = useNavigate()
  const [monthly, setMonthly] = useState<number>(200_000)
  const [years, setYears] = useState<(typeof YEAR_OPTIONS)[number]>(10)
  const value = periodicGiftValue(monthly, years)
  const paid = monthly * 12 * years
  const within = value <= GIFT_LIMIT_MINOR

  return (
    <ShareArticle
      kind="guide"
      toc={[
        { no: 1, title: '얼마까지 세금이 없을까' },
        { no: 2, title: '세금이 0원인데 왜 신고해요?' },
        { no: 3, title: '한 번에? 나눠서? 나중에?' },
        { no: 4, title: '홈택스로 신고하는 순서' },
        { no: 5, title: '이것만 조심하세요' },
      ]}
      hero={
        <ShareHero
          kicker="결영이네 증여 신고 정리"
          title={
            <>
              아이 통장에 넣은 돈,
              <br />
              증여 신고 해야 할까?
            </>
          }
          lead={
            <>
              2,000만원 안이면 세금은 0원이에요.
              <br />
              그래도 <b className="font-bold text-[#FFD66B]">신고해 두면</b> 나중에
              <br />
              "이건 아이 돈"이라고 말할 수 있어요.
            </>
          }
        />
      }
      sources={
        <>
          <p className="font-semibold text-sub">자료 출처</p>
          <ul className="mt-1.5 space-y-1">
            <li>· 상속세 및 증여세법 53조(증여재산공제), 53조의2(혼인·출산 증여재산공제)</li>
            <li>· 같은 법 68조(신고 기한 3개월), 69조(신고세액공제 3%), 57조(세대생략 할증)</li>
            <li>· 같은 법 시행령 62조(정기금 평가) — 연 {PERIODIC_RATE * 100}%로 할인</li>
            <li>
              · 국세기본법 47조의2(무신고 가산세), 47조의4(납부지연 가산세), 48조(가산세 감면)
            </li>
            <li>· 국세청 홈택스 증여세 신고 안내</li>
          </ul>
          <p className="mt-3">
            {UPDATED} 기준으로 정리한 참고용 글이에요. 집마다 상황이 달라서, 큰돈을 주거나 공제를
            넘을 때는 국세청(126)이나 세무사에게 꼭 확인하세요.
          </p>
        </>
      }
    >
      {/* ── 1. 공제 */}
      <ShareSection no={1} title="얼마까지 세금이 없을까">
        <div className="space-y-2">
          <Row label="미성년 자녀" value="10년간 2,000만원" />
          <Row label="성년 자녀" value="10년간 5,000만원" />
          <Row label="결혼·출산 때 부모에게" value="+1억원" />
        </div>
        <ul className="mt-4 space-y-2 text-[14.5px] leading-relaxed text-sub [&_b]:font-bold [&_b]:text-ink">
          <li>
            · 엄마·아빠·할머니·할아버지가 준 돈을 <b>모두 합쳐서</b> 2,000만원이에요. 한 사람당이
            아니에요.
          </li>
          <li>
            · 10년은 <b>준 날부터 거꾸로</b> 세요. 그래서 0살에 2,000만, 10살에 2,000만, 20살에
            5,000만원을 주면 <b>9,000만원</b>까지 세금 없이 줄 수 있어요.
          </li>
          <li>
            · 결혼·출산 공제 1억원은 혼인신고 전후 2년, 또는 아이가 태어나고 2년 안에 부모가
            자녀(우리 부부)에게 줄 때 쓰는 거예요.
          </li>
        </ul>
      </ShareSection>

      {/* ── 2. 왜 신고 */}
      <ShareSection no={2} title="세금이 0원인데 왜 신고해요?">
        <p className="text-[15px] leading-relaxed text-sub">
          공제 안이라 낼 세금이 없으면, 신고를 안 해도 가산세는 없어요. 그래도 신고하는 집이 많은
          이유는 세 가지예요.
        </p>
        <ol className="mt-4 space-y-2.5">
          <Step n={1} title="넣은 날짜·금액이 국세청 기록으로 남아요">
            부모 통장에서 아이 통장으로 보낸 돈이 '증여'였다는 공식 기록이 돼요.
          </Step>
          <Step n={2} title="불어난 돈도 아이 돈이 돼요">
            신고한 돈을 주식·펀드로 굴려 늘어난 건 아이 돈으로 보기 쉬워요. 신고를 안 했으면 나중에
            아이가 집 살 때 그 돈이 어디서 났는지 설명하기 어려울 수 있어요.
          </Step>
          <Step n={3} title="10년 세는 시작점이 생겨요">
            언제 얼마를 줬는지 남아 있어야 10년 뒤 다시 2,000만원을 줄 때 헷갈리지 않아요.
          </Step>
        </ol>
      </ShareSection>

      {/* ── 3. 방법 */}
      <ShareSection no={3} title="한 번에? 나눠서? 나중에?">
        <div className="space-y-3">
          <Way tag="A" name="한 번에 넣고 바로 신고">
            2,000만원을 한 번에 아이 통장으로 보내고, <b>보낸 달 말일부터 3개월 안</b>에 신고해요.
            일찍 넣을수록 오래 굴릴 수 있고 신고도 한 번이면 끝나요. 목돈이 있어야 하는 게
            단점이에요.
          </Way>
          <Way tag="B" name="그때그때 넣고 신고">
            용돈·세뱃돈처럼 여러 번 줄 때는 <b>줄 때마다 3개월 안에 신고</b>하는 게 원칙이에요. 전에
            준 돈이 10년 안에 있으면 그 금액도 같이 적어요. 이미 기한이 지난 건 아래 D처럼 하면
            돼요.
          </Way>
          <Way tag="C" name="매달 정해진 돈 + 처음 한 번만 신고 (정기금)">
            "매달 20만원씩 10년 준다"처럼 <b>증여계약서</b>를 쓰고, 첫 입금 뒤 3개월 안에 한 번만
            신고해요. 앞으로 줄 돈을 연 {PERIODIC_RATE * 100}%로 깎아 지금 가치로 보기 때문에, 넣는
            돈 합계보다 적게 잡혀요. 대신 <b>계약서 날짜·금액을 꼭 지켜야</b> 해요. 중간에 멈추거나
            바꾸면 인정받지 못할 수 있어요.
          </Way>

          {/* 정기금 계산 */}
          <div className="rounded-2xl border border-line px-4 py-4">
            <p className="text-[15px] font-extrabold text-ink">정기금으로 하면 얼마로 잡힐까</p>
            <div className="mt-3 grid grid-cols-5 gap-1" role="group" aria-label="매달 넣는 돈">
              {MONTHLY_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonthly(m)}
                  aria-pressed={monthly === m}
                  className={`rounded-lg py-2 text-[13px] font-bold ${
                    monthly === m ? 'bg-ink text-white' : 'bg-bg text-sub'
                  }`}
                >
                  {man(m)}만
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1" role="group" aria-label="몇 년">
              {YEAR_OPTIONS.map((y) => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  aria-pressed={years === y}
                  className={`flex-1 rounded-lg py-2 text-[13px] font-bold ${
                    years === y ? 'bg-ink text-white' : 'bg-bg text-sub'
                  }`}
                >
                  {y}년
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-1.5 text-[14px]">
              <div className="flex justify-between">
                <span className="text-sub">실제로 넣는 돈</span>
                <span className="tnum font-bold text-ink">{man(paid)}만원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sub">증여로 잡히는 돈</span>
                <span className={`tnum font-extrabold ${within ? 'text-brand' : 'text-danger'}`}>
                  약 {Math.round(value / 10_000).toLocaleString('ko-KR')}만원
                </span>
              </div>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-sub">
              {within
                ? '2,000만원 공제 안이에요.'
                : `2,000만원을 넘어요. ${years}년이면 월 ${man(periodicMaxMonthly(years))}만원까지가 공제 안이에요.`}{' '}
              계산 방식에 따라 조금 달라질 수 있어서, 신고 전에 국세청(126)에 한 번 확인하세요.
            </p>
          </div>

          <Way tag="D" name="기한이 지났다면 — 기한 후 신고">
            3개월이 지나도 홈택스에서 <b>기한 후 신고</b>로 할 수 있어요. 공제 안이라 낼 세금이
            0원이면 가산세도 0원이에요. 세금이 생기는 금액이면 신고 안 한 가산세(20%)와 하루
            0.022%씩 붙는 납부지연 가산세가 있고, 늦게라도 빨리 신고할수록(1개월 안 50%, 3개월 안
            30%, 6개월 안 20%) 가산세를 깎아줘요. 오래된 건 <b>이체 내역</b>으로 날짜를 증명해요.
          </Way>
        </div>
        <p className="mt-4 rounded-xl bg-[#F2F7FF] px-4 py-3 text-[13.5px] leading-relaxed text-sub">
          낼 세금이 있을 때 기한 안에 신고하면 세금을 <b className="font-bold text-ink">3%</b>{' '}
          깎아줘요(신고세액공제). 기한 후 신고엔 없어요.
        </p>
      </ShareSection>

      {/* ── 4. 홈택스 */}
      <ShareSection no={4} title="홈택스로 신고하는 순서">
        <ol className="space-y-2.5">
          <Step n={1} title="서류 먼저 PDF로">
            부모 통장 → 아이 통장 이체 내역, 가족관계증명서. 정기금이면 증여계약서도요.
          </Step>
          <Step n={2} title="홈택스(손택스) 로그인">
            세금신고 → 증여세 신고에서 '일반증여 신고'를 골라요. 증여세는 받는 사람(아이)이 내는
            세금이라, 부모가 아이 대신 신고해요. 메뉴 이름은 바뀔 수 있어요.
          </Step>
          <Step n={3} title="받는 사람·주는 사람 넣기">
            아이와 부모 주민번호, 관계(부·모·조부모)를 넣어요.
          </Step>
          <Step n={4} title="얼마를 언제 줬는지">
            재산 종류는 '현금', 증여일은 이체한 날, 금액을 넣어요. 10년 안에 전에 준 돈이 있으면
            같이 적어요.
          </Step>
          <Step n={5} title="공제 2,000만원 넣고 0원 확인">
            증여재산공제에 미성년 자녀 2,000만원이 들어갔는지 보고, 낼 세금이 0원인지 확인해요.
          </Step>
          <Step n={6} title="서류 붙여서 제출">
            PDF를 붙이고 제출한 뒤 접수증을 저장해요. 모아불리 자산 탭 아이 통장 카드에서 '증여
            신고했어요'로 남겨두면 아직 안 한 돈이 한눈에 보여요.
          </Step>
        </ol>
        <p className="mt-3 text-[12.5px] leading-relaxed text-cap">
          막히면 국세청 상담센터 126 → 상속·증여세로 물어보면 돼요. 세무서에 직접 내도 돼요.
        </p>
      </ShareSection>

      {/* ── 5. 조심 */}
      <ShareSection no={5} title="이것만 조심하세요">
        <ul className="space-y-2.5 text-[14.5px] leading-relaxed text-sub [&_b]:font-bold [&_b]:text-ink">
          <li>
            · 현금 입금 말고 <b>부모 통장 → 아이 통장 이체</b>로 넣어요. 이체 기록이 제일 좋은
            증거예요.
          </li>
          <li>
            · 할머니·할아버지가 손주에게 바로 주면 엄마·아빠 몫과 <b>같은 2,000만원</b>을 나눠 써요.
            공제를 넘어 세금이 생기면 세대를 건너뛴 증여라 30%가 더 붙어요.
          </li>
          <li>· 증여세를 부모가 대신 내주면 그 돈도 증여예요.</li>
          <li>
            · 세뱃돈·돌 축하금처럼 상식선의 돈은 증여세를 매기지 않아요. 다만 모아서 아이 이름으로
            굴릴 큰돈이 되면 기록해 두는 게 좋아요.
          </li>
          <li>
            · 아동수당·부모급여는 나라가 아이 몫으로 주는 돈이라 부모가 준 돈과는 달라요. 아이
            통장에 모을 때는 다른 돈과 섞이지 않게 따로 적어 두세요.
          </li>
        </ul>
        <button
          onClick={() => navigate('/child-benefit')}
          className="mt-4 w-full rounded-btn bg-bg py-3.5 text-[14px] font-bold text-ink active:bg-line"
        >
          부모급여·아동수당 앞으로 몇 달 더 받을까 →
        </button>
      </ShareSection>
    </ShareArticle>
  )
}

function Way({ tag, name, children }: { tag: string; name: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-bg p-4">
      <p className="flex items-center gap-2 text-[16px] font-extrabold text-ink">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink text-[12.5px] text-white">
          {tag}
        </span>
        {name}
      </p>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-sub [&_b]:font-bold [&_b]:text-ink">
        {children}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-xl bg-bg px-4 py-3.5">
      <span className="text-[15px] text-sub">{label}</span>
      <span className="tnum text-[18px] font-extrabold text-ink">{value}</span>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-2xl bg-bg p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[14px] font-extrabold text-brand">
        {n}
      </span>
      <div>
        <p className="text-[16px] font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-[14px] leading-relaxed text-sub">{children}</p>
      </div>
    </li>
  )
}
