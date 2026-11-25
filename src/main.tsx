import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import { hashFromPath } from './lib/pathToHash'
import { isNative } from './lib/native'
import { installNativeShell } from './lib/nativeShell'
import { installPush } from './lib/pushNative'

// 링크 서비스가 #을 떼고 열어도(moabuli.com/leave, /%23/leave) 원래 화면으로 간다
const fixed = hashFromPath(window.location.pathname, window.location.search, window.location.hash)
if (fixed) window.history.replaceState(null, '', fixed)

// 앱(하이브리드)일 때만 뒤로가기·바깥 링크·앱 링크를 처리한다
installNativeShell()
// 앱일 때만: 알림 채널·토큰·알림 누르면 그 화면으로 (2026-11-04)
installPush()

// 앱 설치용 서비스 워커 — 배포본에서만(앱에선 오프라인을 앱이 처리하므로 등록 안 함). 화면 파일은 저장하지 않는다(public/sw.js 참고)
if (import.meta.env.PROD && 'serviceWorker' in navigator && !isNative()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 등록 실패해도 앱은 그대로 쓴다 */
    })
  })
}

// 새로 배포된 직후 옛 화면을 열어 둔 채로 다른 화면으로 가면 지워진 옛 파일을 찾다가 흰 화면이 된다
// (2026-11-19 제보). 그럴 땐 새 파일로 한 번만 다시 연다 — 1분 안에 또 나면 무한 새로고침을 막으려 멈춘다.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('moabuli.reloadedAt') ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem('moabuli.reloadedAt', String(Date.now()))
  } catch {
    /* 기록 못 해도 다시 연다 */
  }
  event.preventDefault()
  window.location.reload()
})

// GitHub Pages는 SPA 경로 새로고침 시 404를 반환하므로 해시 라우팅 사용
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
