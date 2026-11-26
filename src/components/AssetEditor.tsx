import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import LoanEditor, { LoanForm } from './LoanEditor'
import SavingEditor, { SavingForm } from './SavingEditor'
import type { SavingPlan } from '../lib/saving'
import { dayString, type LoanInfo } from '../lib/loan'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import AmountInput from './AmountInput'
import SheetTable from './SheetTable'
import { CELL_INPUT, TextCell } from './SheetCells'
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

  // 엑셀처럼 표로 (2026-11-25 결영 요청) — 칸을 눌러 바로 고친다 (2026-11-26: "고칠 때 엑셀처럼").
  // 이름·금액·구분·누구·메모는 칸에서 바로, 대출·적금·외화만 '자세히'를 펼친다.
  // 맨 아래 빈 줄에 적으면 바로 새 항목이 된다 (2026-11-26: "행 1개 정도는 여유롭게 미리").
  const [open, setOpen] = useState<string | null>(null)
  // 자산 탭에서 누르고 왔으면 그 줄로 내려가 잠깐 표시한다
  const boxRef = useRef<HTMLDivElement>(null)
  const [lit, setLit] = useState(!!focusId)
  useEffect(() => {
    if (!focusId) return
    setLit(true)
    boxRef.current
      ?.querySelector('[data-focus]')
      ?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    const t = window.setTimeout(() => setLit(false), 2000)
    return () => window.clearTimeout(t)
  }, [focusId])
  const ownerOf = (o?: string) => (o && ownerOptions.includes(o) ? o : '공동')
  const sheet = (list: AssetItem[], debt: boolean) => (
    <div className="rounded-card bg-card px-4 py-3 shadow-card">
      <SheetTable
        rows={list}
        rowKey={(it) => it.id}
        bleed="-mx-4 px-4"
        minWidth={660}
        rowClass={(it) => (lit && it.id === focusId ? 'bg-brand/10' : '')}
        cols={[
          {
            key: 'name',
            label: '이름',
            width: 136,
            cell: (it) => (
              <span data-focus={(lit && it.id === focusId) || undefined}>
                <TextCell
                  label={`${it.name} 이름`}
                  value={it.name}
                  required
                  onCommit={(v) => onUpdate(it.id, { name: v })}
                  className="font-semibold text-ink"
                />
              </span>
            ),
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
            width: 84,
            cell: (it) => (
              <select
                aria-label={`${it.name} 구분`}
                value={it.kind === 'debt' ? 'debt' : it.group}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'debt') onUpdate(it.id, { kind: 'debt' })
                  else onUpdate(it.id, { kind: 'asset', group: v as AssetGroup })
                }}
                className={`${CELL_INPUT} ${debt ? 'text-danger' : 'text-sub'}`}
              >
                {ASSET_GROUP_ORDER.map((gr) => (
                  <option key={gr} value={gr}>
                    {ASSET_GROUP_LABEL[gr]}
                  </option>
                ))}
                <option value="debt">부채</option>
              </select>
            ),
            filter: {
              get: (it) => it.group,
              label: (g) => ASSET_GROUP_LABEL[g as AssetGroup] ?? g,
            },
          },
          {
            key: 'owner',
            label: '누구',
            width: 76,
            align: 'center',
            cell: (it) => (
              <select
                aria-label={`${it.name} 누구`}
                value={ownerOf(it.owner)}
                onChange={(e) => onUpdate(it.id, { owner: e.target.value })}
                className={`${CELL_INPUT} text-center text-ink`}
              >
                {ownerOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ),
            filter: { get: (it) => it.owner ?? '공동' },
          },
          {
            key: 'note',
            label: '메모',
            cell: (it) => (
              <TextCell
                label={`${it.name} 메모`}
                value={it.note ?? ''}
                placeholder="메모"
                onCommit={(v) => onNote(it.id, v)}
                className="text-sub"
              />
            ),
            filter: { get: (it) => it.note ?? '', text: true },
          },
          {
            key: 'more',
            label: '자세히',
            width: 64,
            align: 'center',
            cell: (it) => {
              const tag = detailTag(it, debt)
              if (!tag) return null
              const on = !!(it.loan || it.saving)
              return (
                <button
                  type="button"
                  aria-label={`${it.name} 자세히`}
                  aria-expanded={open === it.id}
                  onClick={() => setOpen((o) => (o === it.id ? null : it.id))}
                  className={`h-9 w-full text-[12px] font-bold ${
                    on ? (debt ? 'text-danger' : 'text-brand') : 'text-cap'
                  } active:opacity-70`}
                >
                  {tag} ▸
                </button>
              )
            },
          },
        ]}
        editingKey={open}
        editBelow
        renderEdit={(it) => (
          <AssetDetail
            item={it}
            debt={debt}
            rates={rates}
            onUpdate={onUpdate}
            onClose={() => setOpen(null)}
          />
        )}
        onRemove={(it) => onRemove(it.id)}
        removeConfirm={(it) => `${it.name || '이 항목'}을 지울까요?`}
        summary={(rows) => (
          <b className="text-ink">{formatWon(rows.reduce((a, it) => a + it.amount, 0))}</b>
        )}
        footer={
          <DraftRow
            debt={debt}
            defaultOwner={ownerOf(defaultOwner)}
            ownerOptions={ownerOptions}
            onAdd={onAdd}
          />
        }
      />
    </div>
  )

  const assetItems = assets.filter((it) => it.kind === 'asset')
  const debtItems = assets.filter((it) => it.kind === 'debt')

  return (
    <div ref={boxRef} className="space-y-3">
      {assets.length === 0 && (
        <div className="space-y-2 py-6 text-center">
          <p className="text-[13.5px] font-medium text-sub">
            표 맨 아래 빈 줄에 이름·금액을 적으면 바로 추가돼요
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
      {sheet(assetItems, false)}
      <p className="px-1 pt-2 text-[13px] font-bold text-danger">부채</p>
      {sheet(debtItems, true)}

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

/** '자세히'를 펼칠 거리 — 외화 원금 · 대출 · 적금 */
const detailTag = (it: AssetItem, debt: boolean) =>
  (it.currency ?? 'KRW') !== 'KRW'
    ? '외화'
    : debt
      ? '대출'
      : it.group === 'cash' || it.saving
        ? '적금'
        : null

/** 줄 아래로 펼치는 자세히 — 외화 원금 · 대출 정보 · 적금 자동 저축 */
function AssetDetail({
  item,
  debt,
  rates,
  onUpdate,
  onClose,
}: {
  item: AssetItem
  debt: boolean
  rates: Rates
  onUpdate: (id: string, patch: Partial<Omit<AssetItem, 'id'>>) => void
  onClose: () => void
}) {
  const ccy = (item.currency as Currency) ?? 'KRW'
  const foreign = ccy !== 'KRW'
  return (
    <div className="space-y-1 rounded-btn bg-bg px-3 py-2.5">
      <p className="text-[12.5px] font-bold text-ink">{item.name}</p>
      {foreign && (
        <>
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
          <p className="text-right text-[12px] font-medium text-cap">
            실시간 환율 ≈ {formatWon(krwOf(item, rates))}
          </p>
        </>
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
      <button
        onClick={onClose}
        className="w-full pt-1 text-center text-[12.5px] font-bold text-sub active:text-ink"
      >
        접기
      </button>
    </div>
  )
}

/**
 * 표 맨 아래 빈 줄 — 엑셀처럼 적으면 바로 새 항목 (2026-11-26 결영 요청).
 * 이름을 적고 이 줄을 벗어나거나 Enter를 누르면 추가되고, 다시 빈 줄이 생긴다.
 */
function DraftRow({
  debt,
  defaultOwner,
  ownerOptions,
  onAdd,
}: {
  debt: boolean
  defaultOwner: string
  ownerOptions: string[]
  onAdd: (a: Omit<AssetItem, 'id'>) => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [group, setGroup] = useState<AssetGroup>('cash')
  const [owner, setOwner] = useState(defaultOwner)
  const [note, setNote] = useState('')
  const what = debt ? '새 부채' : '새 자산'
  const nameRef = useRef<HTMLInputElement>(null)
  const commit = () => {
    if (!name.trim()) return
    onAdd({
      kind: debt ? 'debt' : 'asset',
      group,
      name: name.trim(),
      owner,
      amount,
      ...(note.trim() ? { note: note.trim() } : {}),
    })
    setName('')
    setAmount(0)
    setNote('')
  }
  const enter = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || !name.trim()) return
    commit()
    nameRef.current?.focus() // 엑셀처럼 바로 다음 줄을 적는다
  }
  const cell = 'border-b border-r border-line/80 px-2'
  return (
    <tr
      className="h-10 bg-bg/50 text-[13px]"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit()
      }}
    >
      <td className={cell}>
        <input
          ref={nameRef}
          aria-label={`${what} 이름`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={enter}
          placeholder={`+ ${what}`}
          className={`${CELL_INPUT} font-semibold text-ink placeholder:font-bold placeholder:text-brand`}
        />
      </td>
      <td className={cell}>
        <span className="flex items-center">
          <input
            aria-label={`${what} 금액`}
            inputMode="numeric"
            value={amount ? amount.toLocaleString('ko-KR') : ''}
            placeholder="0"
            onChange={(e) =>
              setAmount(Number(e.target.value.replace(/[^\d]/g, '').slice(0, 13)) || 0)
            }
            onKeyDown={enter}
            className={`${CELL_INPUT} tnum text-right font-semibold placeholder:text-cap/60 ${debt ? 'text-danger' : 'text-ink'}`}
          />
          <span className="ml-0.5 shrink-0 text-[11px] text-cap">원</span>
        </span>
      </td>
      <td className={cell}>
        {debt ? (
          <span className="px-1 text-danger">부채</span>
        ) : (
          <select
            aria-label={`${what} 구분`}
            value={group}
            onChange={(e) => setGroup(e.target.value as AssetGroup)}
            className={`${CELL_INPUT} text-sub`}
          >
            {ASSET_GROUP_ORDER.map((gr) => (
              <option key={gr} value={gr}>
                {ASSET_GROUP_LABEL[gr]}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className={cell}>
        <select
          aria-label={`${what} 누구`}
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className={`${CELL_INPUT} text-center text-ink`}
        >
          {ownerOptions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </td>
      <td className={cell}>
        <input
          aria-label={`${what} 메모`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={enter}
          placeholder="메모"
          className={`${CELL_INPUT} text-sub placeholder:text-cap/60`}
        />
      </td>
      <td className={cell} />
      <td className="border-b border-line/80" />
    </tr>
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
