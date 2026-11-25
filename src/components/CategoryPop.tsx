import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SIDE_CATEGORIES, SIDE_KIND_LABEL, SIDE_KINDS, type SideKind } from '../lib/sideIncome'

/**
 * 표의 '종류' 칸을 누르면 뜨는 고르기 창 (2026-11-24 결영: "폰에서는 드롭다운이 잘 안되네").
 * 예전엔 브라우저 기본 자동완성(datalist)을 썼는데, 폰에선 목록이 안 뜨거나
 * 이미 적힌 글과 같은 것만 보여서 다른 종류로 바꿀 수가 없었다.
 *
 * 표가 옆으로 밀리는 칸 안이라 칸 밖으로 그리려고 화면 기준(fixed)으로 띄운다.
 * 화면 애니메이션(transform) 안에선 fixed가 화면 기준이 아니어서 body로 빼서(portal) 그린다.
 * 누를 때 칸에서 손이 떨어지지(blur) 않게 pointerdown을 막는다 — 떨어지면 줄이 저장돼 버린다.
 */
export default function CategoryPop({
  anchor,
  kind,
  value,
  onPick,
}: {
  anchor: HTMLElement
  kind: SideKind
  value: string
  /** 고른 종류와 그 종류가 속한 구분 — 다른 구분의 종류를 고르면 구분도 바뀐다 */
  onPick: (category: string, kind: SideKind) => void
}) {
  // 스크롤·키보드로 칸이 움직이면 다시 그린다
  const [, setTick] = useState(0)
  useEffect(() => {
    const re = () => setTick((t) => t + 1)
    window.addEventListener('scroll', re, true)
    window.addEventListener('resize', re)
    window.visualViewport?.addEventListener('resize', re)
    window.visualViewport?.addEventListener('scroll', re)
    return () => {
      window.removeEventListener('scroll', re, true)
      window.removeEventListener('resize', re)
      window.visualViewport?.removeEventListener('resize', re)
      window.visualViewport?.removeEventListener('scroll', re)
    }
  }, [])

  const r = anchor.getBoundingClientRect()
  const vh = window.visualViewport?.height ?? window.innerHeight
  const vw = window.innerWidth
  const W = Math.min(280, vw - 16)
  const H = 232
  const below = r.bottom + 4 + H <= vh || r.top - 4 - H < 0
  const left = Math.max(8, Math.min(r.left, vw - W - 8))
  const kinds = [kind, ...SIDE_KINDS.filter((k) => k !== kind)]

  return createPortal(
    <div
      role="listbox"
      aria-label="종류 고르기"
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left,
        width: W,
        maxHeight: H,
        ...(below ? { top: r.bottom + 4 } : { top: r.top - 4 - H }),
      }}
      className="z-50 overflow-y-auto rounded-btn border border-line bg-white p-2 shadow-card"
    >
      {kinds.map((k) => (
        <div key={k} className="mb-1.5 last:mb-0">
          <p
            className={`px-1 pb-1 text-[11px] font-bold ${
              k === 'cash' ? 'text-emerald-600' : k === 'saved' ? 'text-brand' : 'text-rose-600'
            }`}
          >
            {SIDE_KIND_LABEL[k]}
          </p>
          <div className="flex flex-wrap gap-1">
            {SIDE_CATEGORIES[k].map((c) => {
              const on = value === c && k === kind
              return (
                <button
                  key={`${k}-${c}`}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => onPick(c, k)}
                  className={`rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold ${
                    on ? 'bg-ink text-white' : 'bg-bg text-ink active:bg-line'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <p className="px-1 pt-1 text-[11px] text-cap">목록에 없으면 칸에 바로 써요</p>
    </div>,
    document.body,
  )
}
