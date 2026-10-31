import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { hashFromPath } from './lib/pathToHash'
import { isNative } from './lib/native'
import { installNativeShell } from './lib/nativeShell'

// 링크 서비스가 #을 떼고 열어도(moabuli.com/leave, /%23/leave) 원래 화면으로 간다
const fixed = hashFromPath(window.location.pathname, window.location.search, window.location.hash)
if (fixed) window.history.replaceState(null, '', fixed)

// 앱(하이브리드)일 때만 뒤로가기·바깥 링크·앱 링크를 처리한다
installNativeShell()

// 앱 설치용 서비스 워커 — 배포본에서만(앱에선 오프라인을 앱이 처리하므로 등록 안 함). 화면 파일은 저장하지 않는다(public/sw.js 참고)
if (import.meta.env.PROD && 'serviceWorker' in navigator && !isNative()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 등록 실패해도 앱은 그대로 쓴다 */
    })
  })
}

// GitHub Pages는 SPA 경로 새로고침 시 404를 반환하므로 해시 라우팅 사용
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
