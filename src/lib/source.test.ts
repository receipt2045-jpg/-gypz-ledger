import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

const updateUser = vi.fn().mockResolvedValue({ data: {}, error: null })
vi.mock('./supabase', () => ({ supabase: { auth: { get updateUser() { return updateUser } } } }))

import { attachSourceToUser, captureSource } from './source'

const user = (meta: Record<string, unknown> = {}) => ({ user_metadata: meta }) as unknown as User

function visit(query: string) {
  window.history.replaceState(null, '', `/${query}`)
  captureSource()
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('유입 채널 기록', () => {
  it('?src=kakao 로 오면 기억해 뒀다가 가입 후 계정에 남긴다', async () => {
    visit('?src=kakao')
    await attachSourceToUser(user())
    expect(updateUser).toHaveBeenCalledWith({ data: { signupSrc: 'kakao' } })
    expect(localStorage.getItem('moabuli_src')).toBeNull() // 옮겼으면 지운다
  })

  it('src 없이 오면 아무것도 기록하지 않는다', async () => {
    visit('')
    await attachSourceToUser(user())
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('처음 데려온 채널이 기준 — 두 번째 링크는 덮어쓰지 않는다', () => {
    visit('?src=kakao')
    visit('?src=insta')
    expect(localStorage.getItem('moabuli_src')).toBe('kakao')
  })

  it('이미 기록된 계정은 다시 쓰지 않는다', async () => {
    visit('?src=insta')
    await attachSourceToUser(user({ signupSrc: 'kakao' }))
    expect(updateUser).not.toHaveBeenCalled()
    expect(localStorage.getItem('moabuli_src')).toBeNull()
  })

  it('이상한 값은 무시한다 (링크 변조 대비)', () => {
    visit('?src=<script>alert(1)</script>')
    expect(localStorage.getItem('moabuli_src')).toBeNull()
  })
})
