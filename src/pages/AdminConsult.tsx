import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { abbreviateKRW } from '../lib/format'
import {
  CONSULT_PLANS,
  fetchConsultRequests,
  setConsultStatus,
  type ConsultRequest,
} from '../lib/qna'

const won = (n: number) => (n > 0 ? abbreviateKRW(n) : '—')

const STATUS: { key: ConsultRequest['status']; label: string }[] = [
  { key: 'new', label: '새 신청' },
  { key: 'contacted', label: '연락함' },
  { key: 'done', label: '상담 끝' },
  { key: 'canceled', label: '취소' },
]

/** 받은 1:1 상담 신청 (2026-10-21) — 결영이네(staff)만 읽힌다. 다른 사람이 열면 빈 목록이다(서버가 막는다). */
export default function AdminConsult() {
  const navigate = useNavigate()
  const [list, setList] = useState<ConsultRequest[] | null>(null)
  const [error, setError] = useState(false)

  const load = () =>
    fetchConsultRequests()
      .then(setList)
      .catch(() => setError(true))
  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="flex min-h-screen justify-center bg-bg">
      <div className="w-full max-w-app space-y-3 px-5 pb-16 pt-5 lg:max-w-[720px]">
        <button
          onClick={() => navigate(-1)}
          className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1 text-[14px] font-semibold text-sub"
        >
          <ChevronLeft size={18} /> 뒤로
        </button>
        <h1 className="px-1 text-[20px] font-bold text-ink">받은 상담 신청</h1>
        {error && <p className="text-[13px] text-danger">불러오지 못했어요</p>}
        {list?.length === 0 && (
          <p className="rounded-card bg-white px-4 py-6 text-center text-[13px] text-sub">
            아직 신청이 없어요
          </p>
        )}
        {list?.map((r) => (
          <div key={r.id} className="space-y-1.5 rounded-card bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-bold text-ink">
                {r.name} · {r.region}
              </p>
              <span className="text-[12px] text-cap">
                {new Date(r.createdAt).toLocaleDateString('ko-KR')}
              </span>
            </div>
            <p className="text-[13px] font-bold text-brand">
              {CONSULT_PLANS.find((p) => p.key === r.plan)?.title} · {r.contact}
            </p>
            {r.preferredTime && (
              <p className="text-[12.5px] text-sub">편한 시간: {r.preferredTime}</p>
            )}
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{r.topic}</p>
            {r.details && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-btn bg-bg px-3 py-2.5 text-[12.5px]">
                {(
                  [
                    ['공부 정도', r.details.level],
                    ['상담 유형', r.details.kinds.join(', ')],
                    ['지금 사는 곳', `${r.details.homeNow} · ${r.details.homeType}`],
                    ['쓸 수 있는 현금', won(r.details.cash)],
                    ['대출 포함 최대', won(r.details.maxBudget)],
                    ['월 실수령(합산)', won(r.details.monthlyIncome)],
                    ['월 이자 최고', won(r.details.maxInterest)],
                    ['가진 자산', r.details.assets || '—'],
                    ['자녀 계획', r.details.kids],
                    ['양가 위치', r.details.parents],
                    ['직장', r.details.work],
                    ['고민 단지', r.details.complexes || '—'],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <Fragment key={k}>
                    <dt className="text-cap">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {STATUS.map((s) => (
                <button
                  key={s.key}
                  onClick={async () => {
                    await setConsultStatus(r.id, s.key)
                    await load()
                  }}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${
                    r.status === s.key ? 'bg-ink text-white' : 'bg-bg text-sub'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
