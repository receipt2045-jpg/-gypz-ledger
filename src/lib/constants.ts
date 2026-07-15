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
  income: ['주수입', '부수입', '투자수익'],
  saving: ['주택청약', '예금', '적금', '연금', '목적저금'],
  investment: ['주식', '부동산', '코인'],
  fixed: ['보험', '통신', '용돈', '주거', '구독'],
  variable: [
    '식비',
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
  ],
}

export const OCCASION_CATEGORIES = ['가족경조사', '지인경조사', '기타']
