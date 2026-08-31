import { beforeEach, describe, expect, it } from 'vitest'
import {
  capturePendingInvite,
  clearPendingInvite,
  codeFromHash,
  inviteLink,
  inviteMessage,
  pendingInvite,
} from './invite'

const CODE = '3F2A9C1B'

beforeEach(() => localStorage.clear())

describe('초대 링크', () => {
  it('코드가 링크 안에 들어간다 — 받아 적을 게 없다', () => {
    expect(inviteLink(CODE)).toBe(`https://moabuli.com/?src=invite#/join/${CODE}`)
  })

  it('유입 채널(?src=)은 # 앞에 남는다 — 해시 뒤에 두면 못 읽는다', () => {
    const url = new URL(inviteLink(CODE))
    expect(url.searchParams.get('src')).toBe('invite')
    expect(url.hash).toBe(`#/join/${CODE}`)
  })

  it('메시지에 링크가 들어가고, 코드를 따로 적으라고 하지 않는다', () => {
    const msg = inviteMessage(CODE)
    expect(msg).toContain(inviteLink(CODE))
    expect(msg).not.toContain('초대 코드를 넣으면')
  })
})

describe('해시에서 코드 읽기', () => {
  it('초대 경로에서 코드를 뽑는다', () => {
    expect(codeFromHash(`#/join/${CODE}`)).toBe(CODE)
  })

  it('소문자로 와도 대문자로 맞춘다', () => {
    expect(codeFromHash('#/join/3f2a9c1b')).toBe(CODE)
  })

  it('뒤에 뭐가 더 붙어도 코드만 읽는다', () => {
    expect(codeFromHash(`#/join/${CODE}?src=kakao`)).toBe(CODE)
  })

  it('다른 화면 주소는 무시한다', () => {
    expect(codeFromHash('#/confess')).toBeNull()
    expect(codeFromHash('')).toBeNull()
  })

  it('형식이 안 맞는 코드는 받지 않는다', () => {
    expect(codeFromHash('#/join/ABC')).toBeNull() // 짧음
    expect(codeFromHash('#/join/ZZZZZZZZ')).toBeNull() // hex 아님
    expect(codeFromHash('#/join/../../etc')).toBeNull()
  })
})

describe('로그인을 건너뛰어도 코드가 남는다', () => {
  // 구글 로그인은 다른 페이지를 거쳐 돌아오면서 해시를 날린다.
  // 로그인 전에 저장해 두지 않으면 돌아왔을 때 코드가 사라져 있다.
  it('주소에서 코드를 챙겨 두고, 나중에 꺼내 쓴다', () => {
    window.location.hash = `#/join/${CODE}`
    capturePendingInvite()
    window.location.hash = '' // 로그인 다녀오면서 해시가 날아간 상황
    expect(pendingInvite()).toBe(CODE)
  })

  it('참여하고 나면 지운다', () => {
    window.location.hash = `#/join/${CODE}`
    capturePendingInvite()
    clearPendingInvite()
    expect(pendingInvite()).toBeNull()
  })

  it('초대 링크가 아니면 아무것도 저장하지 않는다', () => {
    window.location.hash = '#/'
    capturePendingInvite()
    expect(pendingInvite()).toBeNull()
  })

  it('저장소에 이상한 값이 들어 있으면 무시한다', () => {
    localStorage.setItem('moabuli_invite', 'not-a-code')
    expect(pendingInvite()).toBeNull()
  })
})
