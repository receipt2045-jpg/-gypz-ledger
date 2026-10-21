import { supabase } from './supabase'
import { genId } from './carryover'

/**
 * 결영이네에게 텔레그램으로 알린다 (2026-10-21, supabase/functions/notify-staff).
 * 내용은 보내지 않고 행 번호만 — 함수가 DB에서 직접 읽어서 알린다. 실패해도 저장은 그대로 둔다.
 */
function notifyStaff(table: 'consult_requests' | 'questions', id: string) {
  try {
    void supabase.functions.invoke('notify-staff', { body: { table, id } }).catch(() => {})
  } catch {
    // 알림이 안 가도 신청·질문은 저장돼 있다 — 설정 › 결영이네 답변에서 본다
  }
}

/**
 * 묻고 답하기 (2026-10-21) — 질문은 로그인한 사람 누구나, 답은 결영이네(staff 명단)만.
 * 답 달린 질문은 로그인 없이도 읽혀서 유튜브·인스타에 링크로 걸 수 있다. 서버 규칙은 supabase/qna.sql.
 */
export type QnaCategory = 'stock' | 'home' | 'sns' | 'couple'

export const QNA_CATEGORIES: { key: QnaCategory; label: string; tone: string }[] = [
  { key: 'stock', label: '주식', tone: 'bg-emerald-50 text-emerald-700' },
  { key: 'home', label: '내집마련', tone: 'bg-brand/10 text-brand' },
  { key: 'sns', label: 'SNS 부수입', tone: 'bg-orange-50 text-orange-700' },
  { key: 'couple', label: '부부 돈 관리', tone: 'bg-pink-50 text-pink-600' },
]

/**
 * 질문 형식 (2026-10-21) — 분류를 고르면 내용 칸에 채워 준다. 빈칸만 채우면 답하기 좋은 질문이 된다.
 * 공통(우리집 상황) + 분류마다 꼭 필요한 줄.
 */
const COMMON = [
  '[우리집 상황]',
  '- 부부 나이: ',
  '- 월 실수령 (부부 합산): ',
  '- 모은 돈: ',
  '- 대출: ',
]
const ASK = ['', '[궁금한 것]', '- ']
export const QNA_TEMPLATES: Record<QnaCategory, string> = {
  stock: [...COMMON, '- 투자 경험: ', '- 투자하려는 금액: ', '- 그 돈을 쓸 시기: ', ...ASK].join(
    '\n',
  ),
  home: [
    ...COMMON,
    '- 지금 사는 곳 (전세·월세·자가): ',
    '- 관심 지역: ',
    '- 직장 위치: ',
    ...ASK,
  ].join('\n'),
  sns: [
    ...COMMON,
    '- 지금 계정 (주제·팔로워): ',
    '- 하루에 쓸 수 있는 시간: ',
    '- 해 보고 싶은 주제: ',
    ...ASK,
  ].join('\n'),
  couple: [
    ...COMMON,
    '- 각자 수입: ',
    '- 지금 돈 관리 방식 (합치기·각자·공동통장): ',
    '- 자녀·휴직 계획: ',
    ...ASK,
  ].join('\n'),
}
const TEMPLATE_SET = new Set(Object.values(QNA_TEMPLATES))
/** 손대지 않은 형식 그대로인지 — 분류를 바꾸면 새 형식으로 갈아 끼워도 되는지 */
export const isUntouchedTemplate = (body: string) => !body.trim() || TEMPLATE_SET.has(body)

export const categoryOf = (key: string) =>
  QNA_CATEGORIES.find((c) => c.key === key) ?? QNA_CATEGORIES[0]

export interface Question {
  id: string
  category: QnaCategory
  title: string
  body: string
  nickname: string
  answered: boolean
  hidden: boolean
  createdAt: string
  mine: boolean
}

export interface Answer {
  id: string
  authorName: string
  body: string
  createdAt: string
}

const ORIGIN = 'https://moabuli.com'
/** 공유 링크 — #이 없는 주소라 카톡·인스타에서도 깨지지 않는다(앱이 /#/qna/…로 옮긴다) */
export const qnaListLink = () => `${ORIGIN}/qna`
export const qnaLink = (id: string) => `${ORIGIN}/qna/${id}`

type Row = {
  id: string
  category: QnaCategory
  title: string
  body: string
  nickname: string
  answered: boolean
  hidden: boolean
  created_at: string
  user_id: string | null
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

const toQuestion = (r: Row, me: string | null): Question => ({
  id: r.id,
  category: r.category,
  title: r.title,
  body: r.body,
  nickname: r.nickname,
  answered: r.answered,
  hidden: r.hidden,
  createdAt: r.created_at,
  mine: !!me && r.user_id === me,
})

export async function fetchQuestions(category?: QnaCategory): Promise<Question[]> {
  let q = supabase
    .from('questions')
    .select('id, category, title, body, nickname, answered, hidden, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(100)
  if (category) q = q.eq('category', category)
  const [{ data, error }, me] = await Promise.all([q, myId()])
  if (error) throw error
  return (data as Row[]).map((r) => toQuestion(r, me))
}

export async function fetchQuestion(
  id: string,
): Promise<{ question: Question; answers: Answer[] } | null> {
  const [q, a, me] = await Promise.all([
    supabase
      .from('questions')
      .select('id, category, title, body, nickname, answered, hidden, created_at, user_id')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('answers')
      .select('id, author_name, body, created_at')
      .eq('question_id', id)
      .order('created_at'),
    myId(),
  ])
  if (q.error) throw q.error
  if (!q.data) return null
  return {
    question: toQuestion(q.data as Row, me),
    answers: (
      (a.data ?? []) as { id: string; author_name: string; body: string; created_at: string }[]
    ).map((r) => ({ id: r.id, authorName: r.author_name, body: r.body, createdAt: r.created_at })),
  }
}

export async function createQuestion(input: {
  category: QnaCategory
  title: string
  body: string
}): Promise<string> {
  const { data, error } = await supabase
    .from('questions')
    .insert({
      category: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
      consent_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  const id = (data as { id: string }).id
  notifyStaff('questions', id)
  return id
}

export async function deleteQuestion(id: string) {
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) throw error
}

/** 답변하는 사람인지 (결영이네·남편) — 서버의 staff 명단으로 확인 */
export async function amIStaff(): Promise<boolean> {
  // 못 물어보면(오프라인·옛 DB) 그냥 일반 사용자로 — 화면이 깨지면 안 된다
  try {
    const { data, error } = await supabase.rpc('is_staff')
    return !error && data === true
  } catch {
    return false
  }
}

export async function addAnswer(questionId: string, body: string): Promise<void> {
  const { data: name } = await supabase.rpc('staff_name')
  const { error } = await supabase.from('answers').insert({
    question_id: questionId,
    body: body.trim(),
    author_name: (name as string | null) ?? '결영이네',
  })
  if (error) throw error
}

export async function deleteAnswer(id: string) {
  const { error } = await supabase.from('answers').delete().eq('id', id)
  if (error) throw error
}

export async function setQuestionHidden(id: string, hidden: boolean) {
  const { error } = await supabase.from('questions').update({ hidden }).eq('id', id)
  if (error) throw error
}

/** 공유 시트 → 안 되면 복사 */
export async function shareLink(
  url: string,
  text: string,
): Promise<'shared' | 'copied' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ text, url })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}

// ── 1:1 상담 신청 ──────────────────────────────

export type ConsultPlan = 'basic' | 'premium' | 'undecided'

export const CONSULT_PLANS: { key: ConsultPlan; title: string; desc: string }[] = [
  { key: 'basic', title: '기본 상담', desc: '30만원 · 1시간 온라인' },
  { key: 'premium', title: '프리미엄 상담', desc: '100만원 · 3개월, 계약할 때까지 함께' },
  { key: 'undecided', title: '아직 모르겠어요', desc: '이야기 나눠 보고 정할게요' },
]

export const CONSULT_REGIONS = [
  '서울',
  '경기',
  '인천',
  '천안',
  '청주',
  '대전',
  '세종',
  '그 외 지역',
]

/**
 * 상담 전에 알아야 할 우리집 상황 (2026-10-21 — 원팀 '[신혼집] 1:1 상담 신청서'(Tally) 질문을 옮겼다).
 * 표 칸을 늘리지 않고 details(jsonb) 한 칸에 담는다 — 질문이 바뀌어도 SQL을 다시 안 돌려도 된다.
 */
export interface ConsultDetails {
  /** 부동산 공부 정도 */
  level: string
  /** 희망 상담 유형 (매매 / 앞으로의 방향성) */
  kinds: string[]
  /** 지금 사는 곳 — 지역(동네까지)·형태(전세·월세·자가·부모님 댁) */
  homeNow: string
  homeType: string
  /** 원 단위 금액 */
  cash: number
  maxBudget: number
  monthlyIncome: number
  maxInterest: number
  /** 지금 가진 자산 한 줄 (예적금·주식·보증금 등) */
  assets: string
  kids: string
  parents: string
  work: string
  /** 고민하는 단지 (선택) */
  complexes: string
}

export const CONSULT_LEVELS = [
  '공부한 지 꽤 되었어요',
  '기본적인 건 알아요',
  '아는 건 별로 없어요',
  '처음이에요',
]
export const CONSULT_KINDS = ['매매', '앞으로의 방향성']
export const HOME_TYPES = ['전세', '월세', '자가', '부모님 댁', '기타']

export async function createConsultRequest(input: {
  name: string
  contact: string
  plan: ConsultPlan
  region: string
  topic: string
  preferredTime?: string
  details?: ConsultDetails
}) {
  // 번호를 앱에서 정한다 — 로그인 없이 보낸 신청은 다시 읽을 수 없어서, 알림에 쓸 번호를 미리 쥐고 있어야 한다
  const id = genId()
  const { error } = await supabase.from('consult_requests').insert({
    id,
    name: input.name.trim(),
    contact: input.contact.trim(),
    plan: input.plan,
    region: input.region,
    topic: input.topic.trim(),
    preferred_time: input.preferredTime?.trim() || null,
    ...(input.details ? { details: input.details } : {}),
    consent_at: new Date().toISOString(),
  })
  if (error) throw error
  notifyStaff('consult_requests', id)
}

export interface ConsultRequest {
  id: string
  name: string
  contact: string
  plan: ConsultPlan
  region: string
  topic: string
  preferredTime: string | null
  details: ConsultDetails | null
  status: 'new' | 'contacted' | 'done' | 'canceled'
  createdAt: string
}

export async function fetchConsultRequests(): Promise<ConsultRequest[]> {
  const { data, error } = await supabase
    .from('consult_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    contact: r.contact,
    plan: r.plan,
    region: r.region,
    topic: r.topic,
    preferredTime: r.preferred_time,
    details: r.details ?? null,
    status: r.status,
    createdAt: r.created_at,
  }))
}

export async function setConsultStatus(id: string, status: ConsultRequest['status']) {
  const { error } = await supabase.from('consult_requests').update({ status }).eq('id', id)
  if (error) throw error
}
