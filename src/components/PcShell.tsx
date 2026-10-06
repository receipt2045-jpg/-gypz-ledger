import type { ReactNode } from 'react'
import { SideNav } from './TabBar'

/**
 * 탭 밖 화면(로드맵·정산하기·소비 기록 등)도 PC에서는 왼쪽 메뉴를 같이 (2026-10-06).
 * 폰에서는 아무것도 안 한다 — 메뉴는 lg 이상에서만 보인다.
 */
export default function PcShell({
  children,
  active,
}: {
  children: ReactNode
  /** 이 화면이 속한 탭 — 메뉴에 불을 켠다 (예: 로드맵 → 자산) */
  active?: string
}) {
  return (
    <div className="lg:flex lg:min-h-screen lg:bg-bg">
      <SideNav active={active} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
