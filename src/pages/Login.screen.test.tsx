import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// supabase 클라이언트를 통째로 가짜로 — 네트워크 없이 RPC 응답만 흉내낸다
const rpc = vi.fn()
const reset = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      resetPasswordForEmail: (...args: unknown[]) => reset(...args),
    },
  },
}))

import Login from './Login'

describe('로그인 화면 — 가입한 사람 수 표시', () => {
  beforeEach(() => rpc.mockReset())

  it('사람 수를 받아오면 "N명이 함께 쓰고 있어요"가 보인다', async () => {
    rpc.mockResolvedValue({ data: 7312, error: null })
    render(<Login />)
    await waitFor(() => expect(screen.getByText('7,312')).toBeInTheDocument())
    expect(screen.getByText(/명이 함께 쓰고 있어요/)).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('public_member_count')
  })

  it('10명 미만이면 초라해 보이니 줄 자체를 숨긴다', async () => {
    rpc.mockResolvedValue({ data: 3, error: null })
    render(<Login />)
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    expect(screen.queryByText(/명이 함께 쓰고 있어요/)).not.toBeInTheDocument()
  })

  it('RPC가 실패해도 로그인 화면은 멀쩡하다', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    render(<Login />)
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    expect(screen.getByText('모아불리 가계부')).toBeInTheDocument()
    expect(screen.queryByText(/명이 함께 쓰고 있어요/)).not.toBeInTheDocument()
  })

  it('예시 가계부로 돌아가는 링크가 있다 (2026-10-23)', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const onPreview = vi.fn()
    render(<Login onPreview={onPreview} />)
    screen.getByRole('button', { name: '가입 전에 예시 가계부 둘러보기' }).click()
    expect(onPreview).toHaveBeenCalled()
    await waitFor(() => expect(rpc).toHaveBeenCalled())
  })
})

describe('비밀번호를 잊었어요 (2026-11-19 점검)', () => {
  beforeEach(() => {
    rpc.mockResolvedValue({ data: null, error: null })
    reset.mockReset()
  })

  it('이메일이 없으면 먼저 적으라고 한다', async () => {
    render(<Login />)
    fireEvent.click(screen.getByRole('button', { name: '비밀번호를 잊었어요' }))
    expect(await screen.findByText(/가입한 이메일을 먼저 적어 주세요/)).toBeInTheDocument()
    expect(reset).not.toHaveBeenCalled()
  })

  it('이메일이 있으면 재설정 메일을 보내고 알려 준다', async () => {
    reset.mockResolvedValue({ error: null })
    render(<Login />)
    fireEvent.change(screen.getByPlaceholderText('이메일 주소'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호를 잊었어요' }))
    expect(await screen.findByText(/다시 정하는 메일을 보냈어요/)).toBeInTheDocument()
    expect(reset.mock.calls[0][0]).toBe('a@b.com')
  })
})
