import { useState } from 'react'
import { Pencil, Plus, StickyNote, X } from 'lucide-react'
import AmountInput from './AmountInput'
import AssetIcon from './AssetIcon'
import { ASSET_GROUP_LABEL, ASSET_GROUP_ORDER } from '../lib/constants'
import {
  CURRENCIES,
  CURRENCY_LABEL,
  CURRENCY_SYMBOL,
  krwOf,
  useFxRates,
  type Currency,
  type Rates,
} from '../lib/fx'
import { formatWon } from '../lib/format'
import type { AssetGroup, AssetItem } from '../types'

// 통화 입력칸의 접미사 (KRW는 '원', 외화는 기호)
const suffixOf = (c: Currency) => (c === 'KRW' ? '원' : CURRENCY_SYMBOL[c])

/** 자산·부채 목록 편집기 — 정산의 자산 스텝과 자산 등록 플로우에서 공용 */
export default function AssetEditor({
  assets,
  ownerOptions,
  defaultOwner,
  onChange,
  onNote,
  onUpdate,
  onAdd,
  onRemove,
}: {
  assets: AssetItem[]
  ownerOptions: string[] // 소유자 선택지 (공동·부부·자녀)
  defaultOwner: string
  onChange: (id: string, v: number) => void
  onNote: (id: string, note: string) => void
  onUpdate: (id: string, patch: Partial<Omit<AssetItem, 'id'>>) => void
  onAdd: (a: Omit<AssetItem, 'id'>) => void
  onRemove: (id: string) => void
}) {
  const rates = useFxRates()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<'asset' | 'debt'>('asset')
  const [group, setGroup] = useState<AssetGroup>('cash')
  const [name, setName] = useState('')
  const [owner, setOwner] = useState(defaultOwner)
  const [amount, setAmount] = useState(0)
  const [currency, setCurrency] = useState<Currency>('KRW')

  const submit = () => {
    if (!name.trim() || amount <= 0) return
    if (currency === 'KRW') {
      onAdd({ kind, group, name: name.trim(), owner, amount })
    } else {
      // 외화: 원금+통화 저장, 원화 환산액은 현재 환율로 스냅샷
      onAdd({
        kind,
        group,
        name: name.trim(),
        owner,
        currency,
        fxAmount: amount,
        amount: krwOf({ amount: 0, currency, fxAmount: amount }, rates),
      })
    }
    setName('')
    setAmount(0)
    setCurrency('KRW')
    setAdding(false)
  }

  const assetItems = assets.filter((it) => it.kind === 'asset')
  const debtItems = assets.filter((it) => it.kind === 'debt')

  return (
    <div className="space-y-3">
      {assets.length === 0 && (
        <div className="space-y-2 py-6 text-center">
          <p className="text-[13.5px] font-medium text-sub">아래 버튼으로 통장·자산을 추가해 주세요</p>
          <p className="text-[12.5px] leading-relaxed text-cap">
            예: 토스 비상금 300만 원 · 주택청약 500만 원
            <br />
            예: 전세보증금 1억 원 · 자동차 1,500만 원
            <br />
            빚도 함께 넣어요 — 예: 전세대출 8,000만 원
          </p>
        </div>
      )}
      {assetItems.map((it) => (
        <AssetRow
          key={it.id}
          item={it}
          ownerOptions={ownerOptions}
          rates={rates}
          onChange={onChange}
          onNote={onNote}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
      {debtItems.length > 0 && (
        <p className="px-1 pt-2 text-[13px] font-bold text-danger">부채</p>
      )}
      {debtItems.map((it) => (
        <AssetRow
          key={it.id}
          item={it}
          ownerOptions={ownerOptions}
          rates={rates}
          onChange={onChange}
          onNote={onNote}
          onUpdate={onUpdate}
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
            {ownerOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-[112px] shrink-0 rounded-btn border border-line bg-white px-2.5 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABEL[c]}
                </option>
              ))}
            </select>
            <AmountInput
              className="flex-1"
              value={amount}
              onChange={setAmount}
              placeholder="현재 잔액"
              suffix={suffixOf(currency)}
            />
          </div>
          {currency !== 'KRW' && amount > 0 && (
            <p className="px-1 text-right text-[12px] text-cap">
              실시간 환율 ≈ {formatWon(krwOf({ amount: 0, currency, fxAmount: amount }, rates))}
            </p>
          )}
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
  ownerOptions,
  rates,
  onChange,
  onNote,
  onUpdate,
  onRemove,
  debt,
}: {
  item: AssetItem
  ownerOptions: string[] // 소유자 선택지 (공동·부부·자녀)
  rates: Rates
  onChange: (id: string, v: number) => void
  onNote: (id: string, note: string) => void
  onUpdate: (id: string, patch: Partial<Omit<AssetItem, 'id'>>) => void
  onRemove: (id: string) => void
  debt?: boolean
}) {
  const [memoOpen, setMemoOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  // 수정 폼 임시값
  const [eKind, setEKind] = useState<'asset' | 'debt'>(item.kind)
  const [eGroup, setEGroup] = useState<AssetGroup>(item.group)
  const [eName, setEName] = useState(item.name)
  const [eOwner, setEOwner] = useState(item.owner ?? '공동')
  const memoVisible = memoOpen || !!item.note
  const ccy = (item.currency as Currency) ?? 'KRW'
  const foreign = ccy !== 'KRW'

  const startEdit = () => {
    setEKind(item.kind)
    setEGroup(item.group)
    setEName(item.name)
    setEOwner(item.owner ?? '공동')
    setEditing(true)
  }
  const confirmEdit = () => {
    if (!eName.trim()) return
    onUpdate(item.id, { kind: eKind, group: eGroup, name: eName.trim(), owner: eOwner })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-card bg-card p-4 shadow-card">
        <div className="flex gap-2">
          {(['asset', 'debt'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setEKind(k)}
              className={`flex-1 rounded-btn py-2.5 text-[14px] font-semibold ${
                eKind === k
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
          value={eGroup}
          onChange={(e) => setEGroup(e.target.value as AssetGroup)}
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
          value={eName}
          onChange={(e) => setEName(e.target.value)}
          placeholder="이름"
          className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand placeholder:text-cap"
        />
        <select
          value={eOwner}
          onChange={(e) => setEOwner(e.target.value)}
          className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
        >
          {ownerOptions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            className="h-11 flex-1 rounded-btn bg-bg text-[14px] font-semibold text-sub active:bg-line"
          >
            취소
          </button>
          <button
            onClick={confirmEdit}
            disabled={!eName.trim()}
            className="h-11 flex-1 rounded-btn bg-brand text-[14px] font-bold text-white active:bg-brand-dark disabled:opacity-40"
          >
            확인
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-card bg-card px-4 py-3 shadow-card">
      <div className="flex items-center gap-2.5">
        <AssetIcon group={item.group} kind={item.kind} size={34} />
        <button onClick={startEdit} className="w-[76px] shrink-0 text-left" aria-label="항목 수정">
          <p className="truncate text-[14px] font-semibold text-ink">{item.name}</p>
          <p className="mt-0.5 text-[11px] text-cap">
            {debt ? '부채' : ASSET_GROUP_LABEL[item.group]}
            {item.owner ? ` · ${item.owner}` : ''}
          </p>
        </button>
        {foreign ? (
          <AmountInput
            className="flex-1"
            value={item.fxAmount ?? 0}
            suffix={CURRENCY_SYMBOL[ccy]}
            onChange={(v) =>
              onUpdate(item.id, {
                fxAmount: v,
                amount: krwOf({ amount: 0, currency: item.currency, fxAmount: v }, rates),
              })
            }
          />
        ) : (
          <AmountInput className="flex-1" value={item.amount} onChange={(v) => onChange(item.id, v)} />
        )}
        <button
          onClick={startEdit}
          className="shrink-0 text-cap active:text-brand"
          aria-label="항목 수정"
        >
          <Pencil size={15} />
        </button>
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
      {foreign && (
        <p className="mt-1.5 text-right text-[12px] font-medium text-cap">
          실시간 환율 ≈ {formatWon(krwOf(item, rates))}
        </p>
      )}
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
