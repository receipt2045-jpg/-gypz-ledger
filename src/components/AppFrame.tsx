import { Outlet } from 'react-router-dom'
import TabBar, { SideNav } from './TabBar'

/**
 * 앱 틀. 폰: 가운데 480px + 아래 탭. PC(가로 1024px 이상): 왼쪽 메뉴 + 넓은 본문 (2026-10-06).
 * 화면 안에서 두 칸으로 나누는 건 각 화면이 PcColumns로 한다.
 */
export default function AppFrame() {
  return (
    <div className="flex min-h-screen justify-center lg:justify-start">
      <SideNav />
      <div className="relative flex w-full max-w-app flex-col bg-bg shadow-[0_0_60px_rgba(0,0,0,0.06)] lg:max-w-none lg:shadow-none">
        <main className="flex-1 px-5 pb-28 pt-4 lg:mx-auto lg:w-full lg:max-w-[1040px] lg:px-10 lg:pb-16 lg:pt-8">
          <Outlet />
        </main>
        <TabBar />
      </div>
    </div>
  )
}
