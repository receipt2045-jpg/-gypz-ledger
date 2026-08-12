// 맞춤 리포트 운영 — Supabase Edge Function (운영자 전용)
//
// 신청 목록을 보고, 그 가구의 데이터를 읽어와 초안을 만들고, 상태를 바꾼다.
// 남의 가계부를 여는 일이라 두 겹으로 막는다:
//   1) 호출자가 ADMIN_EMAIL 계정인지 (아니면 403)
//   2) 그 신청의 열람 동의가 살아있는지 (철회했으면 409)
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "list" | "data" | "save" | "mark" | "ai-rewrite" | "feedback";

/**
 * 초안을 결영 말투로 다듬는다.
 *
 * 숫자는 절대 AI가 만들지 않는다. 규칙이 계산한 초안을 그대로 받아서
 * 문장만 고치고, 신청자가 적은 궁금한 점에 답하는 문단을 더한다.
 * (AI가 금액을 자유롭게 쓰게 두면 반드시 지어낸다.)
 */
const REWRITE_SYSTEM = `너는 '결영이네'라는 신혼부부 재테크 브랜드의 글쓴이다.
부부 가계부 앱 '모아불리'의 유료 맞춤 리포트를 고객 부부에게 보낸다.

[절대 규칙]
- 주어진 초안에 있는 숫자만 쓴다. 새 숫자를 만들거나 어림하지 않는다.
- 초안에 없는 사실을 지어내지 않는다. 모르면 쓰지 않는다.
- 마크다운 제목(##)과 구조는 그대로 유지한다. 문장만 다듬는다.

[말투]
- 짧고 정돈된 존댓말. 한 문장에 한 가지만.
- 잠언체 금지("~은 ~가 아니라 ~다" 같은 대구 반복 금지).
- 추상적인 말 금지. 금액과 항목을 그대로 지목한다.
- 겁주지 않는다. 문제는 사실대로 쓰되 다음 행동으로 이어지게 쓴다.
- 이모지는 마지막 인사에만 하나.

[신청자가 궁금한 점을 적었다면]
'## 물어보신 것' 섹션을 '## 다음 3개월에 할 일' 앞에 넣고, 초안의 숫자
안에서 답한다. 데이터로 답할 수 없으면 무엇을 더 알아야 하는지 적는다.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1) 운영자 확인
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const email = userData.user?.email?.toLowerCase();
    const adminEmail = (Deno.env.get("ADMIN_EMAIL") ?? "").toLowerCase();
    if (!email || !adminEmail || email !== adminEmail) {
      return json({ error: "권한이 없어요" }, 403);
    }

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const action = (body.action ?? "list") as Action;

    // ── 신청 목록 ──────────────────────────────
    if (action === "list") {
      const { data, error } = await admin
        .from("report_requests")
        .select(
          "id, household_id, email, contact, note, status, consent_at, revoked_at, paid_at, sent_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      // 가구 이름을 붙여준다 (누구 신청인지 알아보게)
      const ids = [...new Set((data ?? []).map((r) => r.household_id))];
      const { data: hh } = await admin
        .from("households")
        .select("id, member1_name, member2_name")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const nameOf = new Map(
        (hh ?? []).map((h) => [h.id, h.member1_name + "·" + h.member2_name]),
      );

      // 초안이 이미 있는지
      const { data: drafts } = await admin
        .from("report_drafts")
        .select("request_id")
        .in("request_id", (data ?? []).map((r) => r.id));
      const hasDraft = new Set((drafts ?? []).map((d) => d.request_id));

      return json({
        requests: (data ?? []).map((r) => ({
          ...r,
          householdName: nameOf.get(r.household_id) ?? "(이름 없음)",
          hasDraft: hasDraft.has(r.id),
        })),
      });
    }

    // ── 받은 의견 목록 (feedback 테이블은 RLS로 앱에서 못 읽는다) ──
    if (action === "feedback") {
      const { data, error } = await admin
        .from("feedback")
        .select("rating, message, screen, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const items = data ?? [];
      const rated = items.filter((r) => r.rating != null);
      const avgRating = rated.length
        ? Math.round((rated.reduce((a, r) => a + Number(r.rating), 0) / rated.length) * 10) / 10
        : null;
      return json({ count: items.length, avgRating, items });
    }

    // ── 가구 데이터 + 저장된 초안 ───────────────
    if (action === "data") {
      const requestId = body.requestId as string;
      if (!requestId) return json({ error: "requestId가 필요해요" }, 400);

      const { data: reqRow, error: reqErr } = await admin
        .from("report_requests")
        .select("id, household_id, revoked_at")
        .eq("id", requestId)
        .maybeSingle();
      if (reqErr) throw reqErr;
      if (!reqRow) return json({ error: "신청을 찾을 수 없어요" }, 404);

      // 2) 동의가 살아있을 때만 연다
      if (reqRow.revoked_at) {
        return json({ error: "열람 동의가 철회된 신청이에요" }, 409);
      }

      const hid = reqRow.household_id;
      const [hh, ledgers, snapshots, occasions, draft] = await Promise.all([
        admin.from("households").select("*").eq("id", hid).maybeSingle(),
        admin.from("ledgers").select("ym, items, closed, settled_members").eq("household_id", hid),
        admin.from("snapshots").select("ym, items").eq("household_id", hid),
        admin.from("occasions").select("*").eq("household_id", hid),
        admin.from("report_drafts").select("body").eq("request_id", requestId).maybeSingle(),
      ]);

      // 전체 가구 저축률 분포 — '우리집 위치'용. 남의 금액은 가져오지 않고
      // 비율만 계산해서 숫자 배열로 만든다.
      const { data: allLedgers } = await admin
        .from("ledgers")
        .select("household_id, items")
        .eq("closed", true)
        .limit(3000);
      const byHousehold = new Map<string, { income: number; save: number }>();
      for (const row of allLedgers ?? []) {
        const acc = byHousehold.get(row.household_id) ?? { income: 0, save: 0 };
        for (const it of (row.items ?? []) as { group: string; actual: number }[]) {
          if (it.group === "income") acc.income += Number(it.actual) || 0;
          else if (it.group === "saving" || it.group === "investment") {
            acc.save += Number(it.actual) || 0;
          }
        }
        byHousehold.set(row.household_id, acc);
      }
      const rates = [...byHousehold.values()]
        .filter((v) => v.income > 0)
        .map((v) => v.save / v.income);

      return json({
        profile: {
          member1Name: hh.data?.member1_name ?? "남편",
          member2Name: hh.data?.member2_name ?? "아내",
          childNames: hh.data?.child_names ?? [],
          targetNetWorth: Number(hh.data?.target_net_worth ?? 0),
          startYear: hh.data?.start_year ?? new Date().getFullYear(),
        },
        ledgers: (ledgers.data ?? []).map((l) => ({
          ym: l.ym,
          items: l.items,
          closed: l.closed,
          settledMembers: l.settled_members,
        })),
        snapshots: snapshots.data ?? [],
        occasions: occasions.data ?? [],
        benchmark: { rates },
        draft: draft.data?.body ?? null,
      });
    }

    // ── 초안 저장 ──────────────────────────────
    if (action === "save") {
      const { requestId, draft } = body as { requestId: string; draft: string };
      if (!requestId) return json({ error: "requestId가 필요해요" }, 400);
      const { error } = await admin
        .from("report_drafts")
        .upsert({ request_id: requestId, body: draft ?? "", updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true });
    }

    // ── 상태 변경 ──────────────────────────────
    if (action === "mark") {
      const { requestId, status } = body as { requestId: string; status: string };
      const allowed = ["requested", "paid", "writing", "done", "canceled"];
      if (!requestId || !allowed.includes(status)) {
        return json({ error: "잘못된 요청이에요" }, 400);
      }
      const patch: Record<string, unknown> = { status };
      if (status === "paid") patch.paid_at = new Date().toISOString();
      if (status === "done") patch.sent_at = new Date().toISOString();
      const { error } = await admin.from("report_requests").update(patch).eq("id", requestId);
      if (error) throw error;
      return json({ ok: true });
    }

    // ── 초안 다듬기 (AI) ───────────────────────
    // 가계부 원본은 넘기지 않는다. 이미 계산된 초안 텍스트만 보낸다.
    if (action === "ai-rewrite") {
      const { draft, note } = body as { draft: string; note?: string };
      if (!draft || draft.length < 50) {
        return json({ error: "다듬을 초안이 없어요" }, 400);
      }
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) return json({ error: "AI 키가 설정되지 않았어요" }, 503);

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-4-8",
          max_tokens: 3000,
          system: REWRITE_SYSTEM,
          messages: [{
            role: "user",
            content: `아래 초안을 결영 말투로 다듬어 주세요. 숫자는 그대로 두세요.

${note ? `[신청자가 적은 궁금한 점]\n${note}\n` : "[신청자가 적은 궁금한 점 없음]\n"}
[초안]
${draft}`,
          }],
        }),
      });

      if (!res.ok) {
        console.error("[ai-rewrite]", res.status, await res.text());
        return json({ error: "다듬기에 실패했어요. 잠시 후 다시 시도해 주세요" }, 502);
      }
      const data = await res.json();
      const text = (data.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("")
        .trim();
      if (!text) return json({ error: "빈 결과가 왔어요" }, 502);
      return json({ draft: text });
    }

    return json({ error: "알 수 없는 action이에요" }, 400);
  } catch (err) {
    console.error("[report-admin]", err);
    return json({ error: err instanceof Error ? err.message : "서버 오류" }, 500);
  }
});
