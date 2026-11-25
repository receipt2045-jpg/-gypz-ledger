import { useEffect, useRef, useState } from 'react'
import LoanEditor, { LoanForm } from './LoanEditor'
import SavingEditor, { SavingForm } from './SavingEditor'
import type { SavingPlan } from '../lib/saving'
import { dayString, type LoanInfo } from '../lib/loan'
import { ChevronDown, ChevronRight, Pencil, Plus, StickyNote, X } from 'lucide-react'
import AmountInput from './AmountInput'
import AssetIcon from './AssetIcon'
import SheetTable from './SheetTable'
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
import { abbreviateKRW, formatWon } from '../lib/format'
import type { AssetGroup, AssetItem } from '../types'

// 통화 입력칸의 접미사 (KRW는 '원', 외화는 기호)
const suffixOf = (c: Currency) => (c === 'KRW' ? '원' : CURRENCY_SYMBOL[c])

/** 자산·부채 목록 편집기 — 정산의 자산 스텝과 자산 등록 플로우에서 공용 */
export default function AssetEditor({
  assets,
  ownerOptions,
  defaultOwner,
  focusId,
  onChange,
  onNote,
  onUpdate,
  onAdd,
  onRemove,
}: {
  assets: AssetItem[]
  ownerOptions: string[] // 소유자 선택지 (공동·부부·자녀)
  defaultOwner: string
  /** 자산 탭에서 누른 항목 — 그 줄로 내려가 잠깐 표시한다 */
  focusId?: string
  onChange: (id: string, v: number) => void
  onNote: (id: string, note: string) => void
  onUpdate: (id: string, patch: Partial<Omit<AssetItem, 'id'>>) => void
  onAdd: (a: Omit<AssetItem, 'id'>) => void
  onRemove: (id: string) => void
}) {
  const rates = useFxRates()
  const [adding, setAdding] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (adding) addRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [adding])
  const [kind, setKind] = useState<'asset' | 'debt'>('asset')
  const [group, setGroup] = useState<AssetGroup>('cash')
  const [name, setName] = useState('')
  const [owner, setOwner] = useState(defaultOwner)
  const [amount, setAmount] = useState(0)
  const [currency, setCurrency] = useState<Currency>('KRW')
  // 부채를 추가하면서 바로 대출 정보까지 (2026-10-07 — 추가한 뒤 다시 열어야 해서 못 찾았다)
  const [loanOpen, setLoanOpen] = useState(false)
  const [loan, setLoan] = useState<LoanInfo | null>(null)
  // 예적금을 추가하면서 바로 매달 자동 저축까지 (2026-11-24)
  const [savingOpen, setSavingOpen] = useState(false)
  const [saving, setSaving] = useState<SavingPlan | null>(null)
  const canSave = kind === 'asset' && group === 'cash' && currency === 'KRW'

  const submit = () => {
    if (!name.trim() || amount <= 0) return
    if (currency === 'KRW') {
      onAdd({
        kind,
        group,
        name: name.trim(),
        owner,
        amount,
        ...(kind === 'debt' && loanOpen && loan ? { loan } : {}),
        ...(canSave && savingOpen && saving ? { saving } : {}),
      })
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
    setLoanOpen(false)
    setLoan(null)
    setSavingOpen(false)
    setSaving(null)
    setAdding(false)
  }

  // 엑셀처럼 표로 (2026-11-25 결영 요청) — 금액 칸은 바로 고치고, 줄을 누르면 자세히(이름·메모·대출·적금)
  // 자산 탭에서 누르고 왔으면 그 줄을 펼쳐 둔다
  const [open, setOpen] = useState<string | null>(focusId ?? null)
  const sheet = (list: AssetItem[], debt: boolean) => (
    <div className="rounded-card bg-card px-4 py-3 shadow-card">
      <SheetTable
        rows={list}
        rowKey={(it) => it.id}
        bleed="-mx-4 px-4"
        minWidth={560}
        cols={[
          {
            key: 'name',
            label: '이름',
            width: 128,
            cell: (it) => (
              <>
                {it.name}
                {it.saving && <span className="ml-1 text-[11px] font-bold text-brand">자동</span>}
                {it.loan && <span className="ml-1 text-[11px] font-bold text-danger">대출</span>}
              </>
            ),
            tone: () => 'font-semibold text-ink',
            filter: { get: (it) => it.name },
          },
          {
            key: 'amount',
            label: '금액',
            width: 138,
            align: 'right',
            cell: (it) => (
              <AmountCell
                item={it}
                debt={debt}
                rates={rates}
                onChange={onChange}
                onUpdate={onUpdate}
              />
            ),
          },
          {
            key: 'group',
            label: '구분',
            width: 76,
            cell: (it) => (debt ? '부채' : ASSET_GROUP_LABEL[it.group]),
            tone: () => (debt ? 'text-danger' : 'text-sub'),
            filter: {
              get: (it) => it.group,
              label: (g) => ASSET_GROUP_LABEL[g as AssetGroup] ?? g,
            },
          },
          {
            key: 'owner',
            label: '누구',
            width: 68,
            align: 'center',
            cell: (it) => it.owner ?? '공동',
            filter: { get: (it) => it.owner ?? '공동' },
          },
          {
            key: 'note',
            label: '메모',
            cell: (it) => it.note ?? '',
            tone: () => 'text-sub',
            filter: { get: (it) => it.note ?? '', text: true },
          },
        ]}
        onRowClick={(it) => setOpen((o) => (o === it.id ? null : it.id))}
        rowLabel={(it) => `${it.name} 자세히`}
        editingKey={open}
        renderEdit={(it) => (
          <div className="space-y-1.5 py-1">
            <AssetRow
              item={it}
              ownerOptions={ownerOptions}
              rates={rates}
              onChange={onChange}
              onNote={onNote}
              onUpdate={onUpdate}
              onRemove={onRemove}
              focus={it.id === focusId}
              debt={debt}
            />
            <button
              onClick={() => setOpen(null)}
              className="w-full py-1 text-center text-[12.5px] font-bold text-sub active:text-ink"
            >
              접기
            </button>
          </div>
        )}
        onRemove={(it) => onRemove(it.id)}
        removeConfirm={(it) => `${it.name || '이 항목'}을 지울까요?`}
        summary={(rows) => (
          <b className="text-ink">{formatWon(rows.reduce((a, it) => a + it.amount, 0))}</b>
        )}
      />
    </div>
  )

  const assetItems = assets.filter((it) => it.kind === 'asset')
  const debtItems = assets.filter((it) => it.kind === 'debt')

  return (
    <div className="space-y-3">
      {assets.length === 0 && (
        <div className="space-y-2 py-6 text-center">
          <p className="text-[13.5px] font-medium text-sub">
            아래 버튼으로 통장·자산을 추가해 주세요
          </p>
          <p className="text-[12.5px] leading-relaxed text-cap">
            예: 토스 비상금 300만 원 · 주택청약 500만 원
            <br />
            예: 전세보증금 1억 원 · 자동차 1,500만 원
            <br />
            빚도 함께 넣어요 — 예: 전세대출 8,000만 원
          </p>
        </div>
      )}
      {assetItems.length > 0 && sheet(assetItems, false)}
      {debtItems.length > 0 && <p className="px-1 pt-2 text-[13px] font-bold text-danger">부채</p>}
      {debtItems.length > 0 && sheet(debtItems, true)}

      {adding ? (
        <div
          // 열리면 하단 저장 바 밑에 숨지 않게 화면 가운데로 올린다 (2026-11-19 점검)
          ref={addRef}
          className="scroll-mb-32 space-y-2 rounded-card bg-card p-4 shadow-card"
        >
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
              placeholder={kind === 'debt' ? '남은 대출금' : '현재 잔액'}
              suffix={suffixOf(currency)}
            />
          </div>
          {currency !== 'KRW' && amount > 0 && (
            <p className="px-1 text-right text-[12px] text-cap">
              실시간 환율 ≈ {formatWon(krwOf({ amount: 0, currency, fxAmount: amount }, rates))}
            </p>
          )}
          {canSave && (
            <div className="rounded-btn bg-bg p-3">
              <button
                type="button"
                onClick={() => setSavingOpen((v) => !v)}
                aria-expanded={savingOpen}
                className="flex w-full items-center justify-between text-[12.5px] font-bold text-brand"
              >
                매달 자동으로 쌓기 · 적금 (선택)
                {savingOpen ? (
                  <ChevronDown size={15} className="text-cap" />
                ) : (
                  <ChevronRight size={15} className="text-cap" />
                )}
              </button>
              {savingOpen && (
                <div className="mt-2">
                  <SavingForm amount={amount} onChange={setSaving} />
                </div>
              )}
            </div>
          )}
          {kind === 'debt' && currency === 'KRW' && (
            <div className="rounded-btn bg-bg p-3">
              <button
                type="button"
                onClick={() => setLoanOpen((v) => !v)}
                aria-expanded={loanOpen}
                className="flex w-full items-center justify-between text-[12.5px] font-bold text-brand"
              >
                대출 정보 넣기 · 매달 갚는 돈 계산 (선택)
                {loanOpen ? (
                  <ChevronDown size={15} className="text-cap" />
                ) : (
                  <ChevronRight size={15} className="text-cap" />
                )}
              </button>
              {loanOpen && (
                <div className="mt-2">
                  <LoanForm amount={amount} onChange={setLoan} onBalance={setAmount} />
                </div>
              )}
            </div>
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
  focus = false,
}: {
  item: AssetItem
  ownerOptions: string[] // 소유자 선택지 (공동·부부·자녀)
  rates: Rates
  onChange: (id: string, v: number) => void
  onNote: (id: string, note: string) => void
  onUpdate: (id: string, patch: Partial<Omit<AssetItem, 'id'>>) => void
  onRemove: (id: string) => void
  debt?: boolean
  focus?: boolean
}) {
  const [memoOpen, setMemoOpen] = useState(false)
  // 자산 탭에서 이 항목을 눌러서 왔으면 이 줄로 내려가 잠깐 테두리를 띄운다
  const rowRef = useRef<HTMLDivElement>(null)
  const [lit, setLit] = useState(focus)
  useEffect(() => {
    if (!focus) return
    rowRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    const t = window.setTimeout(() => setLit(false), 2000)
    return () => window.clearTimeout(t)
  }, [focus])
  const [editing, setEditing] = useState(false)
  // 수정 폼 임시값
  const [eKind, setEKind] = useState<'asset' | 'debt'>(item.kind)
  const [eGroup, setEGroup] = useState<AssetGroup>(item.group)
  const [eName, setEName] = useState(item.name)
  const ownerOf = (o?: string) => (o && ownerOptions.includes(o) ? o : '공동')
  const [eOwner, setEOwner] = useState(ownerOf(item.owner))
  const memoVisible = memoOpen || !!item.note
  const ccy = (item.currency as Currency) ?? 'KRW'
  const foreign = ccy !== 'KRW'

  const startEdit = () => {
    setEKind(item.kind)
    setEGroup(item.group)
    setEName(item.name)
    setEOwner(ownerOf(item.owner))
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

  // 금액 칸을 이름 줄 아래 한 줄로 (2026-10-07 제보: "금액을 넣을 때 일부만 보여 불편해요").
  // 예전엔 아이콘·이름·버튼 셋과 한 줄을 나눠 써서 폰에서 금액 칸이 80px 남짓이었다.
  return (
    <div
      ref={rowRef}
      data-focus={lit || undefined}
      className={`rounded-card bg-card px-4 py-3 shadow-card transition-shadow ${lit ? 'ring-2 ring-brand' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <AssetIcon group={item.group} kind={item.kind} size={34} />
        <button onClick={startEdit} className="min-w-0 flex-1 text-left" aria-label="항목 수정">
          <p className="truncate text-[14px] font-semibold text-ink">{item.name}</p>
          <p className="mt-0.5 text-[11px] text-cap">
            {debt ? '부채' : ASSET_GROUP_LABEL[item.group]}
            {item.owner ? ` · ${item.owner}` : ''}
          </p>
        </button>
        <button
          onClick={startEdit}
          className="shrink-0 p-1 text-cap active:text-brand"
          aria-label="항목 수정"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => setMemoOpen((v) => !v)}
          className={`shrink-0 p-1 ${memoVisible ? 'text-brand' : 'text-cap'} active:text-brand`}
          aria-label="메모"
        >
          <StickyNote size={16} />
        </button>
        <button
          onClick={() => {
            // 지우기 전에 묻는다 (2026-11-19 점검: 큰 금액 통장이 한 번에 사라졌다)
            if (window.confirm(`${item.name || '이 항목'}을 지울까요?`)) onRemove(item.id)
          }}
          className="shrink-0 p-1.5 text-cap active:text-danger"
          aria-label="삭제"
        >
          <X size={18} />
        </button>
      </div>
      <div className="mt-2">
        {foreign ? (
          <AmountInput
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
          <AmountInput
            value={item.amount}
            onChange={(v) =>
              // 대출 정보가 있는 부채를 직접 고치면 오늘까지 반영된 금액으로 본다 (다음 갚는 날부터 자동으로 줄임)
              debt && item.loan
                ? onUpdate(item.id, {
                    amount: v,
                    loan: { ...item.loan, asOf: dayString(new Date()) },
                  })
                : // 적금도 직접 고치면 오늘까지 넣은 돈이 들어간 금액으로 본다 (다음 넣는 날부터 더함)
                  !debt && item.saving
                  ? onUpdate(item.id, {
                      amount: v,
                      saving: { ...item.saving, asOf: dayString(new Date()) },
                    })
                  : onChange(item.id, v)
            }
          />
        )}
      </div>
      {/* 큰 금액은 자릿수 세기 어렵다 — 억·만으로 한 번 더 읽어 준다 */}
      {!foreign && item.amount >= 10_000 && (
        <p className="mt-1 text-right text-[12px] font-medium text-cap">
          {abbreviateKRW(item.amount)}
        </p>
      )}
      {foreign && (
        <p className="mt-1.5 text-right text-[12px] font-medium text-cap">
          실시간 환율 ≈ {formatWon(krwOf(item, rates))}
        </p>
      )}
      {debt && !foreign && (
        <LoanEditor
          item={item}
          onSave={(loan, balance) =>
            onUpdate(item.id, balance !== undefined ? { loan, amount: balance } : { loan })
          }
        />
      )}
      {!debt && !foreign && (item.group === 'cash' || item.saving) && (
        <SavingEditor item={item} onSave={(saving) => onUpdate(item.id, { saving })} />
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

/**
 * 표의 금액 칸 — 엑셀처럼 바로 고친다 (2026-11-25).
 * 대출·적금이 걸린 항목은 직접 고친 날을 기준일로 (AssetRow와 같은 규칙). 외화는 줄을 눌러 고친다.
 */
function AmountCell({
  item,
  debt,
  rates,
  onChange,
  onUpdate,
}: {
  item: AssetItem
  debt: boolean
  rates: Rates
  onChange: (id: string, v: number) => void
  onUpdate: (id: string, patch: Partial<Omit<AssetItem, 'id'>>) => void
}) {
  const ccy = (item.currency as Currency) ?? 'KRW'
  if (ccy !== 'KRW')
    return (
      <span className="tnum font-semibold">
        {(item.fxAmount ?? 0).toLocaleString('ko-KR')}
        {CURRENCY_SYMBOL[ccy]}
        <span className="ml-1 text-[11px] font-medium text-cap">
          ≈{abbreviateKRW(krwOf(item, rates))}
        </span>
      </span>
    )
  const set = (v: number) =>
    debt && item.loan
      ? onUpdate(item.id, { amount: v, loan: { ...item.loan, asOf: dayString(new Date()) } })
      : !debt && item.saving
        ? onUpdate(item.id, { amount: v, saving: { ...item.saving, asOf: dayString(new Date()) } })
        : onChange(item.id, v)
  return (
    <span className="flex items-center" onClick={(e) => e.stopPropagation()}>
      <input
        aria-label={`${item.name} 금액`}
        inputMode="numeric"
        value={item.amount ? item.amount.toLocaleString('ko-KR') : ''}
        placeholder="0"
        onChange={(e) => set(Number(e.target.value.replace(/[^\d]/g, '').slice(0, 13)) || 0)}
        className={`tnum h-9 w-full min-w-0 rounded-[4px] bg-transparent px-1 text-right font-semibold outline-none focus:bg-brand/5 focus:ring-2 focus:ring-inset focus:ring-brand ${debt ? 'text-danger' : 'text-ink'}`}
      />
      <span className="ml-0.5 shrink-0 text-[11px] text-cap">원</span>
    </span>
  )
}
