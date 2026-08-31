/**
 * 배우자 초대 — 코드를 '찾아서 옮겨 적는' 일을 없앤다.
 *
 * 실측(8/26~8/31): 새로 시작한 66집 중 배우자가 따라 들어온 건 12집(18%)뿐이다.
 * 정산은 둘 다 해야 끝나므로, 혼자 남은 집은 앱의 절반만 쓰다 나간다.
 * 병목은 '코드 8자리를 받아 적어 입력하는 단계'라서, 링크에 코드를 심어
 * 누르면 참여 화면까지 바로 가게 한다.
 *
 * 자동 참여는 하지 않는다 — 초대 링크가 단톡방에 그대로 올라가는 일이 있어서,
 * 누른 사람이 모르는 사이 남의 가계부에 들어가는 사고를 막아야 한다.
 * 대신 코드가 채워진 '참여하기' 버튼 하나만 남긴다.
 */

const ORIGIN = 'https://moabuli.com'
const KEY = 'moabuli_invite'
export const CODE_RE = /^[0-9A-F]{8}$/ // invite_code = 4바이트 hex 대문자

/** 초대 링크 — HashRouter라 ?src=는 # 앞에, 코드는 해시 경로에 둔다. */
export function inviteLink(code: string): string {
  return `${ORIGIN}/?src=invite#/join/${code}`
}

export function inviteMessage(code: string): string {
  return [
    '우리 가계부 같이 써요 🤍',
    '',
    '아래 링크를 누르면 바로 연결돼요.',
    inviteLink(code),
  ].join('\n')
}

/**
 * 공유 시트를 띄우고, 안 되면 클립보드로 떨어뜨린다.
 * 모바일은 카톡으로 바로 보낼 수 있고, PC는 붙여넣기용으로 복사된다.
 */
export async function shareInvite(code: string): Promise<'shared' | 'copied' | 'failed'> {
  const text = inviteMessage(code)

  if (navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (err) {
      // 사용자가 공유 시트를 닫은 것 — 복사로 내려가지 않고 조용히 끝낸다
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

// ── 초대 링크로 들어온 사람 ────────────────────

/** 해시 경로(#/join/CODE)에서 초대 코드를 뽑는다. 형식이 안 맞으면 null. */
export function codeFromHash(hash: string): string | null {
  const m = /^#\/join\/([^/?#]+)/.exec(hash)
  if (!m) return null
  const code = decodeURIComponent(m[1]).toUpperCase()
  return CODE_RE.test(code) ? code : null
}

/**
 * 앱 진입 시 1회 호출. 초대 링크로 왔으면 코드를 보관해 둔다.
 *
 * 구글 로그인은 다른 페이지를 거쳐 돌아오면서 주소의 해시를 날린다.
 * 로그인 '전에' 저장해 두지 않으면 돌아왔을 때 코드가 사라져 있다.
 */
export function capturePendingInvite(): void {
  try {
    const code = codeFromHash(window.location.hash)
    if (code) localStorage.setItem(KEY, code)
  } catch {
    // 시크릿 모드 등 localStorage 불가 — 코드 입력으로 돌아가면 된다
  }
}

/** 보관해 둔 초대 코드 (없으면 null). */
export function pendingInvite(): string | null {
  try {
    const code = localStorage.getItem(KEY)
    return code && CODE_RE.test(code) ? code : null
  } catch {
    return null
  }
}

/** 참여했거나, 새로 만들기를 택했을 때 지운다. */
export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 못 지워도 참여 후엔 이 화면 자체가 안 나온다
  }
}
