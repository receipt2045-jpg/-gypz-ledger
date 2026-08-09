/**
 * 배우자 초대 — 코드를 '찾아서 알려주는' 일을 없앤다.
 *
 * 실측: 혼자 남은 가구가 50집(70%)이고, 배우자가 합류하면 첫 정산 완주율이
 * 7배로 뛴다. 초대가 병목이라 한 번 눌러 카톡으로 보내지게 만든다.
 */

const APP_URL = 'https://moabuli.com/?src=invite'

export function inviteMessage(code: string): string {
  return [
    '우리 가계부 같이 써요 🤍',
    '',
    '아래 링크로 들어와서 초대 코드를 넣으면 돼요.',
    `초대 코드: ${code}`,
    APP_URL,
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
