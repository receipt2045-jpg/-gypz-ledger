import { Component, type ErrorInfo, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

/**
 * 화면을 그리다 오류가 나면 흰 화면 대신 안내를 띄운다 (2026-11-19 제보: "공유 링크를 누르면 흰 화면").
 * 예전엔 오류를 잡는 곳이 없어서 한 군데만 깨져도 앱 전체가 하얗게 됐고, 무슨 오류인지도 알 수 없었다.
 * 어떤 오류였는지는 의견함(feedback)에 '[자동 오류]'로 남긴다 — 화면 주소·오류 글·기기 종류만.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    reportError(error, info.componentStack ?? '')
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-[360px] rounded-card bg-card p-6 text-center shadow-card">
          <p className="text-[17px] font-bold text-ink">화면을 여는 중에 문제가 생겼어요</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-sub">
            다시 열면 대부분 바로 보여요. 계속 이러면 알려 주세요 — 어떤 문제였는지는 저절로
            전해졌어요.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 h-12 w-full rounded-btn bg-brand text-[15px] font-bold text-white active:bg-brand-dark"
          >
            다시 열기
          </button>
          <button
            onClick={() => {
              window.location.hash = '#/'
              window.location.reload()
            }}
            className="mt-2 h-11 w-full rounded-btn bg-bg text-[14px] font-semibold text-sub active:bg-line"
          >
            홈으로
          </button>
          <p className="mt-4 break-all text-[11px] text-cap">{error.message}</p>
        </div>
      </div>
    )
  }
}

/** 같은 오류를 계속 보내지 않게 이 기기에서 한 번만 */
function reportError(error: Error, stack: string) {
  try {
    const key = `moabuli.err.${error.message.slice(0, 80)}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    /* 저장 못 해도 보낸다 */
  }
  const message = [
    `[자동 오류] ${error.message}`,
    `화면: ${window.location.hash || '#/'}`,
    `기기: ${navigator.userAgent}`,
    (error.stack ?? '').split('\n').slice(0, 4).join(' / '),
    stack.split('\n').slice(0, 4).join(' / '),
  ]
    .join('\n')
    .slice(0, 1900)
  void supabase.auth
    .getUser()
    .then(({ data }) =>
      supabase.from('feedback').insert({
        user_id: data.user?.id ?? null,
        rating: null,
        message,
        screen: `error:${window.location.hash.slice(1, 60) || '/'}`,
        app_version: 'v1.0',
      }),
    )
    .catch(() => undefined)
}
