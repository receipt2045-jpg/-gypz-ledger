import { useEffect, useState } from 'react'

/** 가로 1024px 이상(PC) — Tailwind lg와 같은 기준. matchMedia가 없으면(테스트) 폰으로 본다 */
const QUERY = '(min-width: 1024px)'

const isPc = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches

export function useIsPc(): boolean {
  const [pc, setPc] = useState(isPc)
  useEffect(() => {
    if (!window.matchMedia) return
    const on = () => setPc(isPc())
    // 창 크기를 바꾸면 바로 바뀌게 — 브라우저에 따라 change가 안 오는 경우가 있어 resize도 본다
    const mq = window.matchMedia(QUERY)
    mq.addEventListener('change', on)
    window.addEventListener('resize', on)
    return () => {
      mq.removeEventListener('change', on)
      window.removeEventListener('resize', on)
    }
  }, [])
  return pc
}
