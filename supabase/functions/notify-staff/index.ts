// 1:1 상담 신청·새 질문 텔레그램 알림 — Supabase Edge Function (2026-10-21)
//
// 앱이 신청서·질문을 저장한 직후 { table, id }만 보낸다. 내용은 이 함수가 DB에서 직접 읽는다.
// 그래서 아무나 불러도 가짜 내용을 보낼 수 없고, 같은 행은 한 번만 알린다(notified_at),
// 10분이 지난 행은 알리지 않는다 — 함수를 반복해서 불러 텔레그램을 도배하는 걸 막는다.
//
// 받는 방: TELEGRAM_NOTIFY_CHAT_ID (없으면 TELEGRAM_ALLOWED_CHAT_ID — 오늘의 경제 부부방)
// 설정(Secrets): TELEGRAM_BOT_TOKEN (이미 있음), TELEGRAM_NOTIFY_CHAT_ID (선택)
import { createClient } from "npm:@supabase/supabase-js";

const BOT = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const CHAT = (
  Deno.env.get("TELEGRAM_NOTIFY_CHAT_ID") ||
  Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID") ||
  ""
).trim();

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN: Record<string, string> = {
  basic: "기본 상담",
  premium: "프리미엄 상담",
  undecided: "아직 모름",
};
const CATEGORY: Record<string, string> = {
  stock: "주식",
  home: "내집마련",
  sns: "SNS 부수입",
  couple: "부부 돈 관리",
};

const won = (n?: number) => {
  if (!n) return "—";
  const eok = Math.floor(n / 100_000_000);
  const man = Math.round((n % 100_000_000) / 10_000);
  return [eok ? `${eok}억` : "", man ? `${man.toLocaleString("ko-KR")}만` : ""].join(" ").trim() || "0";
};
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

// deno-lint-ignore no-explicit-any
function consultText(r: any): string {
  const d = r.details ?? {};
  return [
    "🙋 1:1 상담 신청이 들어왔어요",
    "",
    `${PLAN[r.plan] ?? r.plan} · ${r.region}`,
    `닉네임: ${r.name}`,
    `연락처: ${r.contact}`,
    d.homeNow ? `지금 사는 곳: ${d.homeNow} (${d.homeType ?? ""})` : null,
    d.cash ? `현금 ${won(d.cash)} · 대출 포함 최대 ${won(d.maxBudget)} · 월 실수령 ${won(d.monthlyIncome)}` : null,
    r.preferred_time ? `가능한 시간: ${r.preferred_time}` : null,
    "",
    `고민: ${cut(String(r.topic ?? ""), 200)}`,
    "",
    "자세히 보기: https://moabuli.com/#/admin/consult",
  ]
    .filter((l) => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

// deno-lint-ignore no-explicit-any
function questionText(r: any): string {
  return [
    `💬 새 질문 (${CATEGORY[r.category] ?? r.category})`,
    "",
    r.title,
    cut(String(r.body ?? "").replace(/\s+/g, " "), 160),
    "",
    `답 달기: https://moabuli.com/qna/${r.id}`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ok = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { table, id } = await req.json().catch(() => ({}));
    if (!["consult_requests", "questions"].includes(table) || typeof id !== "string") {
      return ok({ skipped: "bad request" });
    }
    if (!BOT || !CHAT) return ok({ skipped: "telegram not set" });

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row } = await db.from(table).select("*").eq("id", id).maybeSingle();
    if (!row) return ok({ skipped: "not found" });
    if (row.notified_at) return ok({ skipped: "already" });
    if (Date.now() - new Date(row.created_at).getTime() > 10 * 60 * 1000) {
      return ok({ skipped: "too old" });
    }

    const text = table === "consult_requests" ? consultText(row) : questionText(row);
    const res = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error("[notify-staff] telegram", res.status, await res.text());
      return ok({ sent: false });
    }
    await db.from(table).update({ notified_at: new Date().toISOString() }).eq("id", id);
    return ok({ sent: true });
  } catch (err) {
    console.error("[notify-staff]", err);
    return ok({ sent: false });
  }
});
