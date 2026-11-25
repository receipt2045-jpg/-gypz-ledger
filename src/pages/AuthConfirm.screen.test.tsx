import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const verifyOtp = vi.fn()
const getSession = vi.fn().mockResolvedValue({ data: { session: null } })
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { verifyOtp: (o: unknown) => verifyOtp(o), getSession: () => getSession() } },
}))
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

  // 2026-11-26 보안 점검: 이미 로그인돼 있으면 남의 메일 링크로 계정이 바뀌기 전에 묻는다
  it('이미 로그인돼 있으면 계정을 바꾸기 전에 묻고, 그대로 두면 확인하지 않는다', async () => {
    verifyOtp.mockClear()
    getSession.mockResolvedValueOnce({ data: { session: { user: { email: 'me@test.dev' } } } })
    at('token_hash=other&type=recovery')
    expect(await screen.findByText('다른 계정의 메일 링크예요')).toBeInTheDocument()
    expect(screen.getByText('me@test.dev')).toBeInTheDocument()
    expect(verifyOtp).not.toHaveBeenCalled()
    screen.getByRole('button', { name: '지금 계정 그대로' }).click()
    await waitFor(() => expect(screen.getByText('홈 화면')).toBeInTheDocument())
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('직접 요청한 링크라며 계속하면 그때 확인한다', async () => {
    verifyOtp.mockClear()
    verifyOtp.mockResolvedValueOnce({ error: null })
    getSession.mockResolvedValueOnce({ data: { session: { user: { email: 'me@test.dev' } } } })
    at('token_hash=mine&type=recovery')
    ;(await screen.findByRole('button', { name: '링크 계정으로 계속' })).click()
    await waitFor(() => expect(screen.getByText('설정 화면')).toBeInTheDocument())
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'mine', type: 'recovery' })
  })

  it('토큰이 없는 주소도 안내한다', async () => {
    at('type=signup')
    expect(await screen.findByText('링크가 만료됐어요. 다시 요청해 주세요.')).toBeInTheDocument()
  })
})
