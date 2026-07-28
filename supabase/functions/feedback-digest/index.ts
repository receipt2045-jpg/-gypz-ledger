// 사용자 의견 분석 — Supabase Edge Function (운영자 전용)
// feedback 테이블을 service_role로 읽어 Hugging Face 추론으로 감정·주제·요약 분석해 돌려준다.
// 호출자는 반드시 ADMIN_EMAIL 계정이어야 한다(그 외에는 403).
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Hugging Face Inference Providers (OpenAI 호환 라우터)
const HF_URL = "https://router.huggingface.co/v1/chat/completions";
// 한국어 성능 좋고 저렴한 기본값. HF_MODEL 시크릿으로 교체 가능.
const DEFAULT_MODEL = "Qwen/Qwen3-235B-A22B-Instruct-2507";

const SYSTEM_PROMPT = `너는 모아불리(부부 가계부 앱) 운영자를 돕는 제품 분석가다.
사용자들이 남긴 의견을 읽고, 운영자가 다음에 뭘 고쳐야 할지 판단할 수 있게 정리한다.

[원칙]
- 추측하지 말고 실제 의견에 있는 내용만 근거로 삼는다.
- 같은 불편은 하나로 묶고, 몇 명이 말했는지 센다.
- 목소리 큰 1명보다 여러 명이 반복한 것을 위로 올린다.
- 칭찬은 짧게, 개선점은 구체적으로.
- 운영자가 바로 실행할 수 있는 형태로 쓴다(모호한 제안 금지).

[말투]
간결한 존댓말. 군더더기 없이 사실 위주로. 반드시 한국어로 답한다.`;

interface FeedbackRow {
  rating: number | null;
  message: string;
  screen: string | null;
  created_at: string;
}

/** 일부 모델이 붙이는 사고 과정 태그 제거 */
function cleanOutput(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1) 호출자 신원 확인 — 운영자만 허용
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const email = userData.user?.email?.toLowerCase();
    const adminEmail = (Deno.env.get("ADMIN_EMAIL") ?? "").toLowerCase();

    if (!email || !adminEmail || email !== adminEmail) {
      return new Response(JSON.stringify({ error: "권한이 없어요" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) 의견 읽기 (RLS 우회 — 운영자 확인 후에만 실행됨)
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await adminClient
      .from("feedback")
      .select("rating, message, screen, created_at")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;
    const rows = (data ?? []) as FeedbackRow[];

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ count: 0, avgRating: null, text: "아직 받은 의견이 없어요." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rated = rows.filter((r) => typeof r.rating === "number");
    const avgRating = rated.length
      ? Math.round((rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) * 10) / 10
      : null;

    // 3) Hugging Face 추론
    const list = rows
      .map((r, i) => `${i + 1}. [${r.rating ?? "-"}점] ${r.message.replace(/\s+/g, " ").slice(0, 300)}`)
      .join("\n");

    const userPrompt = `모아불리 사용자 의견 ${rows.length}건입니다. 평균 별점: ${avgRating ?? "없음"}

${list}

아래 형식으로 정리해 주세요. 마크다운 기호(#, *) 쓰지 말고 일반 텍스트로.

한 줄 요약: (전체 분위기 한 문장)

만족 신호:
- (칭찬받은 점 최대 3개, 각 1줄. 언급 건수 표기)

불편·요청 TOP:
- (묶어서 최대 5개. 각 줄에 "언급 N건" 표기, 많은 순)

바로 고칠 것:
1. (가장 급한 개선 1개 — 무엇을 어떻게)
2. (그다음 1개)

지켜볼 것: (아직 1~2명만 말했지만 커질 수 있는 신호 1개)`;

    const hfToken = Deno.env.get("HF_TOKEN");
    if (!hfToken) throw new Error("HF_TOKEN이 설정되지 않았어요");

    const hfRes = await fetch(HF_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("HF_MODEL") ?? DEFAULT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1200,
        temperature: 0.3,
      }),
    });

    if (!hfRes.ok) {
      const detail = await hfRes.text();
      console.error("HF error", hfRes.status, detail);
      const msg = hfRes.status === 401
        ? "허깅페이스 토큰이 올바르지 않아요."
        : hfRes.status === 402
        ? "허깅페이스 크레딧이 부족해요."
        : "허깅페이스 응답에 문제가 있어요.";
      return new Response(JSON.stringify({ error: msg }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hf = await hfRes.json();
    const text = cleanOutput(hf?.choices?.[0]?.message?.content ?? "");
    if (!text) throw new Error("빈 응답");

    return new Response(
      JSON.stringify({ count: rows.length, avgRating, text, items: rows.slice(0, 50) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "분석 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
