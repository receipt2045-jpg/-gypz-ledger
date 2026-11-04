import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Legal from './Legal'

const html = readFileSync(join(process.cwd(), 'public/privacy.html'), 'utf-8')

describe('개인정보처리방침 — 푸시 알림 (2026-11-04)', () => {
  it('앱 안 방침에 푸시 토큰·FCM 국외 이전·광고 알림 동의·철회가 있다', () => {
    render(
      <MemoryRouter initialEntries={['/legal/privacy']}>
        <Routes>
          <Route path="/legal/:doc" element={<Legal />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('시행일 2026-11-04')).toBeInTheDocument()
    const text = document.body.textContent ?? ''
    expect(text).toContain('푸시 토큰')
    expect(text).toContain('Firebase Cloud Messaging')
    expect(text).toContain('(광고)')
    expect(text).toContain('설정 > 알림')
    expect(text).toContain('보낸 알림 기록')
    expect(text).toContain('회원 탈퇴 시까지')
  })

  it('정적 사본(public/privacy.html)도 같이 고쳤다', () => {
    expect(html).toContain('시행일 2026-11-04')
    expect(html).toContain('푸시 토큰')
    expect(html).toContain('Firebase Cloud Messaging')
    expect(html).toContain('(광고)')
    expect(html).toContain('보낸 알림 기록')
    expect(html).toContain('회원 탈퇴 시까지')
  })
})
