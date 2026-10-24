import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import OneTeamCard from '../components/OneTeamCard'
import ShareMore from '../components/ShareMore'
import SiteFooter from '../components/SiteFooter'
import {
  BROKERS,
  DEFAULT_GOLD,
  GOLD_RULES,
  brokerCost,
  computeGold,
  shopCost,
  type GoldInput,
} from '../lib/gold'
import { useLedgerStore } from '../lib/store'

/** 원 → "976" (만원 단위, 반올림) */
const man = (n: number) => Math.round(n / 10_000).toLocaleString('ko-KR')
const comma = (n: number) => Math.round(n).toLocaleString('ko-KR')
/** "2026-10-23" → "10월 23일" */
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`

/** 표에서 비교하는 금액 */
const AMOUNT = 1_000_000
const YEAR_OPTIONS = [1, 3, 5] as const

/**
 * 금테크 정리 (2026-10-24) — 로그인 없이 열리는 공개 페이지. 아이 엄마들이 단톡·인스타에서 바로 들어온다.
 * 처음 금 사는 사람에게 "수수료 적게 사는 법" 하나만: 수수료 표 → 돌반지 13돈 예시 →
 * 나무증권 계좌 만들기 → 금 99.99 사기 → 세금 → 원팀프로젝트 배너(맨 끝).
 * 숫자는 lib/gold.ts 한 곳에만 둔다.
 */
export default function Gold() {
  const navigate = useNavigate()
  const [years, setYears] = useState<(typeof YEAR_OPTIONS)[number]>(3)
  const [v, setV] = useState<GoldInput>(DEFAULT_GOLD)
  const set = (patch: Partial<GoldInput>) => setV((prev) => ({ ...prev, ...patch }))
  const r = useMemo(() => computeGold(v), [v])
  const [namu, mirae] = BROKERS
  const namuCost = brokerCost(namu, AMOUNT, years)
  const miraeCost = brokerCost(mirae, AMOUNT, years)

  return (
    <div className="flex min-h-screen justify-center bg-bg break-keep">
      <div className="w-full max-w-app">
        <div className="space-y-4 px-4 pb-10 pt-6">
          <BackToApp />

          {/* ── 표지 */}
          <section className="rounded-card bg-ink px-6 py-9 text-white">
            <p className="text-[13px] font-bold text-white/60">결영이네 금테크 정리</p>
            <h1 className="mt-3 text-[30px] font-extrabold leading-[1.35]">
              금 처음 산다면,
              <br />
              수수료부터 보세요
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-white/80">
              같은 금 100만 원어치인데
              <br />
              어디서 사느냐에 따라 떼이는 돈이
              <br />
              <b className="font-bold text-[#FFD66B]">4천 원</b>일 수도,{' '}
              <b className="font-bold text-[#FFD66B]">15만 원</b>일 수도 있어요.
            </p>
          </section>

          {/* ── 1. 수수료 표 */}
          <Section no={1} title="100만 원어치 사고팔면 얼마 떼일까">
            <div className="flex gap-1.5" role="group" aria-label="얼마나 둘지">
              {YEAR_OPTIONS.map((y) => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  aria-pressed={years === y}
                  className={`flex-1 rounded-xl py-2.5 text-[15px] font-bold ${
                    years === y ? 'bg-ink text-white' : 'bg-bg text-sub'
                  }`}
                >
                  {y}년 두면
                </button>
              ))}
            </div>

            <table className="mt-4 w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12.5px] text-cap">
                  <th className="pb-2 font-semibold">어디서</th>
                  <th className="pb-2 font-semibold">떼는 것</th>
                  <th className="pb-2 text-right font-semibold">합계</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <FeeRow
                  name="금방"
                  fees={['살 때 부가세 10% + 공임', '팔 때 받는 값이 낮아요']}
                  total={`약 ${man(shopCost(AMOUNT))}만 원`}
                />
                <FeeRow
                  name="금 ETF"
                  fees={['주식 수수료 + 해마다 운용 보수', '오른 돈의 15.4% 세금']}
                  total="상품마다 달라요"
                />
                <FeeRow
                  name={mirae.name}
                  fees={['사고팔 때 0.165%씩', '보관료 하루 0.00022%']}
                  total={`${comma(miraeCost)}원`}
                  best={miraeCost < namuCost}
                />
                <FeeRow
                  name={namu.name}
                  fees={['사고팔 때 0.22%씩', '보관료 없음']}
                  total={`${comma(namuCost)}원`}
                  best={namuCost <= miraeCost}
                />
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-cap">
              금값은 그대로라고 보고, 수수료·보관료만 더했어요.
            </p>

            <div className="mt-4 rounded-2xl bg-ink px-5 py-4 text-white">
              <p className="text-[18px] font-extrabold leading-snug">
                오래 모을 거면 나무증권이 제일 적게 떼요
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">
                보관료가 없어서 오래 둘수록 차이가 커져요. 1~2년 지나면 미래에셋보다 적어요.
                <br />
                1년 안에 자주 사고팔 거면 미래에셋이 조금 더 싸요.
              </p>
            </div>
          </Section>

          {/* ── 2. 돌반지 13돈 예시 */}
          <Section no={2} title="돌반지 13돈으로 보면">
            <p className="text-[15px] leading-relaxed text-sub">
              {v.don}돈은 <b className="text-ink">{r.grams}g</b>이에요. 같은 무게를 사면
            </p>
            <div className="mt-3 space-y-2.5">
              <Row label="금방에서" value={`${man(r.shopBuy)}만 원`} note="공임 별도" />
              <Row label="나무증권에서" value={`${man(r.krxBuy)}만 원`} note="수수료 포함" />
            </div>
            <div className="mt-3 rounded-2xl bg-[#F2F7FF] px-5 py-4 text-center">
              <p className="text-[22px] font-extrabold text-brand">
                {man(r.buySaving)}만 원 덜 들어요
              </p>
            </div>
            <p className="mt-3 rounded-xl bg-bg px-4 py-3 text-[14px] leading-relaxed text-sub">
              ⚠️ 이미 받은 돌반지는 앱에서 팔 수 없어요. 앱에서 산 금만 앱에서 팔아요.
            </p>

            <details className="mt-4 rounded-xl border border-line px-4 py-3">
              <summary className="cursor-pointer text-[14px] font-bold text-sub">
                오늘 시세로 바꿔 보기
              </summary>
              <p className="mt-2 text-[13px] text-cap">
                처음 값은 {md(GOLD_RULES.updated)} 기준이에요. 금값은 매일 바뀌어요.
              </p>
              <div className="mt-3 space-y-4">
                <Field label="몇 돈?">
                  <AmountInput value={v.don} onChange={(don) => set({ don })} suffix="돈" />
                </Field>
                <Field label="금방 살 때 1돈" hint="금방이나 한국금거래소 '살 때' 값">
                  <AmountInput
                    value={v.shopBuyDon}
                    onChange={(shopBuyDon) => set({ shopBuyDon })}
                  />
                </Field>
                <Field label="앱 금 1g" hint="나무증권 금현물 화면의 현재가">
                  <AmountInput value={v.krxG} onChange={(krxG) => set({ krxG })} />
                </Field>
              </div>
            </details>
          </Section>

          {/* ── 3. 계좌 만들기 */}
          <Section no={3} title="나무증권 금 계좌 만들기">
            <p className="mb-3 text-[14px] text-sub">
              휴대폰과 신분증만 있으면 앱에서 바로 만들어요.
            </p>
            <ol className="space-y-3">
              <Step n={1} title="나무증권 앱 깔기">
                앱스토어·플레이스토어에서 &lsquo;나무증권&rsquo;을 찾아요. NH투자증권 앱이에요.
              </Step>
              <Step n={2} title="계좌개설에서 '금현물 계좌' 고르기">
                주식 계좌가 있어도 금은 계좌를 따로 만들어요.
              </Step>
              <Step n={3} title="본인 확인">
                휴대폰 인증 → 신분증 사진 찍기 → 내 은행 계좌로 1원이 들어오면 거기 적힌 숫자를
                넣어요.
              </Step>
              <Step n={4} title="간편 비밀번호 만들기">
                승인이 나면 바로 쓸 수 있어요.
              </Step>
            </ol>
          </Section>

          {/* ── 4. 금 99.99 사기 */}
          <Section no={4} title="금 99.99 사기">
            <ol className="space-y-3">
              <Step n={1} title="금현물 계좌에 돈 넣기">
                은행 앱에서 금현물 계좌번호로 보내요. 처음엔 금 1g 값(약 18만 원)이면 돼요.
              </Step>
              <Step n={2} title="'금 99.99_1kg' 고르기">
                이름은 1kg이어도 <b className="text-ink">1g씩</b> 살 수 있어요. 1kg은 나중에 금을
                꺼낼 때의 단위예요.
              </Step>
              <Step n={3} title="몇 g 살지 넣고 매수">
                수량은 g으로 넣어요. 가격은 지금 화면에 보이는 값 그대로 두면 돼요.
              </Step>
              <Step n={4} title="내 계좌에 g으로 들어와요">
                금은 거래소 금고에 그대로 있어요. 팔 때도 같은 화면에서 &lsquo;매도&rsquo;를 눌러요.
              </Step>
            </ol>
            <p className="mt-4 rounded-xl bg-bg px-4 py-3 text-[14px] leading-relaxed text-sub">
              🕘 평일 오전 9시 ~ 오후 3시 30분에만 사고팔 수 있어요.
            </p>
          </Section>

          {/* ── 5. 세금 */}
          <Section no={5} title="세금은 이것만">
            <div className="space-y-3">
              <Tax name="증권사 앱 (나무증권)">
                오른 만큼 팔아도 <b>세금이 없어요.</b>
                <span className="mt-1.5 block text-cap">
                  금을 실물로 꺼내면 부가세 10%와 꺼내는 수수료(1개 2만 원 안팎)가 붙어요. 1kg
                  종목은 1kg씩(미니금은 100g씩)만 꺼낼 수 있어요.
                </span>
              </Tax>
              <Tax name="금방">
                살 때 <b>부가세 10%</b>와 <b>공임</b>을 내고, 팔 때는 돌려받지 못해요.
              </Tax>
              <Tax name="금 ETF">
                오른 만큼 팔면 <b>15.4%</b>를 떼요. ISA·연금저축에 담으면 떼는 방식이 달라져요.
              </Tax>
            </div>
          </Section>

          {/* ── 다른 자료로 (2026-10-24) — 공유 링크로 들어온 사람이 이어서 보게 */}
          <ShareMore />

          {/* ── 원팀프로젝트 배너 */}
          <OneTeamCard onStory={() => navigate('/story')} />

          {/* ── 자료 출처 — 맨 끝 */}
          <div className="px-1 pt-2 text-[12px] leading-relaxed text-cap">
            <p className="font-semibold text-sub">자료 출처</p>
            <ul className="mt-1.5 space-y-1">
              <li>
                · 나무증권 — 금현물 온라인 매매수수료 0.2% + 부가세. 보관료는 수수료 안내에 없고,
                보관료 없는 곳으로 소개돼요(대한금융신문)
              </li>
              <li>
                · 미래에셋증권 — 금현물 온라인 매매수수료 0.15% + 부가세, 보관료 하루 0.0002% +
                부가세(표는 1년을 365일로 쳤어요)
              </li>
              <li>
                · 금방 — 한국금거래소 순금 1돈 {md(GOLD_RULES.updated)} 고시가, 살 때{' '}
                {comma(GOLD_RULES.shopBuyDon)}원(부가세 포함) · 팔 때{' '}
                {comma(GOLD_RULES.shopSellDon)}원. 가게마다 다르고 공임은 따로예요
              </li>
              <li>· 앱 시세 — KRX 금시장 1g 10월 19일 종가 {comma(GOLD_RULES.krxG)}원</li>
              <li>· 세금 — KRX 금시장 매매차익 비과세, 국내 금 ETF 매매차익 배당소득세 15.4%</li>
              <li>· 다른 증권사는 자료마다 숫자가 달라서 표에서 뺐어요</li>
            </ul>
            <p className="mt-3">
              {md(GOLD_RULES.updated)} 기준이에요. 수수료는 바뀔 수 있으니 계좌 만들기 전에 앱
              안내를 한 번 더 봐 주세요. 투자를 권하는 글이 아니에요.
            </p>
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  )
}

function Section({ no, title, children }: { no: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-card bg-card px-5 py-6 shadow-card">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[15px] font-extrabold text-white">
          {no}
        </span>
        <h2 className="text-[21px] font-extrabold leading-snug text-ink">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function FeeRow({
  name,
  fees,
  total,
  best = false,
}: {
  name: string
  fees: string[]
  total: string
  best?: boolean
}) {
  return (
    <tr className={`border-b border-line last:border-0 ${best ? 'bg-[#F2F7FF]' : ''}`}>
      <th scope="row" className="py-3 pl-1 pr-2 text-[15px] font-extrabold text-ink">
        {name}
        {best && (
          <span className="mt-0.5 block text-[11.5px] font-bold text-brand">👑 제일 적게</span>
        )}
      </th>
      <td className="py-3 pr-2 leading-relaxed text-sub">
        {fees.map((f) => (
          <span key={f} className="block">
            {f}
          </span>
        ))}
      </td>
      <td
        className={`tnum whitespace-nowrap py-3 pr-1 text-right font-extrabold ${
          best ? 'text-[16px] text-brand' : 'text-ink'
        }`}
      >
        {total}
      </td>
    </tr>
  )
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-xl bg-bg px-4 py-3.5">
      <span className="text-[15px] text-sub">
        {label}
        {note && <span className="ml-1.5 text-[12px] text-cap">{note}</span>}
      </span>
      <span className="tnum text-[19px] font-extrabold text-ink">{value}</span>
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

function Tax({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-bg p-4">
      <p className="text-[16px] font-extrabold text-ink">{name}</p>
      <p className="mt-1 text-[15px] leading-relaxed text-sub [&_b]:font-bold [&_b]:text-ink">
        {children}
      </p>
    </div>
  )
}

/** 앱 안에서 들어왔을 때만 — 단톡 링크로 처음 온 사람에겐 돌아갈 곳이 없다 */
function BackToApp() {
  const inApp = useLedgerStore((st) => st.status === 'ready')
  if (!inApp) return null
  return (
    <button
      onClick={() => window.history.back()}
      className="-ml-1 flex items-center gap-0.5 text-[14px] font-semibold text-sub"
    >
      <ChevronLeft size={19} />
      가계부로 돌아가기
    </button>
  )
}
