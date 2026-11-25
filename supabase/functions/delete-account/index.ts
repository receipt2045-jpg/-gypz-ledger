// 회원 탈퇴 — Supabase Edge Function (2026-11-26, 보안 점검 확인 필요 8·9·10번)
//
// 예전 탈퇴는 delete_my_account RPC(가계부 멤버에서 빼기)만 해서 로그인 계정(auth.users)이 남았다.
// 같은 계정으로 다시 로그인되고, 계정에 묶인 기록(가치관 답변·리포트 신청·질문 등)도 남았다 —
// 개인정보처리방침의 "탈퇴하면 바로 파기"와 달랐다.
// 이제: 본인 확인 → delete_my_account(본인 권한) → 푸시 데이터 → 혼자 쓰던 가계부면 주식 사진도 → 계정 삭제.
// 계정을 지우면 user_id로 묶인 표는 on delete cascade / set null로 함께 정리된다.
// 설정(Secrets): 기본 제공 SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY만 쓴다.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: auth } = await admin.auth.getUser(token)
    const user = auth?.user
    if (!user) return json({ error: 'login' }, 401)

    // 본인 권한으로 부른다 — RPC 안의 auth.uid()가 이 사람이어야 한다
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    })

    const { data: mem } = await admin
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const { error: leaveErr } = await asUser.rpc('delete_my_account')
    if (leaveErr) {
      console.error('[delete-account] delete_my_account', leaveErr)
      return json({ error: 'leave' }, 500)
    }
    const { error: pushErr } = await asUser.rpc('delete_my_push_data')
    if (pushErr) console.warn('[delete-account] delete_my_push_data', pushErr) // 계정 삭제로도 cascade된다

    // 혼자 쓰던 가계부가 사라졌으면 그 가계부의 주식 사진도 지운다 (스토리지는 cascade가 안 된다)
    if (mem?.household_id) {
      const hid = mem.household_id as string
      const { count } = await admin
        .from('households')
        .select('id', { count: 'exact', head: true })
        .eq('id', hid)
      if (!count) {
        const bucket = admin.storage.from('stock-photos')
        for (let round = 0; round < 20; round++) {
          const { data: files, error } = await bucket.list(hid, { limit: 100 })
          if (error || !files?.length) break
          const { error: rmErr } = await bucket.remove(files.map((f) => `${hid}/${f.name}`))
          if (rmErr) {
            console.warn('[delete-account] photo remove', rmErr)
            break
          }
        }
      }
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) {
      console.error('[delete-account] deleteUser', delErr)
      return json({ error: 'user' }, 500)
    }
    return json({ ok: true })
  } catch (err) {
    console.error('[delete-account]', err)
    return json({ error: 'failed' }, 500)
  }
})
