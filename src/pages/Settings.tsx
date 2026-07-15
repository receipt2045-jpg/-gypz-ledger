import { useRef, useState } from 'react'
import { Download, Upload, RotateCcw, X, Plus } from 'lucide-react'
import Card from '../components/Card'
import AmountInput from '../components/AmountInput'
import { useLedgerStore } from '../lib/store'
import { abbreviateKRW } from '../lib/format'
import { GROUP_LABEL, GROUP_ORDER } from '../lib/constants'
import type { AppData, CategoryGroup } from '../types'

export default function Settings() {
  const {
    profile,
    categories,
    updateProfile,
    addCategory,
    removeCategory,
    resetData,
    importData,
    exportData,
  } = useLedgerStore()
  const fileRef = useRef<HTMLInputElement>(null)
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
    if (confirm('모든 데이터를 초기화하고 예시 데이터로 되돌릴까요?')) {
      resetData()
      alert('초기화되었어요.')
    }
  }

  return (
    <div className="animate-fade-up space-y-4">
      <header className="px-1 pt-2">
        <h1 className="text-[18px] font-bold text-ink">설정</h1>
      </header>

      {/* 프로필 */}
      <Card>
        <h2 className="mb-3 text-[15px] font-bold text-ink">부부 정보</h2>
        <div className="space-y-3">
          <Field label="구성원 1">
            <input
              type="text"
              value={profile.member1Name}
              onChange={(e) => updateProfile({ member1Name: e.target.value })}
              className="w-full rounded-btn border border-line bg-white px-3.5 py-3 text-right text-[15px] font-semibold text-ink outline-none focus:border-brand"
            />
          </Field>
          <Field label="구성원 2">
            <input
              type="text"
              value={profile.member2Name}
              onChange={(e) => updateProfile({ member2Name: e.target.value })}
              className="w-full rounded-btn border border-line bg-white px-3.5 py-3 text-right text-[15px] font-semibold text-ink outline-none focus:border-brand"
            />
          </Field>
          <Field label="10년 목표 순자산" hint={abbreviateKRW(profile.targetNetWorth)}>
            <AmountInput
              value={profile.targetNetWorth}
              onChange={(n) => updateProfile({ targetNetWorth: n })}
            />
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

      <p className="pb-2 text-center text-[12px] text-cap">우리집 가계부 · 프로토타입 v0.1</p>
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
