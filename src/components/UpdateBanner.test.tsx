import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import UpdateBanner from './UpdateBanner'

/** 지금 돌고 있는 번들을 흉내내는 script 태그 */
function mountScript(name: string) {
  const s = document.createElement('script')
  s.src = `https://moabuli.com/assets/${name}`
  document.head.appendChild(s)
  return s
}

const html = (name: string) =>
  `<!doctype html><html><body><script type="module" src="/assets/${name}"></script></body></html>`

describe('새 버전 배너', () => {
  let script: HTMLScriptElement | null = null

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    script?.remove()
    script = null
    vi.unstubAllGlobals()
  })

  it('서버 번들이 다르면 배너가 뜬다', async () => {
    script = mountScript('index-OLD123.js')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => html('index-NEW456.js'),
    } as Response)

    render(<UpdateBanner />)
    await waitFor(() => expect(screen.getByText('새 버전이 나왔어요')).toBeInTheDocument())
  })

  it('같은 번들이면 조용히 있는다', async () => {
    script = mountScript('index-SAME.js')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => html('index-SAME.js'),
    } as Response)

    render(<UpdateBanner />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByText('새 버전이 나왔어요')).not.toBeInTheDocument()
  })

  // 오프라인이나 개발 모드에서 괜히 배너를 띄우면 안 된다
  it('통신이 실패해도 배너를 띄우지 않는다', async () => {
    script = mountScript('index-OLD123.js')
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))

    render(<UpdateBanner />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByText('새 버전이 나왔어요')).not.toBeInTheDocument()
  })

  it('번들 script가 없으면(개발 모드) 서버에 묻지도 않는다', async () => {
    render(<UpdateBanner />)
    await new Promise((r) => setTimeout(r, 10))
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByText('새 버전이 나왔어요')).not.toBeInTheDocument()
  })

  it('캐시를 타지 않게 no-store로 물어본다', async () => {
    script = mountScript('index-OLD123.js')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => html('index-NEW456.js'),
    } as Response)

    render(<UpdateBanner />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ cache: 'no-store' })
  })
})
