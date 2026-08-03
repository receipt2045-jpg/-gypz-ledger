import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// supabase 클라이언트를 통째로 가짜로 — 네트워크 없이 RPC 응답만 흉내낸다
const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  },
}))

import Login from './Login'

describe('로그인 화면 — 가구 수 표시', () => {
  beforeEach(() => rpc.mockReset())

  it('가구 수를 받아오면 "N가구가 함께 쓰고 있어요"가 보인다', async () => {
    rpc.mockResolvedValue({ data: 37, error: null })
    render(<Login />)
    await waitFor(() => expect(screen.getByText('37')).toBeInTheDocument())
    expect(screen.getByText(/가구가 함께 쓰고 있어요/)).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('public_household_count')
  })

  it('10가구 미만이면 초라해 보이니 줄 자체를 숨긴다', async () => {
    rpc.mockResolvedValue({ data: 3, error: null })
    render(<Login />)
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    expect(screen.queryByText(/가구가 함께 쓰고 있어요/)).not.toBeInTheDocument()
  })

  it('RPC가 실패해도 로그인 화면은 멀쩡하다', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    render(<Login />)
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    expect(screen.getByText('우리집 가계부')).toBeInTheDocument()
    expect(screen.queryByText(/가구가 함께 쓰고 있어요/)).not.toBeInTheDocument()
  })
})
