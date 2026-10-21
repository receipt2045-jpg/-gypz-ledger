import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronLeft } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import SiteFooter from '../components/SiteFooter'
import {
  CONSULT_KINDS,
  CONSULT_LEVELS,
  CONSULT_PLANS,
  CONSULT_REGIONS,
  HOME_TYPES,
  createConsultRequest,
  type ConsultPlan,
} from '../lib/qna'

/**
 * 1:1 상담 신청 (2026-10-21) — 상담 페이지는 나중에, 신청서부터.
 * 질문은 원팀 '[신혼집] 1:1 상담 신청서'(Tally)를 옮기고, 지금 사는 곳·가진 자산을 더했다.
 * 로그인 없이도 보낼 수 있다(링크로 나눌 수 있게). 받은 신청은 결영이네만 본다(/admin/consult).
 * 결제는 여기서 받지 않는다 — 연락해서 일정과 함께 안내한다.
 */
export default function Consult() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [plan, setPlan] = useState<ConsultPlan | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [kinds, setKinds] = useState<string[]>([])
  const [homeNow, setHomeNow] = useState('')
  const [homeType, setHomeType] = useState<string | null>(null)
  const [cash, setCash] = useState(0)
  const [maxBudget, setMaxBudget] = useState(0)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [maxInterest, setMaxInterest] = useState(0)
  const [assets, setAssets] = useState('')
  const [kids, setKids] = useState('')
  const [parents, setParents] = useState('')
  const [regions, setRegions] = useState<string[]>([])
  const [work, setWork] = useState('')
  const [complexes, setComplexes] = useState('')
  const [topic, setTopic] = useState('')
  const [time, setTime] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

  const submit = async () => {
    const need: [boolean, string][] = [
      [!!name.trim(), '닉네임을 적어 주세요'],
      [contact.trim().length >= 3, '연락받을 곳을 적어 주세요'],
      [!!plan, '상담 종류를 골라 주세요'],
      [!!level, '부동산 공부 정도를 골라 주세요'],
      [kinds.length > 0, '희망 상담 유형을 골라 주세요'],
      [!!homeNow.trim() && !!homeType, '지금 사는 곳을 적어 주세요'],
      [cash > 0, '집에 쓸 수 있는 현금을 적어 주세요'],
      [maxBudget > 0, '대출 포함 최대 예산을 적어 주세요'],
      [monthlyIncome > 0, '월급 실수령액(부부 합산)을 적어 주세요'],
      [maxInterest > 0, '한 달에 낼 수 있는 이자를 적어 주세요'],
      [!!kids.trim(), '자녀 계획을 적어 주세요'],
      [!!parents.trim(), '양가 위치를 적어 주세요'],
      [regions.length > 0, '관심 지역을 골라 주세요'],
      [!!work.trim(), '직장 위치를 적어 주세요'],
      [topic.trim().length >= 5, '고민 내용을 조금 더 적어 주세요'],
      [!!time.trim(), '상담 가능한 날짜와 시간을 적어 주세요'],
      [agreed, '개인정보 수집·이용에 동의해 주세요'],
    ]
    const miss = need.find(([ok]) => !ok)
    if (miss) return setError(miss[1])
    setBusy(true)
    setError('')
    try {
      await createConsultRequest({
        name,
        contact,
        plan: plan!,
        region: regions.join(', '),
        topic,
        preferredTime: time,
        details: {
          level: level!,
          kinds,
          homeNow: homeNow.trim(),
          homeType: homeType!,
          cash,
          maxBudget,
          monthlyIncome,
          maxInterest,
          assets: assets.trim(),
          kids: kids.trim(),
          parents: parents.trim(),
          work: work.trim(),
          complexes: complexes.trim(),
        },
      })
      setDone(true)
    } catch {
      setError('보내지 못했어요. 잠시 뒤 다시 눌러 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const box =
    'w-full rounded-btn border border-line bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-brand placeholder:text-cap'
  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-[13px] font-bold ${on ? 'bg-ink text-white' : 'bg-bg text-sub'}`

  return (
    <div className="flex min-h-screen justify-center bg-bg">
      <div className="w-full max-w-app px-5 pb-16 pt-5 lg:max-w-[720px]">
        <button
          onClick={() => navigate(-1)}
          className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1 text-[14px] font-semibold text-sub active:bg-line"
        >
          <ChevronLeft size={18} /> 뒤로
        </button>

        {done ? (
          <div className="mt-6 rounded-card bg-white px-5 py-8 text-center shadow-card">
            <CheckCircle2 size={40} className="mx-auto text-brand" />
            <p className="mt-3 text-[18px] font-bold text-ink">신청 받았어요</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-sub">
              결영이네가 읽고 적어 주신 연락처로
              <br />
              일정과 결제 방법을 안내드릴게요.
            </p>
          </div>
        ) : (
          <div className="animate-fade-up mt-2 space-y-3">
            <header className="px-1">
              <p className="text-[12.5px] font-bold text-brand">결영이네</p>
              <h1 className="text-[22px] font-bold text-ink">1:1 상담 신청</h1>
              <p className="mt-1 text-[13.5px] leading-relaxed text-sub">
                우리집 상황을 자세히 적어 주실수록 상담이 알차져요. 일정을 맞춰 연락드려요.
              </p>
            </header>

            <div className="rounded-card bg-[#FFF9DB] px-4 py-3 text-[13px] leading-relaxed text-[#5C3B00]">
              1. 상담 내용은 참고만 해 주세요.
              <br />
              2. 투자의 책임은 본인에게 있습니다.
            </div>

            <Section title="상담 종류">
              <div className="space-y-2">
                {CONSULT_PLANS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPlan(p.key)}
                    aria-pressed={plan === p.key}
                    className={`flex w-full items-center justify-between rounded-btn border px-3.5 py-3 text-left ${
                      plan === p.key ? 'border-brand bg-brand/5' : 'border-line'
                    }`}
                  >
                    <span className="text-[14.5px] font-bold text-ink">{p.title}</span>
                    <span className="text-[12.5px] text-sub">{p.desc}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="기본 정보">
              <Field label="닉네임">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 30))}
                  className={box}
                />
              </Field>
              <Field label="연락받을 곳">
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value.slice(0, 60))}
                  placeholder="휴대폰 번호 또는 카카오톡 아이디"
                  className={box}
                />
              </Field>
              <Field label="부동산 공부 정도">
                <Chips
                  options={CONSULT_LEVELS}
                  value={level ? [level] : []}
                  onPick={setLevel}
                  chip={chip}
                />
              </Field>
              <Field label="희망 상담 유형 (여러 개 골라도 돼요)">
                <Chips
                  options={CONSULT_KINDS}
                  value={kinds}
                  onPick={(v) => setKinds((k) => toggle(k, v))}
                  chip={chip}
                />
              </Field>
            </Section>

            <Section title="자금 · 지금 상황">
              <Field label="지금 사는 곳">
                <input
                  value={homeNow}
                  onChange={(e) => setHomeNow(e.target.value.slice(0, 60))}
                  placeholder="예: 경기 화성시 동탄2동"
                  className={box}
                />
                <div className="mt-2">
                  <Chips
                    options={HOME_TYPES}
                    value={homeType ? [homeType] : []}
                    onPick={setHomeType}
                    chip={chip}
                  />
                </div>
              </Field>
              <Field label="신혼집에 쓸 수 있는 현금">
                <AmountInput value={cash} onChange={setCash} />
              </Field>
              <Field label="대출 포함 최대 예산">
                <AmountInput value={maxBudget} onChange={setMaxBudget} />
              </Field>
              <Field label="월급 실수령액 (부부 합산)">
                <AmountInput value={monthlyIncome} onChange={setMonthlyIncome} />
              </Field>
              <Field label="한 달에 낼 수 있는 이자 (최고)">
                <AmountInput value={maxInterest} onChange={setMaxInterest} />
              </Field>
              <Field label="지금 가진 자산 (선택)">
                <textarea
                  value={assets}
                  onChange={(e) => setAssets(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="예: 예적금 8,000만, 주식 2,000만, 전세보증금 2억, 청약 통장 10년"
                  className={`${box} resize-none leading-relaxed`}
                />
              </Field>
              <Field label="자녀 계획">
                <input
                  value={kids}
                  onChange={(e) => setKids(e.target.value.slice(0, 60))}
                  placeholder="예: 2년 안에 1명"
                  className={box}
                />
              </Field>
              <Field label="시댁 · 처가댁 위치">
                <input
                  value={parents}
                  onChange={(e) => setParents(e.target.value.slice(0, 60))}
                  placeholder="예: 시댁 수원, 처가 대전"
                  className={box}
                />
              </Field>
            </Section>

            <Section title="희망 집">
              <Field label="관심 지역 (여러 개 골라도 돼요)">
                <Chips
                  options={CONSULT_REGIONS}
                  value={regions}
                  onPick={(v) => setRegions((r) => toggle(r, v))}
                  chip={chip}
                />
                {regions.includes('그 외 지역') && (
                  <p className="mt-1.5 text-[12px] text-cap">
                    매매 상담은 서울·경기·인천·충청권(천안·청주·대전·세종)만 해요. 방향성 상담은
                    괜찮아요.
                  </p>
                )}
              </Field>
              <Field label="직장 위치">
                <input
                  value={work}
                  onChange={(e) => setWork(e.target.value.slice(0, 60))}
                  placeholder="예: 남편 판교, 아내 강남"
                  className={box}
                />
              </Field>
              <Field label="고민하는 단지가 있다면 (선택)">
                <input
                  value={complexes}
                  onChange={(e) => setComplexes(e.target.value.slice(0, 200))}
                  className={box}
                />
              </Field>
              <Field label="고민 내용">
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value.slice(0, 2000))}
                  rows={5}
                  placeholder="지금 가장 고민되는 것을 적어 주세요"
                  className={`${box} resize-none leading-relaxed`}
                />
              </Field>
            </Section>

            <Section title="상담 일정">
              <Field label="가능한 날짜와 시간 3개">
                <textarea
                  value={time}
                  onChange={(e) => setTime(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder={'예: 11/3(월) 21시, 11/5(수) 10시, 11/8(토) 13시'}
                  className={`${box} resize-none leading-relaxed`}
                />
              </Field>
            </Section>

            <div className="rounded-card bg-white p-4 text-[12.5px] leading-relaxed text-sub shadow-card">
              <p className="font-bold text-ink">개인정보 수집·이용 동의 (필수)</p>
              <p className="mt-1">
                모으는 것: 닉네임, 연락처, 사는 곳, 자금·자산 상황, 상담 내용 · 쓰는 곳: 상담 일정
                안내와 상담 진행 · 보관: 상담이 끝나고 1년 뒤 지워요. 동의하지 않으면 신청할 수
                없어요.
              </p>
              <label className="mt-2 flex items-center gap-2 font-bold text-ink">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="h-4 w-4 accent-[#3182F6]"
                />
                동의해요
              </label>
            </div>

            {error && <p className="px-1 text-[13px] text-danger">{error}</p>}
            <button
              onClick={submit}
              disabled={busy}
              className="h-[52px] w-full rounded-btn bg-brand text-[16px] font-bold text-white disabled:opacity-60"
            >
              {busy ? '보내는 중…' : '상담 신청하기'}
            </button>
            <p className="px-1 text-[12px] leading-relaxed text-cap">
              결제는 연락드릴 때 안내해요. 상담은 우리집 상황에 맞춘 의견이고, 결과를 보장하지
              않아요.
            </p>
          </div>
        )}
        <SiteFooter />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-card bg-white p-4 shadow-card">
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[13px] font-bold text-sub">{label}</p>
      {children}
    </div>
  )
}

function Chips({
  options,
  value,
  onPick,
  chip,
}: {
  options: string[]
  value: string[]
  onPick: (v: string) => void
  chip: (on: boolean) => string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onPick(o)}
          aria-pressed={value.includes(o)}
          className={chip(value.includes(o))}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
