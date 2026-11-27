// 자료 페이지용 쿠팡 파트너스 링크 찾기 — Supabase Edge Function (2026-11-27)
//
// 검색어 몇 개를 받아 쿠팡파트너스 검색 API로 찾고, 상품마다 위 5개(이름·가격·로켓·파트너스 링크)를 돌려준다.
// 저장은 하지 않는다 — PC 클로드가 불러서 고른 링크를 페이지 코드에 직접 적는다 (치약·세탁세제 비교 페이지).
// 막는 것: x-link-secret 머리글이 Secrets의 LINK_SECRET 과 같아야 한다 (값은 C:\Claude\비밀\ 에만).
// 배포: npx supabase functions deploy coupang-links --no-verify-jwt
const ACCESS = Deno.env.get("COUPANG_ACCESS_KEY") ?? "";
const SECRET = Deno.env.get("COUPANG_SECRET_KEY") ?? "";
const LINK_SECRET = Deno.env.get("LINK_SECRET") ?? "";

const HOST = "https://api-gateway.coupang.com";
const SEARCH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
const pad = (n: number) => String(n).padStart(2, "0");

function signedDate(d = new Date()): string {
  return `${String(d.getUTCFullYear()).slice(-2)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function search(keyword: string) {
  const query = new URLSearchParams({ keyword, limit: "5", subId: "moabuli" }).toString();
  const date = signedDate();
  const signature = await hmacHex(SECRET, `${date}GET${SEARCH}${query}`);
  const res = await fetch(`${HOST}${SEARCH}?${query}`, {
    headers: {
      Authorization: `CEA algorithm=HmacSHA256, access-key=${ACCESS}, signed-date=${date}, signature=${signature}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return { keyword, error: `검색 ${res.status}` };
  const body = await res.json();
  if (body.rCode !== "0") return { keyword, error: `rCode ${body.rCode}: ${body.rMessage}` };
  return {
    keyword,
    items: (body.data?.productData ?? []).slice(0, 5).map((p: Record<string, unknown>) => ({
      name: p.productName, price: p.productPrice, rocket: p.isRocket, url: p.productUrl,
    })),
  };
}

Deno.serve(async (req) => {
  if (!LINK_SECRET || req.headers.get("x-link-secret") !== LINK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const { keywords } = await req.json().catch(() => ({ keywords: [] }));
  const list: string[] = Array.isArray(keywords) ? keywords.slice(0, 8).map(String) : [];
  const out = [];
  for (const k of list) out.push(await search(k));
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json; charset=utf-8" } });
});
