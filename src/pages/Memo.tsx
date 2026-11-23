import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Pin, Trash2 } from 'lucide-react'
import { useLedgerStore } from '../lib/store'
import { useMemos } from '../lib/useMemos'
import { MEMO_MAX, type Memo as MemoRow } from '../lib/memoDb'
import { memberStyle } from '../lib/memberColors'

/**
 * 우리집 메모 (2026-11-24) — 2026-11-13 의견: "메모 탭이 있으면 좋겠어요. 가계부 관련된 메모들만 따로 모아불리에 작성하고 싶어요."
 * 부부가 같이 보고 같이 고친다. 고정(📌)한 메모가 맨 위, 나머지는 최근에 고친 순.
 * 가계부 탭 '메모' 칸과 PC 왼쪽 메뉴에서 들어온다.
 */
export default function Memo() {
  const navigate = useNavigate()
  const profile = useLedgerStore((s) => s.profile)
  const names: [string, string] = [profile.member1Name, profile.member2Name]
  const memo = useMemos()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const add = async () => {
    if (!draft.trim() || saving) return
    setSaving(true)
    setMsg(null)
    try {
      await memo.add(draft)
      setDraft('')
    } catch {
      setMsg('저장하지 못했어요. 잠시 뒤 다시 해 주세요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-up space-y-4 pb-6">
      <div className="flex items-center gap-1 pt-2">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink active:bg-line lg:hidden"
          aria-label="뒤로"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-[20px] font-extrabold text-ink">우리집 메모</h1>
      </div>

      {/* 쓰기 */}
      <div className="rounded-card bg-card px-4 py-4 shadow-card">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MEMO_MAX))}
          placeholder={
            '가계부 하면서 떠오른 걸 적어 두세요\n예: 12월엔 보험료 갱신, 통신비 알뜰폰으로 바꾸기'
          }
          aria-label="새 메모"
          rows={4}
          className="w-full resize-none rounded-btn border border-line bg-white px-3 py-2.5 text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-cap/70 focus:border-brand"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[12px] text-danger">{msg}</span>
          <button
            onClick={() => void add()}
            disabled={!draft.trim() || saving}
            className="h-10 shrink-0 rounded-btn bg-brand px-5 text-[14px] font-bold text-white active:bg-brand-dark disabled:opacity-40"
          >
            {saving ? '저장 중…' : '메모 남기기'}
          </button>
        </div>
      </div>

      {/* 목록 */}
      {memo.status === 'error' ? (
        <div className="rounded-card bg-card px-5 py-4 text-[13px] text-sub shadow-card">
          메모를 불러오지 못했어요.{' '}
          <button onClick={() => void memo.reload()} className="font-bold text-brand">
            다시 불러오기
          </button>
        </div>
      ) : memo.status === 'ready' && memo.memos.length === 0 ? (
        <p className="px-1 text-[13px] text-sub">
          아직 메모가 없어요 · 적어 두면 배우자도 같이 볼 수 있어요
        </p>
      ) : (
        <div className="space-y-2.5">
          {memo.memos.map((m) =>
            editing === m.id ? (
              <EditMemo
                key={m.id}
                memo={m}
                onCancel={() => setEditing(null)}
                onSave={async (body) => {
                  await memo.update(m.id, { body })
                  setEditing(null)
                }}
              />
            ) : (
              <MemoCard
                key={m.id}
                memo={m}
                writer={names[m.memberNo - 1]}
                badge={memberStyle(m.memberNo, profile).badge}
                onEdit={() => setEditing(m.id)}
                onPin={() => void memo.update(m.id, { pinned: !m.pinned })}
                onRemove={() => {
                  if (window.confirm('이 메모를 지울까요?')) void memo.remove(m.id)
                }}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

const when = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

function MemoCard({
  memo,
  writer,
  badge,
  onEdit,
  onPin,
  onRemove,
}: {
  memo: MemoRow
  writer: string
  badge: string
  onEdit: () => void
  onPin: () => void
  onRemove: () => void
}) {
  return (
    <div
      className={`rounded-card px-4 py-3.5 shadow-card ${memo.pinned ? 'bg-amber-50' : 'bg-card'}`}
    >
      <button
        onClick={onEdit}
        aria-label="메모 고치기"
        className="block w-full whitespace-pre-wrap break-words text-left text-[14.5px] leading-relaxed text-ink active:opacity-60"
      >
        {memo.body}
      </button>
      <div className="mt-2.5 flex items-center gap-2 text-[12px] text-cap">
        <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${badge}`}>
          {writer}
        </span>
        <span className="tnum">
          {when(memo.updatedAt)}
          {memo.updatedAt.slice(0, 16) !== memo.createdAt.slice(0, 16) && ' 고침'}
        </span>
        <span className="flex-1" />
        <button
          onClick={onPin}
          aria-label={memo.pinned ? '고정 풀기' : '맨 위에 고정'}
          aria-pressed={memo.pinned}
          className={`-m-1.5 p-1.5 ${memo.pinned ? 'text-amber-600' : 'text-cap active:text-ink'}`}
        >
          <Pin size={15} />
        </button>
        <button
          onClick={onRemove}
          aria-label="메모 지우기"
          className="-m-1.5 p-1.5 text-cap active:text-danger"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

function EditMemo({
  memo,
  onSave,
  onCancel,
}: {
  memo: MemoRow
  onSave: (body: string) => Promise<void>
  onCancel: () => void
}) {
  const [body, setBody] = useState(memo.body)
  const [saving, setSaving] = useState(false)
  return (
    <div className="rounded-card bg-card px-4 py-3.5 shadow-card">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MEMO_MAX))}
        aria-label="메모 고치기 칸"
        rows={Math.min(10, Math.max(3, body.split('\n').length + 1))}
        autoFocus
        className="w-full resize-none rounded-btn border border-brand bg-white px-3 py-2.5 text-[14.5px] leading-relaxed text-ink outline-none"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={onCancel}
          className="h-10 flex-1 rounded-btn bg-bg text-[13.5px] font-bold text-sub active:bg-line"
        >
          취소
        </button>
        <button
          onClick={async () => {
            if (!body.trim() || saving) return
            setSaving(true)
            try {
              await onSave(body)
            } finally {
              setSaving(false)
            }
          }}
          disabled={!body.trim() || saving}
          className="h-10 flex-[2] rounded-btn bg-brand text-[13.5px] font-bold text-white disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </div>
  )
}
