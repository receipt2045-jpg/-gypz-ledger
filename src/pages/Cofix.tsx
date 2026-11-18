import { useMemo, useState, type ReactNode } from 'react'
import AmountInput from '../components/AmountInput'
import ShareArticle, { ShareHero, ShareSection } from '../components/ShareArticle'
import {
  BALANCE_STEPS,
  BANK5Y,
  COFIX,
  computeCofix,
  riseSteps,
  monthlyPay,
  pp,
  type CofixInput,
  type RepayKind,
} from '../lib/cofix'

/** 원 → "9.5" (만원 단위, 소수 한 자리) */
const man = (n: number) => (n / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
const eok = (n: number) => `${n / 100_000_000}억`
const SAVE_KEY = 'moabuli.cofix.v1'

type LoanType = 'variable' | 'fixed'

type SavedInput = Omit<CofixInput, 'rise'> & { type: LoanType }

function loadInput(): SavedInput {
  const fallback: SavedInput = {
    balance: 300_000_000,
    rate: 4,
    years: 30,
    repay: 'amortized' as RepayKind,
    type: 'variable' as LoanType,
  }
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null')
    if (!saved || typeof saved.balance !== 'number') return fallback
    // 오르는 만큼은 저장하지 않는다 — 달마다 새 발표 숫자로
    const rest = { ...saved }
    delete rest.rise
    return { ...fallback, ...rest }
  } catch {
    return fallback
  }
}

/**
 * 코픽스 오르면 우리집 이자는 얼마 더? (2026-11-17) — 로그인 없이 열리는 공개 자료.
 * 머니그랩 「코픽스」 툰 마지막 장 "이자 계산표 보내줄게, 댓글 남겨줘"로 받은 링크가 오는 자리.
 * 남은 대출금·지금 금리만 넣으면 다음 금리변경일부터 한 달에 얼마 더 내는지 보여준다.
 */
export default function Cofix() {
  const [v, setV] = useState(loadInput)
  const set = (patch: Partial<typeof v>) =>
    setV((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(next))
      } catch {
        // 저장이 막힌 브라우저 — 다음에 다시 넣으면 된다
      }
      return next
    })
  const fixed = v.type === 'fixed'
  // 변동형 = 코픽스, 5년 고정형 = 금융채 5년 — 둘 다 달마다 새 숫자
  const rise = fixed ? BANK5Y.change : COFIX.change
  const r = useMemo(() => computeCofix({ ...v, rise }), [v, rise])
  const verb = COFIX.change > 0 ? '올랐어요' : COFIX.change < 0 ? '내렸어요' : '그대로예요'

  return (
    <ShareArticle
      kind="calc"
      hero={
        <ShareHero
          kicker="머니그랩 · 호랑이 눈높이 재테크"
          title={
            <>
              코픽스 오르면,
              <br />
              우리집 이자는 얼마 더?
            </>
          }
          lead={
            <>
              {COFIX.publishedDay} 발표된 {COFIX.publishedLabel} 코픽스
              <span className="text-white/60">(신규취급액 코픽스 기준)</span>는
              <br />
              {COFIX.prev}%에서 <b className="font-bold text-[#FFD66B]">{COFIX.now}%</b>로{' '}
              {COFIX.change === 0 ? '그대로예요' : `${pp(COFIX.change)} ${verb}`}.
              <br />
              남은 대출금과 지금 금리만 넣으면
              <br />
              한 달에 얼마 달라지는지 바로 보여줘요.
            </>
          }
        />
      }
      side={
        <ShareSection no={1} title="우리 대출 넣어보기">
          <div className="space-y-4">
            <Chips
              label="대출 종류"
              value={v.type}
              options={[
                ['variable', '변동형'],
                ['fixed', '5년 고정형'],
              ]}
              onChange={(type) => set({ type })}
            />
            <Field label="남은 대출금" hint="은행 앱 '대출 잔액'">
              <AmountInput man value={v.balance} onChange={(balance) => set({ balance })} />
            </Field>
            <Field label="지금 금리" hint="연 %">
              <NumberBox value={v.rate} step={0.01} suffix="%" onChange={(rate) => set({ rate })} />
            </Field>
            <Chips
              label="내 금리가 오르는 만큼"
              hint={
                fixed
                  ? `5년 고정형은 금융채 5년을 따라가요 · 지난달 16일보다 바뀐 만큼, 달마다 새로 바뀌어요`
                  : '지난번 금리 정한 날보다 코픽스가 오른 만큼 (신규취급액 코픽스 기준)'
              }
              value={rise}
              options={[
                [
                  rise,
                  fixed
                    ? `${BANK5Y.label} 금융채 5년 ${pp(rise)}`
                    : `${COFIX.publishedLabel} 코픽스 ${pp(rise)}`,
                ],
              ]}
              onChange={() => undefined}
            />
            <Chips
              label="갚는 방식"
              value={v.repay}
              options={[
                ['amortized', '원리금 같이'],
                ['interestOnly', '이자만'],
              ]}
              onChange={(repay) => set({ repay })}
            />
            {v.repay === 'amortized' && (
              <Field label="남은 기간">
                <NumberBox value={v.years} step={1} suffix="년" onChange={(years) => set({ years })} />
              </Field>
            )}
          </div>
        </ShareSection>
      }
      sources={
        <>
          <p className="font-semibold text-sub">자료 출처</p>
          <ul className="mt-1.5 space-y-1">
            <li>
              · 코픽스(신규취급액 기준) {COFIX.prevLabel} {COFIX.prev}% → {COFIX.nowLabel}{' '}
              {COFIX.now}% — 은행연합회 공시({COFIX.publishedDay}), 네이버 증권에서 달마다 받아와요
            </li>
            <li>
              · 금융채 5년 {BANK5Y.rate}%({BANK5Y.day}) — 신한은행 주요시장금리(직전 3영업일 평균),
              매달 16일 값을 받아와요
            </li>
          </ul>
          <p className="mt-3">
            {Number(COFIX.updated.slice(5, 7))}월 {Number(COFIX.updated.slice(8, 10))}일 기준,
            가산·우대 금리는 그대로라고 보고 센 참고용 계산이에요. 실제 금리는 은행·상품·내 조건마다
            달라서 꼭 은행 앱에서 확인해 주세요.
          </p>
        </>
      }
    >
      {/* ── 2. 결과 */}
      <ShareSection no={2} title={fixed ? '다음에 금리를 정할 때' : '다음 금리변경일부터'}>
        {
          <div className="rounded-2xl bg-[#F2F7FF] px-5 py-5 text-center">
            <p className="text-[14px] font-bold text-sub">
              {r.diff < 0 ? '한 달에 덜 내는 돈' : '한 달에 더 내는 돈'}
            </p>
            <p className="tnum mt-1 text-[34px] font-extrabold text-brand">
              {r.diff > 0 ? '+' : r.diff < 0 ? '−' : ''}
              {man(Math.abs(r.diff))}만원
            </p>
            <p className="tnum mt-1 text-[13.5px] text-sub">1년이면 {man(Math.abs(r.diffYear))}만원</p>
            {fixed && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-sub">
                이미 받은 고정형은 5년 동안 그대로예요.
                <br />
                새로 받거나 5년이 지나 다시 정할 때 이만큼 달라져요.
              </p>
            )}
          </div>
        }
        <div className="mt-3 space-y-2">
          <Row
            name="지금"
            sub={`연 ${v.rate.toFixed(2)}%`}
            value={`월 ${man(r.before)}만원`}
          />
          <Row
            name={fixed ? '다시 정하면' : '금리변경일 뒤'}
            sub={`연 ${(v.rate + rise).toFixed(2)}%`}
            value={`월 ${man(r.after)}만원`}
            strong
          />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-cap">
          {v.repay === 'amortized'
            ? '원리금 같이 갚는 방식(원리금균등)으로 원금+이자를 계산했어요. 툰 카드 숫자는 이자만 단순 계산이라 이것보다 조금 커요.'
            : '이자만 계산했어요. 남은 대출금 × 오르는 폭 ÷ 12 — 툰 카드와 같은 방식이에요.'}
        </p>
      </ShareSection>

      {/* ── 3. 오르는 폭마다 */}
      <ShareSection no={3} title="금리가 오르는 만큼 한 달에 더">
        <Table
          head={['오르는 만큼', '한 달', '1년']}
          rows={riseSteps(rise).map((step) => {
            const d = computeCofix({ ...v, rise: step }).diff
            return [pp(step), `${man(d)}만`, `${man(d * 12)}만`, step === rise]
          })}
        />
      </ShareSection>

      {/* ── 4. 잔액마다 */}
      <ShareSection no={4} title={`대출금마다 (${pp(rise)})`}>
        <Table
          head={['남은 대출금', '한 달', '1년']}
          rows={BALANCE_STEPS.map((b) => {
            const d =
              monthlyPay(b, v.rate + rise, v.years, v.repay) - monthlyPay(b, v.rate, v.years, v.repay)
            return [eok(b), `${man(d)}만`, `${man(d * 12)}만`, false]
          })}
        />
      </ShareSection>

      {/* ── 5. 확인할 것 */}
      <ShareSection no={5} title="대출 있으면 딱 2개만 확인">
        <ol className="space-y-2.5">
          <Step n={1} title="우리 대출, 변동형? 고정형?">
            변동형은 코픽스로 6개월마다 금리를 다시 정해요. 5년 고정형은 대부분 처음 금리를 금융채로
            정해서 5년은 그대로예요.
          </Step>
          <Step n={2} title="은행 앱에서 '다음 금리변경일'">
            내일부터 바로 오르는 게 아니라 다음 금리변경일에 바뀌어요. 오르는 폭도 지난달이 아니라
            지난번 내 금리를 정한 날과 비교해야 해요.
          </Step>
        </ol>
        <div className="mt-4 rounded-2xl bg-bg p-4 text-[14px] leading-relaxed text-sub [&_b]:font-bold [&_b]:text-ink">
          <b>내 대출 금리 = 지표 금리 + 가산 금리 − 우대 금리</b>
          <br />
          지표 금리가 코픽스냐 금융채냐에 따라 따라가는 숫자가 달라요. 가산·우대 금리는 사람·은행마다
          달라요.
        </div>
      </ShareSection>
    </ShareArticle>
  )
}

function Row({ name, sub, value, strong = false }: { name: string; sub: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-bg px-4 py-3.5">
      <span className="text-[15px] font-bold text-ink">
        {name}
        <span className="tnum mt-0.5 block text-[12px] font-normal text-cap">{sub}</span>
      </span>
      <span className={`tnum text-[17px] font-extrabold ${strong ? 'text-brand' : 'text-ink'}`}>{value}</span>
    </div>
  )
}

function Table({ head, rows }: { head: string[]; rows: [string, string, string, boolean][] }) {
  return (
    <table className="tnum w-full text-[14.5px]">
      <thead>
        <tr className="text-[12.5px] text-cap">
          {head.map((h, i) => (
            <th key={h} className={`pb-2 font-semibold ${i === 0 ? 'text-left' : 'text-right'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b, c, on]) => (
          <tr key={a} className={`border-t border-line ${on ? 'bg-[#F2F7FF] font-bold text-brand' : 'text-ink'}`}>
            <td className="py-2.5 pl-1 font-bold">{a}</td>
            <td className="py-2.5 text-right">{b}</td>
            <td className="py-2.5 pr-1 text-right">{c}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function NumberBox({
  value,
  step,
  suffix,
  onChange,
}: {
  value: number
  step: number
  suffix: string
  onChange: (n: number) => void
}) {
  // 입력 중인 글자는 따로 들고 있는다 — 칸을 비우거나 "3." 처럼 치는 중에도 지워지게 (2026-11-19 점검:
  // 숫자만 받으면 빈 칸이 바로 원래 숫자로 돌아와 "4"를 지우고 3.85를 치면 "43.85"가 됐다)
  const [text, setText] = useState(String(value))
  if (text !== '' && Number(text) !== value && !text.endsWith('.')) setText(String(value))
  return (
    <div className="flex items-center rounded-xl border border-line bg-white px-4 focus-within:border-brand">
      <input
        type="number"
        inputMode="decimal"
        value={text}
        step={step}
        min={0}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(n) && n >= 0) onChange(n)
        }}
        onBlur={() => {
          if (text === '' || !Number.isFinite(Number(text))) setText(String(value))
        }}
        className="tnum w-full bg-transparent py-3 text-[16px] font-bold text-ink outline-none"
      />
      <span className="shrink-0 text-[15px] font-bold text-sub">{suffix}</span>
    </div>
  )
}

function Chips<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
  wrap = false,
}: {
  label: string
  hint?: ReactNode
  value: T
  options: [T, string][]
  onChange: (v: T) => void
  wrap?: boolean
}) {
  return (
    <div>
      <p className="text-[14px] font-semibold text-ink">{label}</p>
      {hint && <p className="mt-0.5 text-[12.5px] leading-relaxed text-cap">{hint}</p>}
      <div className={`mt-1.5 ${wrap ? 'grid grid-cols-2' : 'flex'} gap-1.5`} role="group" aria-label={label}>
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
