import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft } from 'lucide-react'
import { useLedgerStore } from '../lib/store'
import * as db from '../lib/db'

const PRICE = '30,000원'

/** 리포트에 들어가는 것 */
const CONTENTS = [
  '우리집 한 줄 진단',
  '순자산과 10년 목표까지 남은 거리',
  '모아불리 전체 가구 중 우리집 위치',
  '지금 제일 급한 것 한 가지',
  '다음 3개월에 할 일 세 가지',
  '통장 쪼개기 · 보험 · 청약 점검',
]

/** 동의를 받을 때 정확히 무엇을 보는지 — 두루뭉술하게 적지 않는다 */
const DATA_SCOPE = [
  '월별 수입 · 지출 · 저축 내역',
  '자산과 부채 목록, 순자산 변화',
  '비정기 지출 기록',
  '10년 목표 금액',
]

const STATUS_LABEL: Record<db.ReportRequest['status'], string> = {
  requested: '신청 접수됨',
  paid: '결제 확인됨',
  writing: '작성 중',
  done: '전달 완료',
  canceled: '취소됨',
}

export default function Report() {
  const navigate = useNavigate()
  const { householdId } = useLedgerStore()

  const [requests, setRequests] = useState<db.ReportRequest[] | null>(null)
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    if (!householdId) {
      setRequests([])
      return
    }
    db.fetchReportRequests(householdId)
      .then(setRequests)
      .catch(() => setRequests([]))
  }
  useEffect(load, [householdId])

  // 살아있는 신청 = 아직 철회하지 않았고 취소되지 않은 것
  const active = requests?.find((r) => !r.revokedAt && r.status !== 'canceled') ?? null

  const submit = async () => {
    if (!householdId || !agreed || !contact.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await db.insertReportRequest(householdId, {
        contact: contact.trim(),
        note: note.trim() || undefined,
      })
      setContact('')
      setNote('')
      setAgreed(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '신청에 실패했어요. 잠시 후 다시 시도해 주세요')
    }
    setBusy(false)
  }

  const revoke = async (id: string) => {
    setBusy(true)
    try {
      await db.revokeReportConsent(id)
      load()
    } catch {
      setError('철회에 실패했어요. 잠시 후 다시 시도해 주세요')
    }
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="mx-auto w-full max-w-app">
        <div className="flex items-center gap-1 px-3 pt-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-sub active:bg-line"
            aria-label="뒤로"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold text-ink">우리 부부 맞춤 리포트</h1>
        </div>

        <div className="space-y-4 px-5 pt-3">
          <p className="text-[13.5px] leading-relaxed text-sub">
            결영이네가 <b className="text-ink">우리집 숫자를 직접 보고</b> 씁니다. 자동으로 만드는 게
            아니라 사람이 읽고 쓰는 거라, 한 달에 <b className="text-ink">10팀</b>만 받아요.
          </p>

          {/* 무엇이 들어가는지 */}
          <div className="rounded-card bg-card px-5 py-4 shadow-card">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold text-ink">리포트에 담기는 것</h2>
              <span className="tnum text-[16px] font-extrabold text-brand">{PRICE}</span>
            </div>
            <ul className="space-y-2">
              {CONTENTS.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-sub">
                  <Check size={16} className="mt-0.5 shrink-0 text-brand" />
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-cap">
              1:1 상담을 신청하시면 리포트 금액만큼 빼드려요.
            </p>
          </div>

          {active ? (
            /* 이미 신청함 — 상태와 철회 */
            <div className="rounded-card bg-card px-5 py-4 shadow-card">
              <h2 className="text-[15px] font-bold text-ink">신청하셨어요</h2>
              <p className="mt-1.5 text-[13.5px] text-sub">
                상태: <b className="text-ink">{STATUS_LABEL[active.status]}</b>
              </p>
              <p className="mt-1 text-[12.5px] text-cap">
                받으실 곳: {active.contact} · 동의{' '}
                {new Date(active.consentAt).toLocaleDateString('ko-KR')}
              </p>
              <button
                onClick={() => revoke(active.id)}
                disabled={busy}
                className="mt-3 h-11 w-full rounded-btn bg-bg text-[13.5px] font-bold text-sub active:bg-line disabled:opacity-50"
              >
                신청 취소하고 열람 동의 철회하기
              </button>
              <p className="mt-2 text-[12px] leading-relaxed text-cap">
                철회하시면 저희는 더 이상 가계부를 열어보지 않아요.
              </p>
            </div>
          ) : (
            <>
              {/* 데이터 열람 동의 */}
              <div className="rounded-card bg-card px-5 py-4 shadow-card">
                <h2 className="text-[15px] font-bold text-ink">데이터 공유 동의</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
                  리포트를 쓰려면 결영이네가 우리집 가계부를 열어봐야 해요. 보는 건 이것뿐입니다.
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {DATA_SCOPE.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-[13px] text-sub">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      {d}
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-[12px] leading-relaxed text-cap">
                  매일 남기신 <b className="font-semibold">고백 기록은 보지 않아요.</b> 리포트를
                  드린 뒤에는 열람하지 않고, 언제든 이 화면에서 철회하실 수 있어요.
                </p>

                <button
                  onClick={() => setAgreed((v) => !v)}
                  className={`mt-3 flex w-full items-center gap-2.5 rounded-btn border px-3.5 py-3 text-left transition-colors ${
                    agreed ? 'border-brand bg-brand/5' : 'border-line bg-white'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      agreed ? 'border-brand bg-brand text-white' : 'border-line bg-white'
                    }`}
                  >
                    {agreed && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="text-[13.5px] font-semibold text-ink">
                    위 내용에 동의하고 가계부 열람을 허용합니다
                  </span>
                </button>
              </div>

              {/* 연락처 */}
              <div className="rounded-card bg-card px-5 py-4 shadow-card">
                <h2 className="text-[15px] font-bold text-ink">어디로 보내드릴까요?</h2>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="카톡 닉네임 또는 이메일"
                  className="mt-2.5 w-full rounded-btn border border-line bg-white px-3.5 py-3 text-[14px] text-ink outline-none focus:border-brand placeholder:text-cap"
                />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="특히 궁금한 점이 있으면 적어주세요 (선택)"
                  className="mt-2 w-full resize-none rounded-btn border border-line bg-white px-3.5 py-3 text-[14px] text-ink outline-none focus:border-brand placeholder:text-cap"
                />
              </div>

              {error && <p className="px-1 text-[13px] font-bold text-danger">{error}</p>}

              <button
                onClick={submit}
                disabled={!agreed || !contact.trim() || busy}
                className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark disabled:opacity-40"
              >
                {busy ? '보내는 중…' : '신청하기'}
              </button>
              <p className="px-1 text-[12px] leading-relaxed text-cap">
                신청하시면 결영이네가 연락드려요. 결제는 그때 안내해 드립니다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
