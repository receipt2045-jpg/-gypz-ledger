import type { Profile } from '../types'

// 구성원 색상 팔레트 (6색). 값은 Tailwind가 스캔하도록 전부 리터럴로 유지.
export type MemberColor = 'blue' | 'pink' | 'green' | 'purple' | 'orange' | 'slate'

export const MEMBER_COLORS: MemberColor[] = ['blue', 'pink', 'green', 'purple', 'orange', 'slate']

interface ColorStyle {
  avatar: string // 아바타 원형 (배경 + 아이콘색)
  badge: string // 소유자 배지
  dot: string // 팔레트 스와치 색
}

export const COLOR_STYLE: Record<MemberColor, ColorStyle> = {
  blue: { avatar: 'bg-brand/10 text-brand', badge: 'bg-brand/10 text-brand', dot: 'bg-brand' },
  pink: { avatar: 'bg-pink-50 text-pink-500', badge: 'bg-pink-50 text-pink-500', dot: 'bg-pink-500' },
  green: {
    avatar: 'bg-emerald-50 text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-600',
    dot: 'bg-emerald-500',
  },
  purple: {
    avatar: 'bg-violet-50 text-violet-600',
    badge: 'bg-violet-50 text-violet-600',
    dot: 'bg-violet-500',
  },
  orange: {
    avatar: 'bg-orange-50 text-orange-600',
    badge: 'bg-orange-50 text-orange-600',
    dot: 'bg-orange-500',
  },
  slate: {
    avatar: 'bg-slate-100 text-slate-600',
    badge: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-500',
  },
}

const DEFAULTS: [MemberColor, MemberColor] = ['blue', 'pink']

/** 구성원 번호로 색상 키 (저장 안 됐으면 기본값: 1=파랑, 2=핑크) */
export function memberColor(memberNo: 1 | 2, profile: Profile): MemberColor {
  const raw = memberNo === 1 ? profile.member1Color : profile.member2Color
  return MEMBER_COLORS.includes(raw as MemberColor) ? (raw as MemberColor) : DEFAULTS[memberNo - 1]
}

export function memberStyle(memberNo: 1 | 2, profile: Profile): ColorStyle {
  return COLOR_STYLE[memberColor(memberNo, profile)]
}

/** 소유자 이름 기준 배지 색 (부부는 각자 색, 자녀는 노랑, 공동은 중립) */
export function ownerBadge(
  owner: string | undefined,
  profile: Profile,
  childNames: string[],
): string {
  if (owner && owner === profile.member1Name) return COLOR_STYLE[memberColor(1, profile)].badge
  if (owner && owner === profile.member2Name) return COLOR_STYLE[memberColor(2, profile)].badge
  if (owner && childNames.includes(owner)) return 'bg-amber-50 text-amber-600'
  return 'bg-bg text-sub'
}
