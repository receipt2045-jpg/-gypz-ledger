import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import ShareArticle, { ShareHero, ShareSection } from '../components/ShareArticle'
import {
  BENEFIT_RULES,
  REGION_LABEL,
  allowanceAge,
  computeBenefit,
  ymLabel,
  type BenefitInput,
  type BenefitLine,
  type Region,
} from '../lib/childBenefit'

/** 원 → "10" (만원 단위) */
const man = (n: number) => (n / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
const SAVE_KEY = 'moabuli.childBenefit.v1'

function loadInput(): BenefitInput {
  const fallback: BenefitInput = {
    birth: new Date().toLocaleDateString('sv-SE'),
    order: 1,
    region: 'metro',
    voucher: false,
    daycare: false,
  }
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null')
    return saved && typeof saved.birth === 'string' ? { ...fallback, ...saved } : fallback
  } catch {
    return fallback
  }
}

/**
 * 부모급여·아동수당 계산기 (2026-10-27) — 로그인 없이 열리는 공개 자료.
 * "1년은 100만, 그다음 50만, 그리고 10만" — 앞의 둘은 부모급여, 10만은 아동수당이다.
 * 아이 생일(예정일)만 넣으면 앞으로 몇 달, 얼마나 더 받는지 보여준다. 숫자는 lib/childBenefit.ts 한 곳에.
 */
export default function ChildBenefit() {
  const navigate = useNavigate()
  const [v, setV] = useState<BenefitInput>(loadInput)
  const set = (patch: Partial<BenefitInput>) =>
    setV((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(next))
      } catch {
        // 저장이 막힌 브라우저 — 다음에 다시 넣으면 된다
      }
      return next
    })
  const r = useMemo(() => computeBenefit(v), [v])
  const decline = v.region === 'declinePref' || v.region === 'declineSpecial'

  return (
    <ShareArticle
      kind="calc"
      hero={
        <ShareHero
          kicker="결영이네 육아 지원금 정리"
          title={
            <>
              부모급여·아동수당,
              <br />
              앞으로 몇 달 더 받을까
            </>
          }
          lead={
            <>
              첫해 <b className="font-bold text-[#FFD66B]">월 100만</b>, 둘째 해{' '}
              <b className="font-bold text-[#FFD66B]">월 50만</b>은 부모급여,
              <br />
              그와 따로 나오는 <b className="font-bold text-[#FFD66B]">월 10만</b>은 아동수당이에요.
              <br />
              2026년 바뀐 금액으로 계산해요.
            </>
          }
        />
      }
      side={
        <ShareSection no={1} title="우리 아이 넣어보기">
          <div className="space-y-4">
            <Field label="아이 생일" hint="아직이면 출산 예정일">
              <input
                type="date"
                value={v.birth}
                min="2016-01-01"
                max="2028-12-31"
                onChange={(e) => e.target.value && set({ birth: e.target.value })}
                className="tnum w-full rounded-xl border border-line bg-white px-4 py-3 text-[16px] font-bold text-ink outline-none focus:border-brand"
              />
            </Field>
            <Chips
              label="몇째예요?"
              value={v.order}
              options={[
                [1, '첫째'],
                [2, '둘째 이상'],
              ]}
              onChange={(order) => set({ order })}
            />
            <Chips
              label="사는 곳"
              value={v.region}
              options={(Object.keys(REGION_LABEL) as Region[]).map((k) => [k, REGION_LABEL[k]])}
              onChange={(region) => set({ region })}
              wrap
            />
            {decline && (
              <label className="flex items-center gap-2 text-[14px] text-sub">
                <input
                  type="checkbox"
                  checked={v.voucher}
                  onChange={(e) => set({ voucher: e.target.checked })}
                  className="h-4 w-4 accent-brand"
                />
                아동수당을 지역사랑상품권으로 받아요 (+1만원)
              </label>
            )}
            <Chips
              label="어린이집"
              value={v.daycare}
              options={[
                [false, '집에서 봐요'],
                [true, '다녀요(다닐 거예요)'],
              ]}
              onChange={(daycare) => set({ daycare })}
            />
          </div>
        </ShareSection>
      }
      sources={
        <>
          <p className="font-semibold text-sub">자료 출처</p>
          <ul className="mt-1.5 space-y-1">
            <li>
              · 보건복지부 보도자료 「아동수당 대상·금액 확대, 4월부터 지급 시작」(2026-04-23) — 9세
              미만 확대, 해마다 1세씩 13세 미만까지, 지역별 금액
            </li>
            <li>· 정책브리핑 「2026년 4월부터 아동수당 더 넓게, 더 많이!」(2026-04-27)</li>
            <li>· 복지로 — 부모급여·첫만남이용권·가정양육수당 안내</li>
          </ul>
          <p className="mt-3">
            {BENEFIT_RULES.updated.slice(0, 4)}년 {Number(BENEFIT_RULES.updated.slice(5, 7))}월{' '}
            {Number(BENEFIT_RULES.updated.slice(8, 10))}일 기준 금액이 앞으로도 그대로라고 보고 센
            참고용 계산이에요. 소득·재산과 상관없이 받는 돈이지만, 해외에 오래 머물면 멈출 수
            있어요. 정확한 건 복지로나 주민센터에서 확인해 주세요.
          </p>
        </>
      }
    >
      {/* ── 2. 결과 */}
      <ShareSection no={2} title={`${ymLabel(r.startYm)}부터 받을 돈`}>
        <div className="rounded-2xl bg-[#F2F7FF] px-5 py-5 text-center">
          <p className="text-[14px] font-bold text-sub">앞으로 받을 돈 모두</p>
          <p className="tnum mt-1 text-[32px] font-extrabold text-brand">{man(r.total)}만원</p>
          {r.total === 0 && (
            <p className="mt-1 text-[13px] text-sub">이 생일로는 받을 수 있는 달이 끝났어요</p>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <Line
            name="부모급여"
            sub={
              v.daycare
                ? '어린이집 다니면 보육료 빼고 남는 돈만'
                : '0~11개월 100만 · 12~23개월 50만'
            }
            line={r.parentPay}
          />
          <Line
            name="아동수당"
            sub={`월 ${man(r.allowance.total / Math.max(1, r.allowance.months))}만 · 13세 생일 전달까지`}
            line={r.allowance}
          />
          {!v.daycare && (
            <Line
              name="가정양육수당"
              sub="두 돌부터 어린이집 안 다니면 월 10만"
              line={r.homeCare}
            />
          )}
          <div className="flex items-baseline justify-between rounded-xl bg-bg px-4 py-3.5">
            <span className="text-[15px] font-bold text-ink">
              첫만남이용권
              <span className="mt-0.5 block text-[12px] font-normal text-cap">
                {r.firstMeetAhead
                  ? '태어나면 한 번 · 국민행복카드 포인트'
                  : '태어날 때 한 번 · 합계엔 안 넣었어요'}
              </span>
            </span>
            <span className="tnum text-[17px] font-extrabold text-ink">{man(r.firstMeet)}만원</span>
          </div>
        </div>
      </ShareSection>

      {/* ── 3. 달마다 */}
      {r.phases.length > 0 && (
        <ShareSection no={3} title="달마다 얼마씩 들어올까">
          <ol className="space-y-2">
            {r.phases.map((p) => (
              <li key={p.from} className="rounded-xl bg-bg px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-bold text-ink">
                    {ymLabel(p.from)}
                    {p.to !== p.from && ` ~ ${ymLabel(p.to)}`}
                  </span>
                  <span className="tnum text-[17px] font-extrabold text-ink">
                    월 {man(p.monthly)}만
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-sub">
                  {[
                    p.parentPay > 0 && `부모급여 ${man(p.parentPay)}만`,
                    p.allowance > 0 && `아동수당 ${man(p.allowance)}만`,
                    p.homeCare > 0 && `양육수당 ${man(p.homeCare)}만`,
                  ]
                    .filter(Boolean)
                    .join(' + ')}{' '}
                  · {p.months}달
                </p>
              </li>
            ))}
          </ol>
        </ShareSection>
      )}

      {/* ── 4. 2026년 금액 */}
      <ShareSection no={r.phases.length > 0 ? 4 : 3} title="2026년 금액 한눈에">
        <div className="space-y-3 text-[14.5px] leading-relaxed text-sub [&_b]:font-bold [&_b]:text-ink">
          <Box name="부모급여">
            <b>0~11개월 월 100만원</b>, <b>12~23개월 월 50만원</b>. 어린이집에 다니면 0세는 보육료
            바우처를 빼고 남는 돈(약 {man(BENEFIT_RULES.parentPayDaycare0)}만원)을 현금으로, 1세는
            바우처로만 받아요.
          </Box>
          <Box name="아동수당">
            <b>2026년부터 만 9세 미만</b>으로 넓어졌고, 해마다 한 살씩 올라{' '}
            <b>2030년엔 13세 미만</b>까지 받아요. 사는 곳에 따라 수도권 10만, 비수도권 10.5만,
            인구감소 우대지역 11만, 특별지역 12만원이에요. 인구감소지역에서 지역사랑상품권으로
            받으면 1만원을 더 줘요.
            <span className="mt-2 block text-[12.5px] text-cap">
              나이 기준: 2026년 {allowanceAge(2026)}세 · 2027년 {allowanceAge(2027)}세 · 2028년{' '}
              {allowanceAge(2028)}세 · 2029년 {allowanceAge(2029)}세 · 2030년 {allowanceAge(2030)}세
              미만
            </span>
          </Box>
          <Box name="첫만남이용권">
            첫째 <b>200만원</b>, 둘째부터 <b>300만원</b>. 국민행복카드 포인트로 받아요. 쓸 수 있는
            기간이 정해져 있으니 복지로에서 꼭 확인하세요.
          </Box>
          <Box name="가정양육수당">
            부모급여가 끝난 두 돌(24개월)부터 어린이집·유치원에 안 다니면 86개월 전까지 월
            10만원이에요.
          </Box>
        </div>
      </ShareSection>

      {/* ── 5. 신청 */}
      <ShareSection no={r.phases.length > 0 ? 5 : 4} title="신청은 태어나고 60일 안에">
        <ol className="space-y-2.5">
          <Step n={1} title="출생신고하면서 한 번에">
            주민센터나 정부24에서 출생신고할 때 '행복출산 원스톱 서비스'로 부모급여·아동수당·
            첫만남이용권을 같이 신청할 수 있어요.
          </Step>
          <Step n={2} title="60일을 넘기면 그만큼 못 받아요">
            태어난 날부터 60일 안에 신청해야 태어난 달 것부터 받아요. 늦으면 신청한 달부터예요.
          </Step>
          <Step n={3} title="매달 25일에 들어와요">
            부모급여·아동수당은 매달 25일에 신청한 통장으로 들어와요. 아이 통장으로 받을 수도
            있어요.
          </Step>
        </ol>
        <button
          onClick={() => navigate('/gift-guide')}
          className="mt-4 w-full rounded-btn bg-bg py-3.5 text-[14px] font-bold text-ink active:bg-line"
        >
          아이 통장에 모은 돈, 증여 신고해야 할까? →
        </button>
      </ShareSection>
    </ShareArticle>
  )
}

function Line({ name, sub, line }: { name: string; sub: string; line: BenefitLine }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-bg px-4 py-3.5">
      <span className="min-w-0 text-[15px] font-bold text-ink">
        {name}
        <span className="mt-0.5 block text-[12px] font-normal text-cap">{sub}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="tnum block text-[17px] font-extrabold text-ink">
          {line.months > 0 ? `${man(line.total)}만원` : '—'}
        </span>
        <span className="tnum block text-[12px] text-sub">
          {line.lastYm ? `${line.months}달 · ${ymLabel(line.lastYm)}까지` : '받을 달 없음'}
        </span>
      </span>
    </div>
  )
}

function Chips<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
  wrap = false,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
  wrap?: boolean
}) {
  return (
    <div>
      <p className="text-[14px] font-semibold text-ink">{label}</p>
      <div
        className={`mt-1.5 ${wrap ? 'grid grid-cols-2' : 'flex'} gap-1.5`}
        role="group"
        aria-label={label}
      >
        {options.map(([k, text]) => (
          <button
            key={String(k)}
            onClick={() => onChange(k)}
            aria-pressed={value === k}
            className={`flex-1 rounded-xl py-2.5 text-[14px] font-bold ${
              value === k ? 'bg-ink text-white' : 'bg-bg text-sub'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[14px] font-semibold text-ink">{label}</span>
      {hint && <span className="ml-1.5 text-[12px] text-cap">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function Box({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-bg p-4">
      <p className="text-[16px] font-extrabold text-ink">{name}</p>
      <p className="mt-1">{children}</p>
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
