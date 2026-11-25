// 카드·은행·결제 앱 캡처 → 쓴 돈·들어온 돈 읽기 — Supabase Edge Function (2026-11-24)
//
// 2026-11-24 요청: "매일 기록 부분에 캡처본 올리면 바로 자동 저장해 주는 거 만들 수 있어?"
// 앱이 { image: base64, mediaType, categories, today }를 보낸다. Claude가 읽은 결과만 돌려주고 사진은 저장하지 않는다.
// 로그인한 사람만, 주식 캡처와 합쳐 한 사람 하루 30번까지 — 비용이 나가는 호출이라 (stock_capture_log 같이 씀).
// 설정(Secrets): ANTHROPIC_API_KEY (이미 있음)
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const DAILY_LIMIT = 30
const MAX_BASE64 = 7_000_000 // 약 5MB 사진

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          merchant: { type: 'string' },
          amount: { type: 'number' },
          kind: { type: 'string', enum: ['variable', 'fixed', 'income'] },
          category: { type: 'string' },
          confident: { type: 'boolean' },
        },
        required: ['date', 'merchant', 'amount', 'kind', 'category', 'confident'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
}

const list = (v: unknown) =>
  Array.isArray(v)
    ? v
        .filter((x) => typeof x === 'string')
        .slice(0, 60)
        .map((x) => String(x).slice(0, 30))
    : []

const prompt = (cats: { variable: string[]; fixed: string[]; income: string[] }, today: string) =>
  `카드사·은행·간편결제 앱 화면이나 결제 문자·영수증 캡처예요. 보이는 결제(쓴 돈)와 입금(들어온 돈)을 한 건씩 읽어 주세요.
오늘은 ${today}예요.

- date: 그 건의 날짜 YYYY-MM-DD. 연도가 없으면 오늘 기준으로 가장 가까운 지난 날짜(미래가 되면 작년). 날짜가 안 보이면 ""
- merchant: 가게·상대 이름 그대로 (예: 스타벅스 강남점, 쿠팡, 김민수). "(주)" 같은 건 빼도 돼요
- amount: 원 단위 금액(양수). 할부면 결제 총액
- kind: 쓴 돈이면 "variable"(그때그때 쓰는 돈) 또는 "fixed"(매달 나가는 돈: 월세·관리비·통신비·보험·구독·대출 상환 등), 들어온 돈이면 "income"
- category: 아래 목록 중 kind에 맞는 것에서 가장 알맞은 이름 그대로. 맞는 게 없으면 ""
  - variable: ${cats.variable.join(', ')}
  - fixed: ${cats.fixed.join(', ')}
  - income: ${cats.income.join(', ')}
- confident: 숫자가 잘리거나 흐려서 확실하지 않으면 false

빼야 하는 것:
- 취소·환불된 결제와 그 원래 결제, 승인 거절
- 내 계좌끼리 옮긴 돈, 카드 대금 출금, 포인트·잔액·한도·합계 줄
- 카드번호·계좌번호·이름 같은 개인정보는 읽지 마세요

결제나 입금이 하나도 안 보이면 items는 빈 배열로.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  try {
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: auth } = await db.auth.getUser(token)
    const user = auth?.user
    if (!user) return json({ error: 'login' }, 401)

    const body = await req.json().catch(() => ({}))
    const { image, mediaType } = body
    if (typeof image !== 'string' || !image || image.length > MAX_BASE64) {
      return json({ error: 'image' }, 400)
    }
    const media = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)
      ? mediaType
      : 'image/jpeg'
    const cats = {
      variable: list(body.categories?.variable),
      fixed: list(body.categories?.fixed),
      income: list(body.categories?.income),
    }
    const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Date().toISOString().slice(0, 10)

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await db
      .from('stock_capture_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since)
    if ((count ?? 0) >= DAILY_LIMIT) return json({ error: 'limit' }, 429)
    await db.from('stock_capture_log').insert({ user_id: user.id })

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
    // deno-lint-ignore no-explicit-any
    const params: any = {
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: media, data: image } },
            { type: 'text', text: prompt(cats, today) },
          ],
        },
      ],
    }
    const res = await client.beta.messages.create(params)
    if (res.stop_reason === 'refusal') return json({ items: [] })
    const text = res.content.find((b: { type: string }) => b.type === 'text') as
      { text: string } | undefined
    const parsed = JSON.parse(text?.text ?? '{}')
    return json({ items: parsed.items ?? [] })
  } catch (err) {
    console.error('[spend-capture]', err)
    return json({ error: 'failed' }, 500)
  }
})
