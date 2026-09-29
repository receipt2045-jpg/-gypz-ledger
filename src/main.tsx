import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { hashFromPath } from './lib/pathToHash'

// 링크 서비스가 #을 떼고 열어도(moabuli.com/leave, /%23/leave) 원래 화면으로 간다
const fixed = hashFromPath(window.location.pathname, window.location.search, window.location.hash)
if (fixed) window.history.replaceState(null, '', fixed)

// GitHub Pages는 SPA 경로 새로고침 시 404를 반환하므로 해시 라우팅 사용
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
