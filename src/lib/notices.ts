/**
 * 게시판 '공지' — 새 기능 소식. 글쓰기 기능이 생기기 전까지 여기에 직접 적는다.
 * 새 글은 맨 위에 추가한다.
 */
export interface Notice {
  id: string
  /** YYYY-MM-DD */
  date: string
  title: string
  body: string
  points?: string[]
  /** 눌러서 바로 가는 곳 (앱 안 경로) */
  link?: { to: string; label: string }
}

export const NOTICES: Notice[] = [
  {
    id: 'leave-calculator',
    date: '2026-09-30',
    title: '🍼 육아휴직 계산기가 나왔어요',
    body: '휴직하면 우리집에 달마다 얼마가 모이는지 미리 볼 수 있어요.',
    points: [
      '누가 쉬는지(아내·남편·둘 다), 몇 개월 쉬는지 고를 수 있어요',
      '육아휴직급여, 부모급여, 아동수당까지 넣어서 계산해요',
      "'내 가계부 숫자로 계산하기'를 누르면 가계부 숫자로 바로 채워져요",
      '결과는 남편한테 링크로 보내거나 이미지로 저장할 수 있어요',
    ],
    link: { to: '/leave', label: '계산해보기' },
  },
]
