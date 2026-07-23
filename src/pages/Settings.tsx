import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check, ChevronRight, Download, KeyRound, LogOut, Upload, RotateCcw, Trash2, X, Plus } from 'lucide-react'
import Card from '../components/Card'
import AmountInput from '../components/AmountInput'
import { useLedgerStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { deleteMyAccount } from '../lib/db'
import { COLOR_STYLE, MEMBER_COLORS, memberColor, type MemberColor } from '../lib/memberColors'
import { abbreviateKRW } from '../lib/format'
import { GROUP_LABEL, GROUP_ORDER } from '../lib/constants'
import type { AppData, CategoryGroup } from '../types'

export default function Settings() {
  const {
    profile,
    categories,
    inviteCode,
    memberNo,
    updateProfile,
    addCategory,
    removeCategory,
    resetData,
    importData,
    exportData,
  } = useLedgerStore()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)
  const [newChild, setNewChild] = useState('')
  const [deleting, setDeleting] = useState(false)

  const withdraw = async () => {
    if (
      !confirm(
        '정말 탈퇴할까요? 내 계정과 모든 가계부·자산·고백 데이터가 삭제되며 되돌릴 수 없어요.\n\n(배우자가 함께 쓰고 있다면, 배우자 데이터는 유지됩니다)',
      )
    )
      return
    setDeleting(true)
    try {
      await deleteMyAccount()
      await supabase.auth.signOut()
      alert('탈퇴가 완료됐어요. 그동안 함께해 주셔서 고마웠어요 🤍')
    } catch (err) {
      setDeleting(false)
      alert(`탈퇴에 실패했어요: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const childNames = profile.childNames ?? []
  const addChild = () => {
    const name = newChild.trim()
    if (!name || childNames.includes(name)) return
    updateProfile({ childNames: [...childNames, name] })
    setNewChild('')
  }
  const removeChild = (name: string) =>
    updateProfile({ childNames: childNames.filter((c) => c !== name) })

  const copyInvite = async () => {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      alert(`초대 코드: ${inviteCode}`)
    }
  }
  const [newCat, setNewCat] = useState<Record<CategoryGroup, string>>({
    income: '',
    saving: '',
    investment: '',
    fixed: '',
    variable: '',
  })

  const handleExport = () => {
    const data = exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gypz-ledger-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as AppData
        if (!data.profile || !Array.isArray(data.ledgers)) throw new Error('형식 오류')
        importData(data)
        alert('가져오기 완료!')
      } catch {
        alert('올바른 백업 파일이 아니에요.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleReset = () => {
    if (confirm('모든 가계부 기록을 삭제할까요? 되돌릴 수 없어요.')) {
      resetData()
      alert('초기화되었어요.')
    }
  }

  return (
    <div className="animate-fade-up space-y-4">
      <header className="px-1 pt-2">
        <h1 className="text-[18px] font-bold text-ink">설정</h1>
      </header>

      {/* 부부 연결 */}
      <Card>
        <h2 className="mb-1 text-[15px] font-bold text-ink">부부 연결</h2>
        <p className="text-[13px] text-sub">
          {memberNo ? `내 계정은 구성원 ${memberNo}(${memberNo === 1 ? profile.member1Name : profile.member2Name})이에요. ` : ''}
          배우자에게 아래 초대 코드를 알려주면 함께 쓸 수 있어요.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="tnum flex-1 rounded-btn bg-bg px-4 py-3 text-center text-[18px] font-extrabold tracking-[0.25em] text-ink">
            {inviteCode ?? '—'}
          </span>
          <button
            onClick={copyInvite}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn bg-brand text-white active:bg-brand-dark"
            aria-label="초대 코드 복사"
          >
            {copied ? <Check size={19} /> : <Copy size={19} />}
          </button>
        </div>
      </Card>

      {/* 프로필 */}
      <Card>
        <h2 className="mb-3 text-[15px] font-bold text-ink">부부 정보</h2>
        <div className="space-y-3">
          <Field label="구성원 1" hint="예: 남편">
            <input
              type="text"
              value={profile.member1Name}
              onChange={(e) => updateProfile({ member1Name: e.target.value })}
              placeholder="남편"
              className="w-full rounded-btn border border-line bg-white px-3.5 py-3 text-right text-[15px] font-semibold text-ink outline-none focus:border-brand placeholder:font-normal placeholder:text-cap"
            />
            <ColorSwatches
              current={memberColor(1, profile)}
              onPick={(c) => updateProfile({ member1Color: c })}
            />
          </Field>
          <Field label="구성원 2" hint="예: 아내">
            <input
              type="text"
              value={profile.member2Name}
              onChange={(e) => updateProfile({ member2Name: e.target.value })}
              placeholder="아내"
              className="w-full rounded-btn border border-line bg-white px-3.5 py-3 text-right text-[15px] font-semibold text-ink outline-none focus:border-brand placeholder:font-normal placeholder:text-cap"
            />
            <ColorSwatches
              current={memberColor(2, profile)}
              onPick={(c) => updateProfile({ member2Color: c })}
            />
          </Field>
          <Field label="10년 목표 순자산" hint={abbreviateKRW(profile.targetNetWorth)}>
            <AmountInput
              value={profile.targetNetWorth}
              onChange={(n) => updateProfile({ targetNetWorth: n })}
            />
          </Field>
          <Field label="자녀" hint="자산 소유자로 쓸 수 있어요">
            {childNames.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {childNames.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-[13px] font-medium text-amber-600"
                  >
                    {c}
                    <button onClick={() => removeChild(c)} aria-label={`${c} 삭제`}>
                      <X size={13} className="text-amber-400" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newChild}
                onChange={(e) => setNewChild(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChild()}
                placeholder="자녀 이름 (예: 첫째, 자녀1)"
                className="flex-1 rounded-btn border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand placeholder:text-cap"
              />
              <button
                onClick={addChild}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-brand text-white active:bg-brand-dark"
                aria-label="자녀 추가"
              >
                <Plus size={18} />
              </button>
            </div>
          </Field>
        </div>
      </Card>

      {/* 카테고리 관리 */}
      <Card>
        <h2 className="mb-3 text-[15px] font-bold text-ink">카테고리 관리</h2>
        <div className="space-y-4">
          {GROUP_ORDER.map((g) => (
            <div key={g}>
              <p className="mb-1.5 text-[13px] font-semibold text-sub">{GROUP_LABEL[g]}</p>
              <div className="flex flex-wrap gap-1.5">
                {categories[g].map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full bg-bg px-3 py-1.5 text-[13px] font-medium text-ink"
                  >
                    {c}
                    <button onClick={() => removeCategory(g, c)} aria-label={`${c} 삭제`}>
                      <X size={13} className="text-cap" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                <input
                  type="text"
                  value={newCat[g]}
                  onChange={(e) => setNewCat((s) => ({ ...s, [g]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCat[g].trim()) {
                      addCategory(g, newCat[g])
                      setNewCat((s) => ({ ...s, [g]: '' }))
                    }
                  }}
                  placeholder="새 카테고리"
                  className="flex-1 rounded-btn border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand placeholder:text-cap"
                />
                <button
                  onClick={() => {
                    if (newCat[g].trim()) {
                      addCategory(g, newCat[g])
                      setNewCat((s) => ({ ...s, [g]: '' }))
                    }
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-brand text-white active:bg-brand-dark"
                  aria-label="추가"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 데이터 관리 */}
      <Card>
        <h2 className="mb-3 text-[15px] font-bold text-ink">데이터 관리</h2>
        <div className="space-y-2">
          <button
            onClick={handleExport}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-bg text-[15px] font-semibold text-ink active:bg-line"
          >
            <Download size={18} /> JSON 내보내기
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-bg text-[15px] font-semibold text-ink active:bg-line"
          >
            <Upload size={18} /> JSON 가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={handleReset}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-danger/10 text-[15px] font-semibold text-danger active:bg-danger/20"
          >
            <RotateCcw size={18} /> 데이터 초기화
          </button>
        </div>
      </Card>

      {/* 계정 */}
      <Card>
        <h2 className="mb-3 text-[15px] font-bold text-ink">계정</h2>
        <div className="space-y-2">
          <PasswordForm />
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-bg text-[15px] font-semibold text-ink active:bg-line"
          >
            <LogOut size={18} /> 로그아웃
          </button>
          <button
            onClick={withdraw}
            disabled={deleting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-danger/10 text-[15px] font-semibold text-danger active:bg-danger/20 disabled:opacity-50"
          >
            <Trash2 size={18} /> {deleting ? '탈퇴 처리 중…' : '회원 탈퇴'}
          </button>
        </div>
      </Card>

      {/* 약관·정책 */}
      <Card>
        <h2 className="mb-3 text-[15px] font-bold text-ink">약관·정책</h2>
        <div className="divide-y divide-line/70">
          {[
            { label: '개인정보처리방침', to: '/legal/privacy' },
            { label: '이용약관', to: '/legal/terms' },
          ].map((it) => (
            <button
              key={it.to}
              onClick={() => navigate(it.to)}
              className="flex w-full items-center justify-between py-3 text-left active:opacity-60"
            >
              <span className="text-[15px] text-ink">{it.label}</span>
              <ChevronRight size={18} className="text-cap" />
            </button>
          ))}
        </div>
      </Card>

      <p className="pb-2 text-center text-[12px] text-cap">모아불리 · v1.0</p>
    </div>
  )
}

// 팝업(prompt) 없이 화면 안에서 비밀번호를 설정하는 폼
function PasswordForm() {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (busy) return
    if (pw.length < 6) {
      setMsg({ text: '비밀번호는 6자 이상이어야 해요.', ok: false })
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) {
      const text = error.message.includes('different from the old')
        ? '기존과 같은 비밀번호예요. 다른 걸로 정해주세요.'
        : `실패: ${error.message}`
      setMsg({ text, ok: false })
    } else {
      setMsg({ text: '✅ 비밀번호가 설정됐어요. 이제 어디서든 이메일+비밀번호로 로그인하세요!', ok: true })
      setPw('')
      setOpen(false)
    }
  }

  return (
    <div className="space-y-2">
      {open ? (
        <div className="space-y-2 rounded-btn bg-bg p-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="새 비밀번호 (6자 이상)"
            autoComplete="new-password"
            className="w-full rounded-btn border border-line bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-brand placeholder:text-cap"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setOpen(false)
                setPw('')
                setMsg(null)
              }}
              className="h-11 flex-1 rounded-btn bg-white text-[14px] font-semibold text-sub active:bg-line"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={busy || pw.length < 6}
              className="h-11 flex-1 rounded-btn bg-brand text-[14px] font-bold text-white active:bg-brand-dark disabled:opacity-40"
            >
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setOpen(true)
            setMsg(null)
          }}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-bg text-[15px] font-semibold text-ink active:bg-line"
        >
          <KeyRound size={18} /> 비밀번호 설정·변경
        </button>
      )}
      {msg && (
        <p className={`text-[13px] ${msg.ok ? 'text-brand' : 'text-danger'}`}>{msg.text}</p>
      )}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[13px] font-medium text-sub">{label}</label>
        {hint && <span className="text-[12px] text-cap">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

/** 아바타 색상 선택 (6색 스와치) */
function ColorSwatches({
  current,
  onPick,
}: {
  current: MemberColor
  onPick: (c: MemberColor) => void
}) {
  return (
    <div className="mt-2 flex gap-2">
      {MEMBER_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          aria-label={`색상 ${c}`}
          className={`h-7 w-7 rounded-full ${COLOR_STYLE[c].dot} transition-transform active:scale-90 ${
            current === c ? 'ring-2 ring-ink ring-offset-2' : ''
          }`}
        />
      ))}
    </div>
  )
}
