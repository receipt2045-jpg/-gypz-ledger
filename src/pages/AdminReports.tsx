import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Copy, Mail, RefreshCw, Sparkles } from 'lucide-react'
import Card from '../components/Card'
import { buildReportDraft } from '../lib/reportDraft'
import {
  listRequests,
  loadHousehold,
  markStatus,
  saveDraft,
  type AdminHouseholdData,
  type AdminRequest,
} from '../lib/reportAdmin'

const STATUS_LABEL: Record<AdminRequest['status'], string> = {
  requested: '신청됨',
  paid: '결제 확인',
  writing: '작성 중',
  done: '보냄',
  canceled: '취소',
}
const STATUS_TONE: Record<AdminRequest['status'], string> = {
  requested: 'bg-amber-100 text-amber-700',
  paid: 'bg-brand/10 text-brand',
  writing: 'bg-brand/10 text-brand',
  done: 'bg-line text-sub',
  canceled: 'bg-line text-cap',
}

/** 운영자 전용 — 리포트 신청 확인 → 초안 자동 생성 → 검토 → 발송 */
export default function AdminReports() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<AdminRequest[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<AdminRequest | null>(null)
  const [household, setHousehold] = useState<AdminHouseholdData | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setRequests(await listRequests())
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오지 못했어요.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  /** 신청 하나를 열어 데이터를 읽고, 저장된 초안이 없으면 자동 생성한다 */
  const open = async (r: AdminRequest) => {
    setSelected(r)
    setHousehold(null)
    setDraft('')
    setBusy(true)
    setError('')
    try {
      const data = await loadHousehold(r.id)
      setHousehold(data)
      setDraft(data.draft ?? buildReportDraft(data, data.benchmark))
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 읽지 못했어요.')
      setSelected(null)
    } finally {
      setBusy(false)
    }
  }

  const regenerate = () => {
    if (!household) return
    setDraft(buildReportDraft(household, household.benchmark))
    flash('초안을 다시 만들었어요')
  }

  const persist = async () => {
    if (!selected) return
    setBusy(true)
    try {
      await saveDraft(selected.id, draft)
      if (selected.status === 'requested' || selected.status === 'paid') {
        await markStatus(selected.id, 'writing')
      }
      await load()
      flash('저장했어요')
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  /** 본문을 복사하고 메일 앱을 연다 — 붙여넣기만 하면 발송 */
  const copyAndMail = async () => {
    if (!selected) return
    try {
      await navigator.clipboard.writeText(draft)
    } catch {
      flash('복사에 실패했어요. 본문을 직접 선택해 복사해 주세요')
    }
    const subject = encodeURIComponent(
      `[모아불리] ${selected.householdName} 님 맞춤 리포트`,
    )
    window.location.href = `mailto:${selected.email ?? ''}?subject=${subject}`
    flash('본문을 복사했어요. 메일에 붙여넣어 주세요')
  }

  const mark = async (status: AdminRequest['status']) => {
    if (!selected) return
    setBusy(true)
    try {
      await markStatus(selected.id, status)
      await load()
      setSelected({ ...selected, status })
      flash(`'${STATUS_LABEL[status]}'로 바꿨어요`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '바꾸지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="relative flex min-h-screen w-full max-w-app flex-col bg-bg px-5 pb-16 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        <div className="sticky top-0 z-10 -mx-5 bg-bg px-5 pb-3 pt-4">
          <button
            onClick={() => (selected ? setSelected(null) : navigate('/settings'))}
            className="mb-2 text-ink active:opacity-60"
            aria-label="뒤로"
          >
            <ChevronLeft size={26} />
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-[22px] font-extrabold text-ink">
              {selected ? selected.householdName : '리포트 신청'}
            </h1>
            {!selected && (
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1.5 text-[12px] font-bold text-brand active:bg-brand/20 disabled:opacity-40"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                새로고침
              </button>
            )}
          </div>
        </div>

        {error && (
          <Card className="mb-3">
            <p className="text-[14px] font-bold text-danger">{error}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
              운영자 계정으로 로그인했는지 확인해 주세요.
            </p>
          </Card>
        )}

        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-lg">
            {toast}
          </div>
        )}

        {/* ── 목록 ─────────────────────────────── */}
        {!selected && (
          <div className="space-y-2">
            {loading && <p className="py-10 text-center text-[13.5px] text-sub">불러오는 중…</p>}
            {requests?.length === 0 && !loading && (
              <p className="py-10 text-center text-[13.5px] text-sub">아직 신청이 없어요</p>
            )}
            {requests?.map((r) => (
              <button
                key={r.id}
                onClick={() => open(r)}
                className="w-full rounded-card bg-card p-4 text-left shadow-card active:bg-line"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-bold text-ink">{r.householdName}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p className="mt-1 truncate text-[12.5px] text-sub">{r.email ?? r.contact}</p>
                <p className="mt-0.5 text-[11.5px] text-cap">
                  {new Date(r.created_at).toLocaleDateString('ko-KR')}
                  {r.hasDraft && ' · 초안 있음'}
                  {r.revoked_at && ' · 동의 철회됨'}
                </p>
                {r.note && (
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-sub">
                    “{r.note}”
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── 초안 작성 ─────────────────────────── */}
        {selected && (
          <div className="space-y-3">
            <Card className="!p-4">
              <p className="text-[12.5px] text-sub">{selected.email ?? selected.contact}</p>
              {selected.note && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink">“{selected.note}”</p>
              )}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(['paid', 'writing', 'done'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => mark(st)}
                    disabled={busy || selected.status === st}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-bold disabled:opacity-40 ${
                      selected.status === st ? 'bg-brand text-white' : 'bg-bg text-sub active:bg-line'
                    }`}
                  >
                    {STATUS_LABEL[st]}
                  </button>
                ))}
              </div>
            </Card>

            {busy && !household && (
              <p className="py-8 text-center text-[13.5px] text-sub">가계부를 읽는 중…</p>
            )}

            {household && (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-[13px] font-bold text-cap">초안 (고쳐서 보내세요)</p>
                  <button
                    onClick={regenerate}
                    className="flex items-center gap-1 text-[12px] font-bold text-brand active:opacity-60"
                  >
                    <Sparkles size={13} /> 다시 만들기
                  </button>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={24}
                  className="w-full resize-y rounded-card border border-line bg-white px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink outline-none focus:border-brand"
                />
                <div className="flex gap-2">
                  <button
                    onClick={persist}
                    disabled={busy}
                    className="h-12 flex-1 rounded-btn bg-bg text-[14px] font-bold text-sub active:bg-line disabled:opacity-50"
                  >
                    저장
                  </button>
                  <button
                    onClick={copyAndMail}
                    disabled={busy}
                    className="flex h-12 flex-[2] items-center justify-center gap-1.5 rounded-btn bg-brand text-[14px] font-bold text-white active:bg-brand-dark disabled:opacity-50"
                  >
                    <Copy size={15} />
                    <Mail size={15} />
                    복사하고 메일 열기
                  </button>
                </div>
                <p className="px-1 text-[12px] leading-relaxed text-cap">
                  메일 앱이 열리면 붙여넣기(Ctrl+V) 후 보내세요. 보낸 뒤 위에서 '보냄'을 눌러주세요.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
