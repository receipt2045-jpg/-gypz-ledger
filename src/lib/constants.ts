import type { AssetGroup, CategoryGroup, Categories } from '../types'

export const GROUP_LABEL: Record<CategoryGroup, string> = {
  income: '수입',
  saving: '저축',
  investment: '투자',
  fixed: '고정지출',
  variable: '변동지출',
}

export const GROUP_ORDER: CategoryGroup[] = ['income', 'saving', 'investment', 'fixed', 'variable']

// 수입은 파랑(양수), 지출 그룹은 빨강 계열 액센트
export const GROUP_ACCENT: Record<CategoryGroup, string> = {
  income: 'text-brand',
  saving: 'text-brand',
  investment: 'text-brand',
  fixed: 'text-ink',
  variable: 'text-ink',
}

export const ASSET_GROUP_LABEL: Record<AssetGroup, string> = {
  cash: '현금성',
  stock: '주식/코인',
  realestate: '부동산',
  pension: '연금/보험',
  consumable: '소비재',
}

export const ASSET_GROUP_ORDER: AssetGroup[] = ['cash', 'stock', 'realestate', 'pension', 'consumable']

export const DEFAULT_CATEGORIES: Categories = {
  income: ['주수입', '부수입', '투자수익', '기타'],
  saving: ['주택청약', '예금', '적금', '연금', '목적저금', '기타'],
  investment: ['주식', '부동산', '코인', '기타'],
  fixed: ['보험', '통신', '용돈', '주거', '구독', '기타'],
  variable: [
    '식비',
    '배달',
    '카페',
    '생활용품',
    '건강',
    '육아',
    '꾸밈',
    '자기계발',
    '여행',
    '자동차',
    '문화생활',
    '세금',
    '반려견',
    '경조사',
    '기타',
  ],
}

// 용어 툴팁 문구 (개선브리프 5장 최종본 그대로)
export const TERM_TIP = {
  netWorth: '자산에서 부채를 뺀, 진짜 내 재산입니다',
  surplus: '수입에서 저축·투자·지출을 빼고 남은 돈이에요',
  savingRate: '번 돈 중 저축·투자로 간 비율입니다',
  purposeSaving: '여행·비상금처럼 목적을 정해 모으는 돈이에요',
  cash: '바로 꺼내 쓸 수 있는 예금·현금입니다',
} as const

export const OCCASION_CATEGORIES = ['가족경조사', '지인경조사', '기타']
