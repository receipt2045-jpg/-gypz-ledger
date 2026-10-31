import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const verifyOtp = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { auth: { verifyOtp: (o: unknown) => verifyOtp(o) } } }))
import AuthConfirm from './AuthConfirm'

const at = (q: string) =>
  render(
    <MemoryRouter initialEntries={[`/auth/confirm?${q}`]}>
      <Routes>
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/" element={<p>홈 화면</p>} />
        <Route path="/settings" element={<p>설정 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('AuthConfirm', () => {
  it('가입 확인 링크를 처리하고 홈으로 보낸다', async () => {
    verifyOtp.mockResolvedValueOnce({ error: null })
    at('token_hash=abc&type=signup')
    await waitFor(() => expect(screen.getByText('홈 화면')).toBeInTheDocument())
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'signup' })
  })

  it('비밀번호 재설정 링크는 설정 화면으로 보낸다', async () => {
    verifyOtp.mockResolvedValueOnce({ error: null })
    at('token_hash=r1&type=recovery')
    await waitFor(() => expect(screen.getByText('설정 화면')).toBeInTheDocument())
  })

  it('만료된 링크면 안내한다', async () => {
    verifyOtp.mockResolvedValueOnce({ error: { message: 'expired' } })
    at('token_hash=old&type=recovery')
    expect(await screen.findByText('링크가 만료됐어요. 다시 요청해 주세요.')).toBeInTheDocument()
  })

  it('토큰이 없는 주소도 안내한다', async () => {
    at('type=signup')
    expect(await screen.findByText('링크가 만료됐어요. 다시 요청해 주세요.')).toBeInTheDocument()
  })
})
