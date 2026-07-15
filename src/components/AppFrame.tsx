import { Outlet } from 'react-router-dom'
import TabBar from './TabBar'

export default function AppFrame() {
  return (
    <div className="flex min-h-screen justify-center">
      <div className="relative flex w-full max-w-app flex-col bg-bg shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        <main className="flex-1 px-5 pb-28 pt-4">
          <Outlet />
        </main>
        <TabBar />
      </div>
    </div>
  )
}
