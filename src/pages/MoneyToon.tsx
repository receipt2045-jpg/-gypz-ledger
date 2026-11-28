import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import ShareArticle, { ShareHero, ShareSection } from '../components/ShareArticle'
import { MONEYTOONS, moneyToon, type MtBlock } from '../lib/moneytoon'
import { shareDate } from '../lib/shares'

/**
 * 머니툰 자료 (2026-11-19) — moabuli.com/money/<slug>, 로그인 없이 열리는 공개 페이지.
 * 머니그랩 인스타툰 댓글로 정리본을 받은 사람이 들어온다. 내용은 src/lib/moneytoon/<slug>.json.
 * 체크·빈 칸에 적은 건 그 폰에만 남는다(localStorage).
 */
export default function MoneyToon() {
  const { slug } = useParams()
  const m = moneyToon(slug)
  if (!m) return <MoneyToonList />

  const key = `mt:${m.slug}`
  return (
    <ShareArticle
      kind="guide"
      toc={m.blocks.map((b, i) => ({ no: i + 1, title: b.title }))}
      hero={
        <ShareHero
          kicker="머니그랩 · 호랑이 눈높이 재테크"
          title={
            <>
              {m.emoji} {m.title}
            </>
          }
          lead={
            <>
              {m.lead}
              <span className="mt-2 block text-[14px] text-white/60">
                인스타툰 「{m.episode}」 편 정리본
              </span>
            </>
          }
        />
      }
      sources={
        <>
          <p className="font-semibold text-sub">알아 둘 것</p>
          <ul className="mt-1.5 space-y-1">
            <li>
              · 머니그랩(결영이네 남편)이 원팀 카페에 쓴{' '}
              <a href={m.source} target="_blank" rel="noreferrer" className="underline">
                {shareDate(m.sourceDate)} 글
              </a>
              을 바탕으로 만들었어요. 숫자는 그날 기준이에요.
            </li>
            <li>· 특정 종목·상품을 사라·팔라는 내용이 아니에요. 투자 판단은 각자 하세요.</li>
            <li>· 체크하고 적은 건 이 폰에만 남아요.</li>
          </ul>
        </>
      }
    >
      {m.blocks.map((b, i) => (
        <ShareSection key={i} no={i + 1} title={b.title}>
          <Block b={b} store={`${key}:${i}`} />
        </ShareSection>
      ))}
    </ShareArticle>
  )
}

function useSaved<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key)
      return s ? (JSON.parse(s) as T) : init
    } catch {
      return init
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      // 사생활 보호 모드 등 — 저장만 안 될 뿐 화면은 그대로
    }
  }, [key, v])
  return [v, setV]
}

function Block({ b, store }: { b: MtBlock; store: string }) {
  if (b.type === 'checklist') return <Checklist items={b.items} store={store} />
  if (b.type === 'table') return <Table b={b} store={store} />
  if (b.type === 'rules')
    return (
      <ul className="space-y-2.5">
        {b.items.map((x, i) => (
          <li key={i} className="rounded-2xl bg-bg px-4 py-3.5">
            <p className="text-[16px] font-extrabold text-ink">{x.label}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-sub">→ {x.text}</p>
          </li>
        ))}
      </ul>
    )
  if (b.type === 'note')
    return (
      <blockquote className="rounded-2xl bg-orange-50 px-5 py-4 text-[16px] leading-relaxed text-ink">
        {b.text}
        {b.by && <span className="mt-2 block text-[13px] font-bold text-[#C2410C]">— {b.by}</span>}
      </blockquote>
    )
  if (b.type === 'words')
    return (
      <dl className="divide-y divide-line">
        {b.items.map((x, i) => (
          <div key={i} className="flex gap-3 py-2.5 text-[15px]">
            <dt className="w-[96px] shrink-0 font-bold text-ink">{x.word}</dt>
            <dd className="text-sub">{x.mean}</dd>
          </div>
        ))}
      </dl>
    )
  if (b.type === 'link') {
    const inner = (
      <span className="flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-[16px] font-bold text-white">
        {b.text}
        <ChevronRight size={18} />
      </span>
    )
    return b.href.startsWith('/') ? <Link to={b.href}>{inner}</Link> : <a href={b.href}>{inner}</a>
  }
  return null
}

function Checklist({ items, store }: { items: string[]; store: string }) {
  const [on, setOn] = useSaved<boolean[]>(
    store,
    items.map(() => false),
  )
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => setOn(items.map((_, k) => (k === i ? !on[k] : !!on[k])))}
            className="flex w-full items-center gap-3 rounded-2xl bg-bg px-4 py-3.5 text-left text-[16px] text-ink"
            aria-pressed={!!on[i]}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                on[i] ? 'border-brand bg-brand text-white' : 'border-cap bg-white'
              }`}
            >
              {on[i] && <Check size={16} strokeWidth={3} />}
            </span>
            <span className={on[i] ? 'text-cap line-through' : ''}>{t}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Table({ b, store }: { b: Extract<MtBlock, { type: 'table' }>; store: string }) {
  const blank = b.blank ?? 0
  const [cells, setCells] = useSaved<string[][]>(
    store,
    Array.from({ length: blank }, () => b.head.map(() => '')),
  )
  const set = (r: number, c: number, v: string) =>
    setCells(cells.map((row, i) => (i === r ? row.map((x, k) => (k === c ? v : x)) : row)))
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[300px] border-separate border-spacing-1 text-[14px]">
          <thead>
            <tr>
              {b.head.map((h, i) => (
                <th key={i} className="rounded-lg bg-ink px-2 py-2 font-bold text-white">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={`r${i}`}>
                {r.map((x, k) => (
                  <td
                    key={k}
                    className="rounded-lg bg-orange-50 px-2 py-2 text-center leading-snug text-ink"
                  >
                    {x}
                  </td>
                ))}
              </tr>
            ))}
            {cells.slice(0, blank).map((r, i) => (
              <tr key={`b${i}`}>
                {b.head.map((h, k) => (
                  <td key={k} className="rounded-lg bg-bg p-0">
                    <input
                      value={r[k] ?? ''}
                      onChange={(e) => set(i, k, e.target.value)}
                      aria-label={`${i + 1}번째 줄 ${h}`}
                      placeholder="적기"
                      className="w-full rounded-lg bg-transparent px-2 py-2 text-center text-[14px] text-ink placeholder:text-cap focus:outline-brand"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {b.note && <p className="mt-2 text-[13px] text-cap">{b.note}</p>}
    </div>
  )
}

/** moabuli.com/money — 머니툰 자료 모음 */
function MoneyToonList() {
  return (
    <ShareArticle
      kind="guide"
      hero={
        <ShareHero
          kicker="머니그랩 · 호랑이 눈높이 재테크"
          title={<>🐯 머니툰 자료</>}
          lead={<>인스타툰에서 약속한 정리본을 모아 뒀어요.</>}
        />
      }
      sources={<p>머니그랩(결영이네 남편)이 원팀 카페에 쓴 글을 바탕으로 만들었어요.</p>}
    >
      <ShareSection no={1} title="자료 목록">
        <ul className="space-y-2">
          {MONEYTOONS.map((m) => (
            <li key={m.slug}>
              <Link
                to={`/money/${m.slug}`}
                className="flex items-center gap-3 rounded-2xl bg-bg px-4 py-3.5"
              >
                <span className="text-[24px]">{m.emoji}</span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px] text-ink">{m.title}</b>
                  <span className="block truncate text-[13px] text-cap">
                    {shareDate(m.date)} · 「{m.episode}」
                  </span>
                </span>
                <ChevronRight size={18} className="text-cap" />
              </Link>
            </li>
          ))}
        </ul>
      </ShareSection>
    </ShareArticle>
  )
}
