// 리포트 신청 알림 — Supabase Edge Function
//
// report_requests에 행이 생기면 Database Webhook이 이 함수를 부른다.
// 운영자가 앱을 열지 않아도 신청이 들어온 걸 알 수 있게 메일로 보낸다.
//
// 필요한 시크릿:
//   RESEND_API_KEY  — 없으면 아무것도 하지 않고 조용히 끝난다(설정 전에도 안전)
//   ADMIN_EMAIL     — 받는 사람
//   MAIL_FROM       — 보내는 주소 (기본: onboarding@resend.dev, 도메인 인증 전에도 발송됨)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReportRequestRow {
  id: string;
  email: string | null;
  contact: string | null;
  note: string | null;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const to = Deno.env.get("ADMIN_EMAIL");

    // 키가 아직 없으면 조용히 성공 처리 — 신청 자체를 막지 않는다
    if (!apiKey || !to) {
      console.log("[notify] 메일 설정 없음, 건너뜀");
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    // Database Webhook은 { type, record, old_record } 형태로 보낸다
    const row = (body.record ?? body) as ReportRequestRow;

    const lines = [
      "맞춤 리포트 신청이 들어왔어요.",
      "",
      `받는 곳: ${row.email ?? row.contact ?? "(없음)"}`,
      row.note ? `궁금한 점: ${row.note}` : "",
      "",
      "모아불리 앱 > 설정 > 리포트 신청에서 열면 초안이 자동으로 만들어져요.",
      "https://moabuli.com/#/admin/reports",
    ].filter(Boolean);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("MAIL_FROM") ?? "모아불리 <onboarding@resend.dev>",
        to: [to],
        subject: "[모아불리] 맞춤 리포트 신청 1건",
        text: lines.join("\n"),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[notify] 메일 발송 실패", res.status, detail);
      // 실패해도 웹훅은 성공으로 돌려준다 — 재시도로 DB가 막히면 더 나쁘다
      return new Response(JSON.stringify({ sent: false, status: res.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify]", err);
    return new Response(JSON.stringify({ sent: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
