import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import Card from '../components/Card'
import CalcShell, { CalcRow } from '../components/CalcShell'
import { useLedgerStore } from '../lib/store'
import { netWorthOf, resolveLedger, resolveSnapshot } from '../lib/carryover'
import { abbreviateKRW, currentYm, formatComma } from '../lib/format'
import {
  HOME_LOAN_BASE_DATE,
  METHOD_LABEL,
  RATE_TYPE,
  REGION,
  findLoans,
  type AgeBand,
  type AskKey,
  type LoanFinderInput,
  type LoanResult,
  type Method,
} from '../lib/homeLoan'

const short = (n: number) => (n <= 0 ? '0원' : abbreviateKRW(n))

/** 다른 데서 찾아봐야 하는 것 — 바로가기 (2026-10-20 요청) */
const LINKS = {
  kb: ['KB시세 보기', 'https://kbland.kr'],
  naver: ['네이버 부동산', 'https://new.land.naver.com'],
  calc: ['부동산계산기.com', 'https://xn--989a00af8jnslv3dba.com'],
  publicPrice: ['공시가격 알리미', 'https://www.realtyprice.kr'],
  fund: ['기금e든든 (디딤돌·신생아)', 'https://enhuf.molit.go.kr'],
  hf: ['주택금융공사 (보금자리론)', 'https://www.hf.go.kr'],
  consultant: ['대출상담사 등록 조회', 'https://www.loanconsultant.or.kr'],
} as const
type LinkKey = keyof typeof LINKS
const ASK_LINK: Record<AskKey, LinkKey> = { fund: 'fund', hf: 'hf', consultant: 'consultant' }

function Go({ to }: { to: LinkKey }) {
  const [label, href] = LINKS[to]
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mr-1.5 mt-1 inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-1 text-[12px] font-semibold text-brand"
    >
      {label}
      <ExternalLink size={12} />
    </a>
  )
}

function Chips<T extends string | number | boolean>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
            value === v ? 'border-brand bg-brand text-white' : 'border-line bg-white text-sub'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
        on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-sub'
      }`}
    >
      {label}
    </button>
  )
}

function Step({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <p className="mb-2 flex items-center gap-2 text-[15px] font-bold text-ink">
        <span className="rounded-md bg-ink px-1.5 py-0.5 text-[11px] text-white">{no}</span>
        {title}
      </p>
      {children}
    </Card>
  )
}

const Sub = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-1.5 mt-3 text-[12.5px] text-cap">{children}</p>
)

/**
 * 내집마련 대출 찾기 (2026-10-20) — 원팀 프로젝트 2강 '대출의 이해'의 우선순위 5단계 그대로.
 * 감당 가능한 대출 → 우리 조건 → 살 집 → 은행 대출 방식 → 받을 수 있는 대출을 유리한 순으로.
 * 규칙·숫자는 lib/homeLoan.ts 한 곳에.
 */
export default function LoanFinderCalc() {
  const { profile, ledgers, snapshots } = useLedgerStore()
  const prefill = useMemo(() => {
    const ledger = resolveLedger(ledgers, currentYm())
    const monthly = (m: 1 | 2) =>
      ledger.items
        .filter((it) => it.group === 'income' && it.member === m)
        .reduce((a, it) => a + (it.actual || it.planned), 0)
    const r = profile.roadmap
    const house = r?.events.find((e) => e.kind === 'house' && (e.price ?? 0) > 0)
    return {
      income1: (r?.income1 || monthly(1)) * 12,
      income2: (r?.income2 || monthly(2)) * 12,
      own: Math.max(0, netWorthOf(resolveSnapshot(snapshots, currentYm()))),
      price: house?.price ?? 0,
    }
  }, [ledgers, snapshots, profile.roadmap])

  const [input, setInput] = useState<LoanFinderInput>(() => ({
    income1: prefill.income1,
    income2: prefill.income2,
    own: prefill.own,
    monthly: 1_500_000,
    age: '30',
    home: 'none',
    first: true,
    newly: true,
    baby: false,
    assetOk: true,
    worker: true,
    kids: 0,
    deal: prefill.price || 500_000_000,
    kb: prefill.price || 500_000_000,
    publicPrice: 0,
    region: 'metro',
    eup: false,
    regulated: false,
    overheated: false,
    area: '85',
    rateType: 'cycle',
    lender: 'bank',
    mortgageInsurance: false,
  }))
  const set = (patch: Partial<LoanFinderInput>) => setInput((v) => ({ ...v, ...patch }))
  const r = findLoans(input)
  const names = [profile.member1Name, profile.member2Name]

  return (
    <CalcShell
      wide
      title="내집마련 대출 찾기"
      lead="우리 조건을 고르면 받을 수 있는 대출을 유리한 순서로 보여 줘요. 감당 가능한 대출부터 정해요."
    >
      {/* PC (2026-10-20): 왼쪽 입력, 오른쪽 결과 */}
      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <div className="space-y-3">
          <Step no={1} title="감당 가능한 대출">
            <CalcRow label="한 달에 부담 없는 상환액">
              <AmountInput value={input.monthly} onChange={(n) => set({ monthly: n })} />
            </CalcRow>
            <p className="mt-1 text-[12px] leading-relaxed text-cap">
              이 돈이 없어도 생활에 부담 없고, 하락장에도 버틸 수 있는 금액이요.
            </p>
            <div className="mt-2 rounded-btn bg-bg px-3 py-2.5 text-[13px] text-sub">
              월 {short(input.monthly)}이면 약{' '}
              <b className="tnum font-bold text-ink">{short(r.affordable)}</b>까지{' '}
              <span className="text-[11.5px] text-cap">(30년 · 4.8% · 원리금균등)</span>
              <br />
              <span className="text-[12px] text-cap">
                연봉 × 5 어림 (스트레스 DSR): 약 {short(r.incomeTimesFive)}
              </span>
            </div>
            <Go to="calc" />
          </Step>

          <Step no={2} title="우리 조건">
            <CalcRow label={`${names[0]} 연소득`} auto={prefill.income1 ? '가계부' : undefined}>
              <AmountInput value={input.income1} onChange={(n) => set({ income1: n })} />
            </CalcRow>
            <CalcRow label={`${names[1]} 연소득`} auto={prefill.income2 ? '가계부' : undefined}>
              <AmountInput value={input.income2} onChange={(n) => set({ income2: n })} />
            </CalcRow>
            <CalcRow label="집 사는 데 쓸 우리 돈" auto={prefill.own ? '순자산' : undefined}>
              <AmountInput value={input.own} onChange={(n) => set({ own: n })} />
            </CalcRow>
            <Sub>대출 받는 사람 나이 (장래소득 · 보금자리론 기간)</Sub>
            <Chips<AgeBand>
              label="대출 받는 사람 나이"
              value={input.age}
              onChange={(v) => set({ age: v })}
              options={[
                ['u25', '만 24세 이하'],
                ['25', '25~29'],
                ['30', '30~34'],
                ['35', '35~39'],
                ['40', '40~49'],
                ['50', '50세 이상'],
              ]}
            />
            <Sub>우리 상황</Sub>
            <div className="flex flex-wrap gap-1.5">
              <Chips<'none' | 'one'>
                label="집"
                value={input.home}
                onChange={(v) => set({ home: v })}
                options={[
                  ['none', '집 없음'],
                  ['one', '1주택'],
                ]}
              />
              <Toggle
                on={input.first}
                onChange={(v) => set({ first: v })}
                label="생애 처음 사는 집"
              />
              <Toggle on={input.newly} onChange={(v) => set({ newly: v })} label="결혼 7년 이내" />
              <Toggle on={input.baby} onChange={(v) => set({ baby: v })} label="2년 안에 출산" />
              <Toggle
                on={input.assetOk}
                onChange={(v) => set({ assetOk: v })}
                label="순자산 5.11억 이하"
              />
              <Toggle on={input.worker} onChange={(v) => set({ worker: v })} label="근로소득자" />
            </div>
            <Sub>자녀</Sub>
            <Chips<0 | 1 | 2>
              label="자녀"
              value={input.kids}
              onChange={(v) => set({ kids: v })}
              options={[
                [0, '없음'],
                [1, '1명'],
                [2, '2명 이상'],
              ]}
            />
          </Step>

          <Step no={3} title="살 집">
            <CalcRow label="매매가" auto={prefill.price ? '로드맵' : undefined}>
              <AmountInput value={input.deal} onChange={(n) => set({ deal: n })} />
            </CalcRow>
            <CalcRow label="KB시세">
              <AmountInput value={input.kb} onChange={(n) => set({ kb: n })} />
            </CalcRow>
            <Go to="kb" />
            <Go to="naver" />
            <p className="mt-1.5 text-[12px] leading-relaxed text-cap">
              은행은 대부분 KB시세로 한도를 정해요. 보금자리론은 매매가·KB시세 둘 다 6억 이하,
              한도는 낮은 쪽 기준이에요.
            </p>
            <CalcRow label="공시가격 (모르면 비워 두기)">
              <AmountInput value={input.publicPrice} onChange={(n) => set({ publicPrice: n })} />
            </CalcRow>
            <Go to="publicPrice" />
            <p className="mt-1.5 text-[12px] leading-relaxed text-cap">
              비우면 KB시세 × 70%로 어림해요. 주담대 이자 소득공제(기준시가 6억 이하)에 써요.
            </p>
            <Sub>지역</Sub>
            <div className="flex flex-wrap gap-1.5">
              <Chips
                label="지역"
                value={input.region}
                onChange={(v) => set({ region: v })}
                options={Object.entries(REGION).map(([k, v]) => [
                  k as LoanFinderInput['region'],
                  v.label,
                ])}
              />
              {input.region === 'other' && (
                <Toggle on={input.eup} onChange={(v) => set({ eup: v })} label="읍·면" />
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Toggle
                on={input.regulated}
                onChange={(v) => set({ regulated: v })}
                label="규제지역"
              />
              <Toggle
                on={input.overheated}
                onChange={(v) => set({ overheated: v })}
                label="투기과열지구"
              />
            </div>
            <Sub>전용면적</Sub>
            <Chips<LoanFinderInput['area']>
              label="전용면적"
              value={input.area}
              onChange={(v) => set({ area: v })}
              options={[
                ['85', '85㎡ 이하 (34평)'],
                ['100', '85~100㎡'],
                ['big', '100㎡ 초과'],
              ]}
            />
          </Step>

          <Step no={4} title="은행 대출은 이렇게">
            <Sub>금리 유형 — 한도가 달라져요</Sub>
            <Chips<LoanFinderInput['rateType']>
              label="금리 유형"
              value={input.rateType}
              onChange={(v) => set({ rateType: v })}
              options={Object.entries(RATE_TYPE).map(([k, v]) => [
                k as LoanFinderInput['rateType'],
                `${v.label} ${v.rate}%`,
              ])}
            />
            <Sub>어디서</Sub>
            <div className="flex flex-wrap gap-1.5">
              <Chips<LoanFinderInput['lender']>
                label="어디서"
                value={input.lender}
                onChange={(v) => set({ lender: v })}
                options={[
                  ['bank', '은행 (DSR 40%)'],
                  ['ins', '보험사 (DSR 50% · 방공제 없음)'],
                ]}
              />
              {input.lender === 'bank' && (
                <Toggle
                  on={input.mortgageInsurance}
                  onChange={(v) => set({ mortgageInsurance: v })}
                  label="MCI·MCG 가입 (방공제 없이)"
                />
              )}
            </div>
          </Step>
        </div>
        {/* 오른쪽: 결과 — PC에선 입력을 고치는 동안 계속 보이게 */}
        <div className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pb-4">
          <div className="rounded-card bg-ink px-4 py-3.5 text-white">
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-[12px] text-white/60">필요한 대출</p>
                <p className="tnum text-[21px] font-extrabold">{short(r.need)}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-white/60">우리가 살 수 있는 집</p>
                <p className="tnum text-[21px] font-extrabold">{short(r.canBuy)}</p>
              </div>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-white/55">
              살 수 있는 집 = 우리 돈 + (가장 유리한 대출 한도와 감당 가능한 대출 중 작은 쪽) ·
              세금·복비는 '집 살 때 드는 돈'에서
            </p>
          </div>

          {r.loans.map((l, i) => (
            <LoanCard key={l.key} loan={l} best={i === 0} need={r.need} monthly={input.monthly} />
          ))}

          {r.blocked.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-1 pt-1 text-[12.5px] text-cap">지금 조건으론 어려운 대출</p>
              {r.blocked.map((l) => (
                <div
                  key={l.key}
                  className="flex justify-between gap-3 rounded-btn bg-white px-3.5 py-2.5 text-[12.5px] text-cap"
                >
                  <b className="shrink-0 font-bold text-sub">{l.name}</b>
                  <span className="text-right">{l.blockers.join(' · ')}</span>
                </div>
              ))}
            </div>
          )}

          <Card>
            <p className="mb-1 text-[15px] font-bold text-ink">대출 받기 전 체크리스트</p>
            <Check title="방공제 꼭 물어보기">
              &ldquo;대출 받을 때 방공제를 하나요?&rdquo; &ldquo;한다면 MCG·MCI 가입
              가능한가요?&rdquo;
            </Check>
            <Check title="접수는 잔금 2~3개월 전, 월초에">
              대출 총량 때문에 월초에 풀려요. 월말에 미리 물어봐 두세요. 계약서 날짜 기준으로 규제가
              적용돼요.
            </Check>
            <Check title="주거래 은행보다 대출상담사">
              여러 은행을 비교하고 비대면도 돼요. 상담비를 달라거나 특정 금융사만 권하면 손절하세요.
              <br />
              <Go to="consultant" />
            </Check>
            <Check title="정책대출은 직접 확인">
              내 조건을 말하면 더 정확한 답을 들을 수 있어요.
              <br />
              <Go to="fund" />
              <Go to="hf" />
            </Check>
            <details className="mt-2">
              <summary className="cursor-pointer text-[12.5px] font-bold text-brand">
                주담대 중간에 갚지 마세요 — 5가지 이유
              </summary>
              <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-[12.5px] leading-relaxed text-sub">
                <li>인플레이션이 빚의 무게를 녹여요</li>
                <li>지금 받은 한도는 다시 못 받을 수 있어요</li>
                <li>1주택이면 이자 소득공제가 있어요</li>
                <li>갚을 거면 신용대출·카드론이 먼저예요</li>
                <li>그 돈으로 투자하는 게 나아요</li>
              </ol>
            </details>
          </Card>
        </div>
      </div>
      <p className="px-1 text-[12px] leading-relaxed text-cap">
        {HOME_LOAN_BASE_DATE} 원팀 프로젝트 강의 기준 어림값이에요. 금리는 소득·시기에 따라 달라지고
        정책은 자주 바뀌니, 대출 받기 전 꼭 다시 확인하세요.
      </p>
    </CalcShell>
  )
}

function Check({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-bg py-2 text-[12.5px] leading-relaxed text-sub">
      <b className="font-bold text-ink">{title}</b> — {children}
    </div>
  )
}

function LoanCard({
  loan: l,
  best,
  need,
  monthly,
}: {
  loan: LoanResult
  best: boolean
  need: number
  monthly: number
}) {
  const max = Math.max(...l.parts.map((p) => (Number.isFinite(p.amount) ? p.amount : 0)))
  const methods: Method[] = l.method === 'grad' ? ['grad', 'ann', 'prin'] : ['ann', 'prin']
  return (
    <div
      className={`rounded-card bg-card p-4 shadow-card ${best ? 'border-[1.5px] border-brand' : ''}`}
      data-testid={`loan-${l.key}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[16px] font-bold text-ink">
            {best && (
              <span className="mr-1.5 rounded-md bg-brand px-1.5 py-0.5 align-middle text-[11px] text-white">
                우리집에 유리
              </span>
            )}
            {l.name}
          </p>
          <p className="mt-0.5 text-[12px] text-cap">
            {l.sub}
            {l.note ? ` · ${l.note}` : ''}
          </p>
        </div>
        {l.enough ? (
          <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
            한도 충분
          </span>
        ) : (
          <span className="shrink-0 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-danger">
            {short(need - l.limit)} 부족
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Fact label="최대 한도" value={short(l.limit)} />
        <Fact label="첫 달 갚는 돈" value={short(l.firstPayment)} warn={l.firstPayment > monthly} />
        <Fact label="금리 (어림)" value={`${l.rate.toFixed(2)}%`} />
        <Fact label="기간 · 방식" value={`${l.years}년 · ${METHOD_LABEL[l.method]}`} />
      </div>
      {l.deduction > 0 && (
        <p className="mt-2 text-[12px] text-cap">
          연말정산 주담대 이자 소득공제 최대{' '}
          <b className="font-bold text-ink">{short(l.deduction)}</b>/년
        </p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-[12.5px] font-bold text-brand">
          한도는 셋 중 가장 작은 값
        </summary>
        <div className="mt-1.5 space-y-1">
          {l.parts.map((p) => {
            const finite = Number.isFinite(p.amount)
            const isMin = finite && Math.abs(p.amount - l.limit) < 1
            return (
              <div key={p.label} className="flex items-center gap-2 text-[12px] text-sub">
                <span className="w-[46%] shrink-0">{p.label}</span>
                <span
                  className={`block h-1.5 rounded-full ${isMin ? 'bg-brand' : 'bg-line'}`}
                  style={{
                    width: `${finite && max > 0 ? Math.max(4, (p.amount / max) * 30) : 30}%`,
                  }}
                />
                <span className="tnum">{finite ? short(p.amount) : '제한 없음'}</span>
              </div>
            )
          })}
        </div>
      </details>
      {l.plans && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[12.5px] font-bold text-brand">
            상환 방식 비교
          </summary>
          <table className="mt-1.5 w-full text-[12px]">
            <thead>
              <tr className="text-cap">
                <th className="py-1 text-left font-medium" />
                <th className="py-1 text-right font-medium">첫 달</th>
                <th className="py-1 text-right font-medium">마지막 달</th>
                <th className="py-1 text-right font-medium">총 이자</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m} className="border-t border-bg text-sub">
                  <td className="py-1">{METHOD_LABEL[m]}</td>
                  <td className="tnum py-1 text-right">
                    {formatComma(Math.round(l.plans![m].first / 1000) * 1000)}
                  </td>
                  <td className="tnum py-1 text-right">
                    {formatComma(Math.round(l.plans![m].last / 1000) * 1000)}
                  </td>
                  <td className="tnum py-1 text-right">{short(l.plans![m].interest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11.5px] leading-relaxed text-cap">
            강의 추천 순서: 체증식 → 원리금균등 → 원금균등. 대출은 시간에 녹이고 집 팔 때 갚아요.
          </p>
        </details>
      )}
      <div className="mt-2">
        <Go to={ASK_LINK[l.ask]} />
      </div>
    </div>
  )
}

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-btn bg-bg px-3 py-2">
      <p className="text-[11px] text-cap">{label}</p>
      <p className={`tnum text-[14.5px] font-bold ${warn ? 'text-danger' : 'text-ink'}`}>{value}</p>
    </div>
  )
}
