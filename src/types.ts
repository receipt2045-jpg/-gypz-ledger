export type CategoryGroup = 'income' | 'saving' | 'investment' | 'fixed' | 'variable'
// 그룹 라벨: 수입, 저축, 투자, 고정지출, 변동지출

/**
 * 모을 돈 목표 — 자산 로드맵의 기준점.
 * 집·집값은 넣지 않는다. 금액과 시점만 사용자가 정하고, 나머지는 정산에서 계산한다.
 */
export interface SavingsGoal {
  amount: number // 목표 금액(원)
  targetYm: string // 'YYYY-MM'
  name?: string // 비워도 된다 ("1억", "아이 학자금"…)
  role1?: string // 이 목표에서 구성원 1이 맡는 것
  role2?: string
  reason?: string // 이 돈을 모으는 이유 — 홈에도 한 줄로 띄운다
  createdYm?: string // 세운 달
  /**
   * 세울 때 자산(원). '모을 돈'은 지금 자산 위에 새로 얹는 돈이라,
   * 진행은 (지금 자산 − 이 값)으로 센다. 목표를 고쳐도 이 값은 유지한다 —
   * 고칠 때마다 0%로 돌아가면 안 된다.
   */
  baseAssets?: number
}

export interface Profile {
  member1Name: string // 기본 "남편"
  member2Name: string // 기본 "아내"
  member1Color?: string // 아바타 색상 키 (없으면 blue) — lib/memberColors
  member2Color?: string // 아바타 색상 키 (없으면 pink)
  childNames?: string[] // 자녀 (자산 소유자로 사용, 예: "첫째", "자녀1")
  targetNetWorth: number // 10년 목표 순자산(원)
  startYear: number
  goal?: SavingsGoal // 없으면 로드맵이 '목표 넣기 전' 화면을 보여준다
  roadmap?: Roadmap // 자산 로드맵 페이지(/roadmap)의 가정·계획. 없으면 기본값으로 계산한다
}

/** 로드맵에 넣는 큰일. 종류마다 쓰는 칸이 다르다 — lib/roadmap.flowAt 참고 */
export type RoadmapEventKind = 'house' | 'child' | 'leave' | 'car' | 'job' | 'parents' | 'custom'

export interface RoadmapEvent {
  id: string
  kind: RoadmapEventKind
  ym: string // 시작 달 'YYYY-MM' (자녀는 태어난 달)
  title?: string // 직접 입력·자녀 이름
  once?: number // 한 번에 나가는 돈(원) — 차, 부모님 목돈, 직접 입력
  monthly?: number // 매달 덜 모이는 돈(원). 이직처럼 더 모이면 음수
  months?: number // 기간(개월). 없으면 계속 — 육아휴직·부모님 지원·직접 입력
  price?: number // 집값
  loan?: number // 대출
  member?: 1 | 2 // 육아휴직 쓰는 사람
}

/** 자산 로드맵 가정. 비워 둔 값은 가계부 기록으로 채운다 */
export interface Roadmap {
  targetYear?: number // 목표 연도 (없으면 startYear + 10)
  monthlySaving?: number // 한 달 저축 직접 입력 (없으면 최근 가계부 평균)
  income1?: number // 월소득 직접 입력 (없으면 최근 가계부 평균)
  income2?: number
  returnRate?: number // 연 수익률 (기본 0.05)
  incomeGrowth?: number // 연 소득 상승률 — 저축도 같이 는다고 본다 (기본 0.03)
  realTerms?: boolean // 물가 빼고 지금 돈 가치로 보기
  events: RoadmapEvent[]
}

export interface BudgetItem {
  id: string
  group: CategoryGroup
  category: string // 예: 주수입, 식비, 예금...
  member: 1 | 2 // 구성원
  planned: number // 예산
  actual: number // 결산(실제)
  note?: string
}

export interface MonthlyLedger {
  ym: string // "2026-07"
  items: BudgetItem[]
  closed: boolean // 결산 완료 여부 (두 구성원 모두 정산하면 true)
  settledMembers?: (1 | 2)[] // 정산을 마친 구성원
}

export type AssetGroup = 'cash' | 'stock' | 'realestate' | 'pension' | 'consumable'
// 라벨: 예적금, 투자, 집(전월세 보증금·내 집), 연금, 기타(자동차 등) — constants.ASSET_GROUP_LABEL

export interface AssetItem {
  id: string
  kind: 'asset' | 'debt'
  group: AssetGroup
  name: string // 예: 토스 비상금, 신한 청약
  amount: number // 원화 환산액(원). 외화 항목은 마지막 계산 시점 값(폴백용)
  currency?: string // 통화 코드 (없으면 KRW). USD/EUR/JPY = 외화
  fxAmount?: number // 외화 원금 (currency가 외화일 때). 원화 환산은 실시간 환율로 계산
  owner?: string // 남편/아내/공동
  note?: string
}

export interface AssetSnapshot {
  ym: string // 월 단위 스냅샷
  items: AssetItem[]
}

export interface OccasionEntry {
  // 경조사/연간비 기록
  id: string
  date: string // "2026-05-18"
  category: string // 가족경조사/지인경조사/기타
  title: string
  amount: number
}

export interface Confession {
  // 일일 고백 = 지출/수입 1건. 습관·잔소리용 로그이며 월간 정산과 완전 분리.
  id: string
  memberNo: 1 | 2
  category: string
  kind: CategoryGroup
  amount: number // 원
  note?: string // 선택적 한 마디 (예: "회식 대신 집밥")
  // 누구 카드로 썼는지 (1|2). 연말정산 카드 공제는 명의자 기준으로 계산돼서,
  // 이게 쌓이면 '오늘 누구 카드를 쓸까'를 실제 사용액으로 판단할 수 있다.
  cardOwner?: 1 | 2
  /**
   * 공동 지출. 부부 공동 생활비처럼 한 사람 것으로 가를 수 없는 돈.
   * memberNo에는 '적은 사람'이 들어간다 — 정산은 사람별이라 누군가의 몫으로는 잡혀야 하고,
   * 적은 사람이 정산 때 자기 항목으로 넣는 게 가장 자연스럽다.
   */
  shared?: boolean
  createdAt: string // ISO
}

export type Categories = Record<CategoryGroup, string[]>

export interface AppData {
  profile: Profile
  ledgers: MonthlyLedger[]
  snapshots: AssetSnapshot[]
  occasions: OccasionEntry[]
  categories: Categories
}
