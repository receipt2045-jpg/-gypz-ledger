import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

const insert = vi.hoisted(() => vi.fn(async () => ({ error: null })))
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ insert }),
  },
}))

function Boom(): never {
  throw new Error('터졌다')
}

describe('ErrorBoundary — 흰 화면 대신 안내 (2026-11-19)', () => {
  it('화면이 깨지면 다시 열기 안내와 오류 글을 보여 주고, 의견함에 남긴다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('화면을 여는 중에 문제가 생겼어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 열기' })).toBeInTheDocument()
    expect(screen.getByText('터졌다')).toBeInTheDocument()
    await vi.waitFor(() => expect(insert).toHaveBeenCalled())
    const row = (insert.mock.calls[0] as unknown as [{ message: string }])[0]
    expect(row.message).toContain('[자동 오류] 터졌다')
  })

  it('문제가 없으면 그대로', () => {
    render(
      <ErrorBoundary>
        <p>잘 보여요</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('잘 보여요')).toBeInTheDocument()
  })
})
