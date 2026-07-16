// AI 코치 by 결영이네 — Supabase Edge Function
// 클라이언트가 보낸 정산 요약(익명 집계)을 Claude API로 진단해 돌려준다.
// 시스템 프롬프트는 《결영이네 관점엔진 판단규칙 v1》의 'F. 시스템 프롬프트'를 그대로 사용.
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── 결영이네 관점엔진 F. 시스템 프롬프트 (원문 그대로) ──
const SYSTEM_PROMPT = `너는 '결영이네가 만든 AI 코치'다. 신혼부부의 가계부를 보고, 결영이네의 관점으로
고정비를 잡아 목돈·내집마련을 돕는다.

[판단 원칙]
- 모든 지출을 먼저 3분류한다: ①줄일 것(저효용 고정비: 통신·구독) ②지킬 것(식비·용돈·데이트·자기계발·기부) ③레버리지(내집마련 대출 등 자산 만드는 빚). "다 아끼세요"라고 하지 말고, ①만 독하게 조이고 ②는 지키고 ③은 감당선까지 키운다.
- 고정비(특히 통신비·구독료)를 가장 먼저, 강하게 친다.
- 주거·보험이 0원 같은 유리한 조건이면 기준을 더 엄격히 적용한다.
- 모든 지출은 10년으로 환산해 크기를 보여준다.
- 할부·약정·금리를 먼저 확인하고, 고금리는 조기상환을 권한다.
- 소비를 줄이고 그 시간을 생산·공부로 돌리라고 권한다.
- 자기계발·기부 지출은 존중하고 강요하지 않는다.

[진단 순서]
판정 전에 통신비 상세·기기할부 잔액·약정 개월·구독 구성·할부 금리·주거비 성격·
종신보험 포함 여부·용돈 구성·내집마련 계획 유무를 먼저 물어본다.

[업셀]
내집마련 계획이 없거나 보험 리모델링·통장분리가 필요하면, '결영이네와 함께 세워보자'며
원팀 프로젝트로 자연스럽게 연결한다(강매 금지, 초대 톤).

[말투]
존댓말. 따뜻하지만 단호한 잔소리 톤. 겸손한 서두로 시작하고, 강한 권유는 완충어
('혹시', '조금이라도', '말씀만 드려봅니다')로 감싼다. 구체 숫자로 설득하고, 끝은
응원과 다음 과제 기대로 마무리한다.

[면책]
참고용 정보이며 투자·재무 자문은 아니라고 밝힌다.`;

interface ItemSummary {
  category: string;
  amount: number;
}

interface CheckupSummary {
  ym: string;
  income: number;
  saving: number;
  investment: number;
  fixedTotal: number;
  variableTotal: number;
  surplus: number;
  savingInvestRate: number; // 0~1
  fixedItems: ItemSummary[];
  variableItems: ItemSummary[];
}

function isValidSummary(s: unknown): s is CheckupSummary {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.ym === "string" &&
    typeof o.income === "number" &&
    Array.isArray(o.fixedItems) &&
    Array.isArray(o.variableItems) &&
    (o.fixedItems as unknown[]).length <= 50 &&
    (o.variableItems as unknown[]).length <= 50
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { summary } = await req.json();
    if (!isValidSummary(summary)) {
      return new Response(JSON.stringify({ error: "잘못된 요청이에요" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    });

    const userPrompt = `다음은 한 신혼부부의 ${summary.ym} 월 정산 요약입니다. (금액 단위: 원, 익명 집계 데이터)

수입 합계: ${summary.income}
저축 합계: ${summary.saving}
투자 합계: ${summary.investment}
고정지출 합계: ${summary.fixedTotal}
변동지출 합계: ${summary.variableTotal}
잉여현금: ${summary.surplus}
저축·투자율: ${Math.round(summary.savingInvestRate * 100)}%

고정지출 상세: ${JSON.stringify(summary.fixedItems)}
변동지출 상세: ${JSON.stringify(summary.variableItems)}

위 데이터만으로 1회성 요약 진단을 해주세요. 대화를 이어갈 수 없으니, [진단 순서]에서 물어봐야 할 정보는 질문 대신 "확인해 볼 것"으로 짧게 1개만 제안해 주세요.

출력 형식(마크다운 없이 일반 텍스트, 전체 350자 이내):
진단 3줄 이내 + 개선 액션 1~2개(구체 금액·항목 지목, 가능하면 10년 환산 금액 포함) + 확인해 볼 것 1개 + 마지막 줄에 면책 한 문장.`;

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    if (response.stop_reason === "refusal") {
      return new Response(
        JSON.stringify({ error: "이번 데이터로는 진단을 만들지 못했어요" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "진단 서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
