// ── 처음 쓰는 집 시작 가이드 (2026-10-23) ──
// 가입한 집의 76%가 아무것도 안 하고 떠났다. 할 일을 한 번에 하나씩, 홈 맨 위에서 보여준다.
// 순서는 결영이네가 정했다: 자산 → 이번 달 예산 → 오늘 쓴 돈 → 연말정산 계산기 → 다른 계산기.
// 앞의 셋은 실제 데이터로 체크하고, 계산기 둘은 한 번 눌러 보면 체크한다(이 기기 기준).

export type StartStepKey = 'assets' | 'budget' | 'confess' | 'yearEnd' | 'calcs'

export const START_STEPS: { key: StartStepKey; label: string; hint: string; cta: string }[] = [
  {
    key: 'assets',
    label: '우리집 자산 넣기',
    hint: '통장·주식·집·대출을 넣으면 순자산이 보여요. 대략이어도 괜찮아요',
    cta: '자산 넣기',
  },
  {
    key: 'budget',
    label: '이번 달 예산 세우기',
    hint: '월급·생활비만 채워도 이번 달 남는 돈이 보여요',
    cta: '예산 세우기',
  },
  {
    key: 'confess',
    label: '오늘 쓴 돈 적기',
    hint: "'점심 9천원'처럼 말하면 끝이에요",
    cta: '기록하기',
  },
  {
    key: 'yearEnd',
    label: '연말정산 계산기 보기',
    hint: '누구 카드를 써야 환급이 더 많은지 알려드려요',
    cta: '계산해 보기',
  },
  {
    key: 'calcs',
    label: '다른 돈 계산기 둘러보기',
    hint: '육아휴직·대출 이자·집 살 때 드는 돈까지 계산해요',
    cta: '계산기 보기',
  },
]

const SEEN_KEY = 'moabuli.startGuide.seen'
const HIDE_KEY = 'moabuli.startGuide.hidden'

/** 계산기처럼 '눌러 보면 끝'인 단계 — 이 기기에서 본 것 */
export function readStartSeen(): StartStepKey[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function markStartSeen(key: StartStepKey) {
  try {
    const seen = readStartSeen()
    if (!seen.includes(key)) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, key]))
  } catch {
    // 저장이 막힌 브라우저 — 다음에 또 보일 뿐이다
  }
}

export function isStartGuideHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

export function hideStartGuide() {
  try {
    localStorage.setItem(HIDE_KEY, '1')
  } catch {
    // 위와 같다
  }
}
