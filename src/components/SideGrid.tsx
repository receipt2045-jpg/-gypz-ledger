import { useEffect, useRef, useState, type ClipboardEvent } from 'react'
import { X } from 'lucide-react'
import {
  kindOfCategory,
  parseDateCell,
  parsePastedRows,
  SIDE_CATEGORIES,
  type SideIncome,
  type SideKind,
} from '../lib/sideIncome'
import type { NewSideIncome } from '../lib/sideDb'

/**
 * 부수입 표로 적기 (2026-11-23 결영 요청: "엑셀 입력 느낌으로").
 * 한 줄 = 기록 하나. 칸에 바로 쓰고 다른 줄로 넘어가면 저장, 맨 아래 빈 줄에 이어서 쓰면 새 기록.
 * 금액 칸에서 Enter = 저장하고 다음 줄. 엑셀·구글 시트에서 여러 줄을 복사해 붙여넣으면 한꺼번에 들어간다.
 */

type Who = 1 | 2 | 'shared'

interface Draft {
  key: string
  id?: string
  earnedOn: string
  /** 날짜 칸에 보이는 글 — 엑셀처럼 '11/3'으로 친다 */
  dateText: string
  kind: SideKind
  category: string
  amount: string
  who: Who
  note: string
}

const digits = (s: string) => s.replace(/[^\d]/g, '')
const comma = (s: string) => (s ? Number(s).toLocaleString('ko-KR') : '')
/** '2026-11-03' → '11/3' */
const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

function fromEntry(e: SideIncome): Draft {
  return {
    key: e.id,
    id: e.id,
    earnedOn: e.earnedOn,
    dateText: shortDate(e.earnedOn),
    kind: e.kind,
    category: e.category,
    amount: String(e.amount),
    who: e.shared ? 'shared' : e.memberNo,
    note: e.note ?? '',
  }
}

let blankSeq = 0
function blank(date: string, me: 1 | 2, kind: SideKind = 'cash'): Draft {
  return {
    key: `new-${++blankSeq}`,
    earnedOn: date,
    dateText: shortDate(date),
    kind,
    category: '',
    amount: '',
    who: me,
    note: '',
  }
}

const same = (a: Draft, e: SideIncome) => {
  const b = fromEntry(e)
  return (
    a.earnedOn === b.earnedOn &&
    a.kind === b.kind &&
    a.category.trim() === b.category &&
    digits(a.amount) === b.amount &&
    a.who === b.who &&
    a.note.trim() === b.note
  )
}

export default function SideGrid({
  ym,
  entries,
  names,
  me,
  onAdd,
  onUpdate,
  onRemove,
}: {
  ym: string
  /** 이 달 기록 (날짜순) */
  entries: SideIncome[]
  names: [string, string]
  me: 1 | 2
  onAdd: (n: NewSideIncome) => Promise<void>
  onUpdate: (id: string, patch: Partial<NewSideIncome>) => Promise<void>
  onRemove: (id: string) => Promise<void>
}) {
  const today = new Date().toLocaleDateString('sv-SE')
  const defaultDate = today.startsWith(ym) ? today : `${ym}-01`
  const [rows, setRows] = useState<Draft[]>([])
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const saving = useRef(new Set<string>())
  const tableRef = useRef<HTMLTableElement>(null)

  // 서버 기록이 바뀌면 다시 맞춘다 — 쓰는 중인 새 줄은 남긴다
  useEffect(() => {
    setRows((prev) => {
      const pending = prev.filter((r) => !r.id && (r.category || r.amount || r.note))
      const blanks = pending.length ? pending : []
      return [...entries.map(fromEntry), ...blanks, blank(defaultDate, me)]
    })
  }, [entries, defaultDate, me])

  const patch = (key: string, p: Partial<Draft>) =>
    setRows((prev) => {
      const next = prev.map((r) => (r.key === key ? { ...r, ...p } : r))
      // 맨 아래 빈 줄에 쓰기 시작하면 그 아래 새 빈 줄
      const last = next[next.length - 1]
      if (last && !last.id && (last.category || last.amount || last.note))
        next.push(blank(last.earnedOn, me, last.kind))
      return next
    })

  /** 줄에서 나갈 때 — 바뀌었으면 저장 */
  const commit = async (key: string) => {
    const r = rows.find((x) => x.key === key)
    if (!r || saving.current.has(key)) return
    const amount = Number(digits(r.amount))
    const category = r.category.trim()
    if (!r.id && !amount && !category && !r.note.trim()) return // 빈 줄
    if (r.id) {
      const e = entries.find((x) => x.id === r.id)
      if (!e || same(r, e)) return
    }
    if (!amount || !category) {
      setMsg({ text: '종류와 금액을 넣으면 저장돼요', ok: false })
      return
    }
    const n: NewSideIncome = {
      earnedOn: r.earnedOn,
      kind: r.kind,
      category: category.slice(0, 30),
      amount,
      memberNo: r.who === 'shared' ? me : r.who,
      shared: r.who === 'shared' ? true : undefined,
      note: r.note.trim() || undefined,
    }
    saving.current.add(key)
    try {
      if (r.id) {
        const e = entries.find((x) => x.id === r.id)!
        // 아낀 돈을 표에서 고치면 '원래 값 − 낸 돈'도 맞춘다
        await onUpdate(r.id, {
          ...n,
          price: n.kind === 'saved' ? amount + (e.paid ?? 0) : undefined,
          paid: n.kind === 'saved' ? e.paid : undefined,
        })
      } else {
        await onAdd({ ...n, price: n.kind === 'saved' ? amount : undefined })
        setRows((prev) => prev.filter((x) => x.key !== key))
      }
      setMsg({ text: '저장했어요', ok: true })
    } catch {
      setMsg({ text: '저장하지 못했어요. 잠시 뒤 다시 해 주세요', ok: false })
    } finally {
      saving.current.delete(key)
    }
  }

  const onRowBlur = (key: string) => (e: React.FocusEvent<HTMLTableRowElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    void commit(key)
  }

  /** 금액 칸 Enter — 저장하고 다음 줄 첫 칸으로 */
  const nextRow = (i: number) => {
    const inputs = tableRef.current?.querySelectorAll<HTMLInputElement>(
      'tbody tr input[data-first]',
    )
    inputs?.[i + 1]?.focus()
  }

  const onPaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\t') && !text.includes('\n')) return // 칸 하나 붙여넣기는 그대로
    e.preventDefault()
    const { rows: got, skipped } = parsePastedRows(text, { year: ym.slice(0, 4), names, me })
    if (got.length === 0) {
      setMsg({ text: '붙여넣은 줄에서 날짜와 금액을 찾지 못했어요', ok: false })
      return
    }
    let saved = 0
    for (const r of got) {
      try {
        await onAdd({
          earnedOn: r.earnedOn,
          kind: r.kind,
          category: r.category,
          amount: r.amount,
          price: r.kind === 'saved' ? r.amount : undefined,
          memberNo: r.who === 'shared' ? me : r.who,
          shared: r.who === 'shared' ? true : undefined,
          note: r.note,
        })
        saved++
      } catch {
        /* 못 넣은 줄은 세지 않는다 */
      }
    }
    const other = got.filter((r) => !r.earnedOn.startsWith(ym)).length
    setMsg({
      text:
        `${saved}줄을 넣었어요` +
        (other ? ` (그중 ${other}줄은 다른 달이라 그 달에 들어갔어요)` : '') +
        (skipped ? ` · ${skipped}줄은 날짜나 금액이 없어 뺐어요` : ''),
      ok: true,
    })
  }

  const cell = 'border-b border-r border-line/80 p-0'
  const input =
    'h-10 w-full bg-transparent px-2 text-[13.5px] text-ink outline-none focus:bg-brand/5 focus:ring-2 focus:ring-inset focus:ring-brand'

  return (
    <div onPaste={(e) => void onPaste(e)}>
      <div className="no-scrollbar -mx-5 overflow-x-auto px-5">
        <table ref={tableRef} className="w-full min-w-[500px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[60px]" />
            <col className="w-[52px]" />
            <col className="w-[108px]" />
            <col className="w-[92px]" />
            <col className="w-[56px]" />
            <col />
            <col className="w-[32px]" />
          </colgroup>
          <thead>
            <tr className="bg-bg text-left text-[11.5px] font-bold text-sub">
              {['날짜', '구분', '종류', '금액', '누가', '메모', ''].map((h, i) => (
                <th
                  key={i}
                  className="border-b border-r border-line/80 px-2 py-1.5 last:border-r-0"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isNew = !r.id
              const empty = isNew && !r.category && !r.amount && !r.note
              return (
                <tr
                  key={r.key}
                  onBlur={onRowBlur(r.key)}
                  className={empty ? 'bg-bg/40' : r.kind === 'saved' ? 'bg-brand/[0.03]' : ''}
                >
                  <td className={cell}>
                    <input
                      data-first
                      aria-label={`${i + 1}번째 줄 날짜`}
                      value={r.dateText}
                      placeholder="11/3"
                      onChange={(e) => {
                        const text = e.target.value.slice(0, 12)
                        const d = parseDateCell(text, ym.slice(0, 4))
                        patch(r.key, d ? { dateText: text, earnedOn: d } : { dateText: text })
                      }}
                      // 못 읽는 날짜를 두고 나가면 원래 날짜로 되돌린다
                      onBlur={() =>
                        !parseDateCell(r.dateText, ym.slice(0, 4)) &&
                        patch(r.key, { dateText: shortDate(r.earnedOn) })
                      }
                      className={`${input} tnum text-center`}
                    />
                  </td>
                  <td className={cell}>
                    <select
                      aria-label={`${i + 1}번째 줄 구분`}
                      value={r.kind}
                      onChange={(e) => patch(r.key, { kind: e.target.value as SideKind })}
                      className={`${input} appearance-none px-0 text-center font-semibold ${r.kind === 'cash' ? 'text-emerald-700' : 'text-brand'}`}
                    >
                      <option value="cash">들어온</option>
                      <option value="saved">아낀</option>
                    </select>
                  </td>
                  <td className={cell}>
                    <input
                      aria-label={`${i + 1}번째 줄 종류`}
                      list={`side-cats-${r.kind}`}
                      value={r.category}
                      placeholder={empty ? '앱테크' : ''}
                      onChange={(e) => {
                        const v = e.target.value
                        // 목록에서 고른 종류가 다른 쪽이면 구분도 따라간다
                        const known = [...SIDE_CATEGORIES.cash, ...SIDE_CATEGORIES.saved].includes(
                          v,
                        )
                        patch(
                          r.key,
                          known && v !== '기타'
                            ? { category: v, kind: kindOfCategory(v) }
                            : { category: v },
                        )
                      }}
                      maxLength={30}
                      className={`${input} placeholder:text-cap/60`}
                    />
                  </td>
                  <td className={cell}>
                    <input
                      aria-label={`${i + 1}번째 줄 금액`}
                      inputMode="numeric"
                      value={comma(digits(r.amount))}
                      placeholder={empty ? '0' : ''}
                      onChange={(e) =>
                        patch(r.key, { amount: digits(e.target.value).slice(0, 10) })
                      }
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        void commit(r.key)
                        nextRow(i)
                      }}
                      className={`${input} tnum text-right font-semibold placeholder:text-cap/60`}
                    />
                  </td>
                  <td className={cell}>
                    <select
                      aria-label={`${i + 1}번째 줄 누가`}
                      value={String(r.who)}
                      onChange={(e) =>
                        patch(r.key, {
                          who:
                            e.target.value === 'shared'
                              ? 'shared'
                              : (Number(e.target.value) as 1 | 2),
                        })
                      }
                      className={`${input} appearance-none px-0 text-center`}
                    >
                      <option value="1">{names[0]}</option>
                      <option value="2">{names[1]}</option>
                      <option value="shared">공동</option>
                    </select>
                  </td>
                  <td className={cell}>
                    <input
                      aria-label={`${i + 1}번째 줄 메모`}
                      value={r.note}
                      maxLength={100}
                      onChange={(e) => patch(r.key, { note: e.target.value })}
                      className={input}
                    />
                  </td>
                  <td className="border-b border-line/80 p-0 text-center">
                    {r.id && (
                      <button
                        type="button"
                        aria-label={`${i + 1}번째 줄 지우기`}
                        onClick={() => {
                          if (
                            window.confirm(`${r.category} ${comma(digits(r.amount))}원을 지울까요?`)
                          )
                            void onRemove(r.id!)
                        }}
                        className="h-10 w-full text-cap active:text-danger"
                      >
                        <X size={14} className="mx-auto" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {(['cash', 'saved'] as const).map((k) => (
        <datalist key={k} id={`side-cats-${k}`}>
          {SIDE_CATEGORIES[k].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      ))}
      <p
        className={`mt-2 text-[12px] ${msg ? (msg.ok ? 'text-brand' : 'text-danger') : 'text-cap'}`}
      >
        {msg?.text ??
          '칸에 바로 쓰고 다른 줄로 넘어가면 저장돼요 · 엑셀에서 여러 줄을 복사해 붙여넣어도 돼요'}
      </p>
    </div>
  )
}
