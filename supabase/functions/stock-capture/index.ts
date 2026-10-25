// 증권사 화면 캡처 → 종목·수량·가격 읽기 — Supabase Edge Function (2026-10-25)
//
// 앱이 { image: base64, mediaType }를 보낸다. Claude가 읽은 결과만 돌려주고 사진은 저장하지 않는다.
// 로그인한 사람만(Verify JWT 켬), 한 사람 하루 20번까지 — 비용이 나가는 호출이라.
// 설정(Secrets): ANTHROPIC_API_KEY (이미 있음)
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const DAILY_LIMIT = 20
const MAX_BASE64 = 7_000_000 // 약 5MB 사진

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 모르는 칸은 null 대신 ""·0으로 — 스키마를 단순하게 둔다
const SCHEMA = {
  type: 'object',
  properties: {
    screen: { type: 'string', enum: ['holdings', 'trades', 'unknown'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          code: { type: 'string' },
          market: { type: 'string', enum: ['KR', 'US'] },
          qty: { type: 'number' },
          price: { type: 'number' },
          current_price: { type: 'number' },
          side: { type: 'string', enum: ['buy', 'sell', ''] },
          traded_on: { type: 'string' },
          confident: { type: 'boolean' },
        },
        required: [
          'name',
          'code',
          'market',
          'qty',
          'price',
          'current_price',
          'side',
          'traded_on',
          'confident',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['screen', 'items'],
  additionalProperties: false,
}

const PROMPT = `증권사 앱 화면 캡처예요. 보이는 주식(국내·미국 주식, ETF)을 읽어 주세요.

- screen: 보유 잔고·포트폴리오 화면이면 "holdings", 체결·주문·거래 내역이면 "trades", 둘 다 아니면 "unknown"
- name: 화면에 보이는 종목명 그대로 (예: SK하이닉스, 애플, TIGER 미국S&P500)
- code: 종목코드(6자리)나 티커(AAPL)가 화면에 보이면 그대로, 안 보이면 ""
- market: 한국 상장이면 "KR", 미국 상장이면 "US"
- qty: 보유 수량 또는 체결 수량. 소수점 주식이면 소수 그대로
- price: holdings면 평균단가(매입가), trades면 체결 단가. 미국 주식은 달러 금액(원화 환산 금액이 같이 있으면 달러를 쓰세요)
- current_price: 화면에 현재가가 보이면 그 값, 없으면 0
- side: trades일 때 매수 "buy" / 매도 "sell", holdings면 ""
- traded_on: trades일 때 체결 날짜 YYYY-MM-DD(연도가 없으면 올해), 아니면 ""
- confident: 숫자가 잘리거나 흐려서 확실하지 않으면 false

계좌번호·이름·예수금·총 자산 같은 건 읽지 마세요. 주식이 하나도 안 보이면 items는 빈 배열로.`

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

    const { image, mediaType } = await req.json().catch(() => ({}))
    if (typeof image !== 'string' || !image || image.length > MAX_BASE64) {
      return json({ error: 'image' }, 400)
    }
    const media = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)
      ? mediaType
      : 'image/jpeg'

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
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }
    const res = await client.beta.messages.create(params)
    if (res.stop_reason === 'refusal') return json({ screen: 'unknown', items: [] })
    const text = res.content.find((b: { type: string }) => b.type === 'text') as
      { text: string } | undefined
    const parsed = JSON.parse(text?.text ?? '{}')
    return json({ screen: parsed.screen ?? 'unknown', items: parsed.items ?? [] })
  } catch (err) {
    console.error('[stock-capture]', err)
    return json({ error: 'failed' }, 500)
  }
})
