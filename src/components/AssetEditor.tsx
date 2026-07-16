import { useState } from 'react'
import { Plus, StickyNote, X } from 'lucide-react'
import AmountInput from './AmountInput'
import AssetIcon from './AssetIcon'
import { ASSET_GROUP_LABEL, ASSET_GROUP_ORDER } from '../lib/constants'
import type { AssetGroup, AssetItem } from '../types'

/** 자산·부채 목록 편집기 — 정산의 자산 스텝과 자산 등록 플로우에서 공용 */
export default function AssetEditor({
  assets,
  memberNames,
  defaultOwner,
  onChange,
  onNote,
  onAdd,
  onRemove,
}: {
  assets: AssetItem[]
  memberNames: [string, string]
  defaultOwner: string
  onChange: (id: string, v: number) => void
  onNote: (id: string, note: string) => void
  onAdd: (a: Omit<AssetItem, 'id'>) => void
  onRemove: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<'asset' | 'debt'>('asset')
  const [group, setGroup] = useState<AssetGroup>('cash')
  const [name, setName] = useState('')
  const [owner, setOwner] = useState(defaultOwner)
  const [amount, setAmount] = useState(0)

  const submit = () => {
    if (!name.trim() || amount <= 0) return
    onAdd({ kind, group, name: name.trim(), owner, amount })
    setName('')
    setAmount(0)
    setAdding(false)
  }

  const assetItems = assets.filter((it) => it.kind === 'asset')
  const debtItems = assets.filter((it) => it.kind === 'debt')

  return (
    <div className="space-y-3">
      {assets.length === 0 && (
        <p className="py-6 text-center text-[13px] text-cap">
          아래 버튼으로 통장·자산을 추가해 주세요
        </p>
      )}
      {assetItems.map((it) => (
        <AssetRow key={it.id} item={it} onChange={onChange} onNote={onNote} onRemove={onRemove} />
      ))}
      {debtItems.length > 0 && (
        <p className="px-1 pt-2 text-[13px] font-bold text-danger">부채</p>
      )}
      {debtItems.map((it) => (
        <AssetRow
          key={it.id}
          item={it}
          onChange={onChange}
          onNote={onNote}
          onRemove={onRemove}
          debt
        />
      ))}

      {adding ? (
        <div className="space-y-2 rounded-card bg-card p-4 shadow-card">
          <div className="flex gap-2">
            {(['asset', 'debt'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 rounded-btn py-2.5 text-[14px] font-semibold ${
                  kind === k
                    ? k === 'debt'
                      ? 'bg-danger text-white'
                      : 'bg-brand text-white'
                    : 'bg-bg text-sub'
                }`}
              >
                {k === 'asset' ? '자산' : '부채'}
              </button>
            ))}
          </div>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as AssetGroup)}
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
          >
            {ASSET_GROUP_ORDER.map((gr) => (
              <option key={gr} value={gr}>
                {ASSET_GROUP_LABEL[gr]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 (예: 토스 비상금)"
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand placeholder:text-cap"
          />
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
          >
            {['공동', ...memberNames].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <AmountInput value={amount} onChange={setAmount} placeholder="현재 잔액" />
          <div className="flex gap-2">
            <button
              onClick={() => setAdding(false)}
              className="h-11 flex-1 rounded-btn bg-bg text-[14px] font-semibold text-sub active:bg-line"
            >
              취소
            </button>
            <button
              onClick={submit}
              className="h-11 flex-1 rounded-btn bg-brand text-[14px] font-bold text-white active:bg-brand-dark"
            >
              추가
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-line bg-transparent text-[14px] font-semibold text-sub active:bg-white"
        >
          <Plus size={17} /> 자산·부채 추가
        </button>
      )}
    </div>
  )
}

function AssetRow({
  item,
  onChange,
  onNote,
  onRemove,
  debt,
}: {
  item: AssetItem
  onChange: (id: string, v: number) => void
  onNote: (id: string, note: string) => void
  onRemove: (id: string) => void
  debt?: boolean
}) {
  const [memoOpen, setMemoOpen] = useState(false)
  const memoVisible = memoOpen || !!item.note
  return (
    <div className="rounded-card bg-card px-4 py-3 shadow-card">
      <div className="flex items-center gap-2.5">
        <AssetIcon group={item.group} kind={item.kind} size={34} />
        <div className="w-[76px] shrink-0">
          <p className="truncate text-[14px] font-semibold text-ink">{item.name}</p>
          <p className="mt-0.5 text-[11px] text-cap">
            {debt ? '부채' : ASSET_GROUP_LABEL[item.group]}
            {item.owner ? ` · ${item.owner}` : ''}
          </p>
        </div>
        <AmountInput className="flex-1" value={item.amount} onChange={(v) => onChange(item.id, v)} />
        <button
          onClick={() => setMemoOpen((v) => !v)}
          className={`shrink-0 ${memoVisible ? 'text-brand' : 'text-cap'} active:text-brand`}
          aria-label="메모"
        >
          <StickyNote size={16} />
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="shrink-0 text-cap active:text-danger"
          aria-label="삭제"
        >
          <X size={18} />
        </button>
      </div>
      {memoVisible && (
        <input
          type="text"
          value={item.note ?? ''}
          onChange={(e) => onNote(item.id, e.target.value)}
          placeholder="메모 (선택)"
          className="mt-2 w-full rounded-btn border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand placeholder:text-cap"
        />
      )}
    </div>
  )
}
