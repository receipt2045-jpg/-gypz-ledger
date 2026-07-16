import { useEffect, useRef, useState } from 'react'

/** 용어 옆 ? 아이콘 → 탭하면 1~2줄 설명 팝오버 (브리프 P1 2.4) */
export default function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label="용어 설명"
        className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-line text-[10px] font-bold text-sub"
      >
        ?
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-40 mb-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-left text-[12px] font-medium leading-relaxed text-white shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}
