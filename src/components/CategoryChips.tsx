/** 종류 하나만 보기 칩 줄 — 첫 칩은 '모든 종류' (부수입 탭, 2026-11-23) */
export default function CategoryChips({
  cats,
  picked,
  onPick,
}: {
  cats: { key: string; label: string; tone: string }[]
  picked: string | null
  onPick: (key: string | null) => void
}) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5">
      {[null, ...cats].map((c) => (
        <button
          key={c?.key ?? 'all'}
          onClick={() => onPick(c && picked !== c.key ? c.key : null)}
          aria-pressed={picked === (c?.key ?? null)}
          className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] font-bold ${
            picked === (c?.key ?? null)
              ? 'bg-ink text-white'
              : `bg-bg active:bg-line ${c ? c.tone : 'text-sub'}`
          }`}
        >
          {c ? c.label : '모든 종류'}
        </button>
      ))}
    </div>
  )
}
