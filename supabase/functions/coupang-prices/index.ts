// 집밥 레시피 재료값 받기 — Supabase Edge Function (2026-11-01)
//
// recipe_prices 표에서 가장 오래전에 찾은 재료 몇 개를 골라 쿠팡파트너스 검색 API로 다시 찾고,
// 1g(ml·개)당 값(unit_price)과 파트너스 링크를 저장한다. 앱은 표를 읽어 '한 끼 얼마'를 계산한다.
// 검색 호출 한도가 작아서 한 번에 다 찾지 않는다 — 매시간 몇 개씩(pg_cron, recipe-prices.sql 맨 아래).
//
// 막는 것: x-cron-secret 머리글이 COUPANG_CRON_SECRET과 같아야 한다.
// 설정(Secrets): COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY, COUPANG_CRON_SECRET
//              (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 넣어 준다)
// 배포할 때 'Verify JWT'는 끈다 — pg_cron은 로그인 토큰을 보내지 않는다.
import { createClient } from "npm:@supabase/supabase-js";

const ACCESS = Deno.env.get("COUPANG_ACCESS_KEY") ?? "";
const SECRET = Deno.env.get("COUPANG_SECRET_KEY") ?? "";
const CRON_SECRET = Deno.env.get("COUPANG_CRON_SECRET") ?? "";
const PER_RUN = 4;

const HOST = "https://api-gateway.coupang.com";
const SEARCH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";

// ── 쿠팡 서명 (CEA HmacSHA256) — 날짜 yyMMddTHHmmssZ + 메서드 + 경로 + 쿼리('?' 없이) ──
const pad = (n: number) => String(n).padStart(2, "0");

function signedDate(d = new Date()): string {
  return `${String(d.getUTCFullYear()).slice(-2)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface SearchItem {
  productName: string;
  productPrice: number;
  productUrl: string;
  isRocket?: boolean;
}

async function search(keyword: string): Promise<SearchItem[]> {
  const query = new URLSearchParams({ keyword, limit: "10", subId: "moabuli" }).toString();
  const date = signedDate();
  const signature = await hmacHex(SECRET, `${date}GET${SEARCH}${query}`);
  const res = await fetch(`${HOST}${SEARCH}?${query}`, {
    headers: {
      Authorization:
        `CEA algorithm=HmacSHA256, access-key=${ACCESS}, signed-date=${date}, signature=${signature}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`쿠팡 검색 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  if (body.rCode !== "0") throw new Error(`쿠팡 검색 rCode ${body.rCode}: ${body.rMessage}`);
  return body.data?.productData ?? [];
}

// ── 상품 고르기 — src/lib/coupangPick.ts와 같은 규칙 ──
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

function bundleCount(name: string, sizeToken: string): number {
  const n = norm(name);
  const at = n.indexOf(norm(sizeToken));
  if (at < 0) return 1;
  const after = n.slice(at + norm(sizeToken).length);
  const m = after.match(/^[,x×*]?(\d{1,2})(개입|개|팩|봉|입|병)/);
  return m ? Math.max(1, Number(m[1])) : 1;
}

function pickProduct(items: SearchItem[], sizeToken: string, packAmount: number) {
  const token = norm(sizeToken);
  let best: { item: SearchItem; count: number; unitPrice: number } | null = null;
  for (const item of items) {
    if (!item.productPrice || !norm(item.productName).includes(token)) continue;
    const count = bundleCount(item.productName, sizeToken);
    const unitPrice = item.productPrice / (packAmount * count);
    if (!best || unitPrice < best.unitPrice) best = { item, count, unitPrice };
  }
  return best;
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  if (!ACCESS || !SECRET) return new Response("쿠팡 키가 없어요", { status: 500 });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: rows, error } = await db
    .from("recipe_prices")
    .select("ingredient,keyword,size_token,pack_amount")
    .order("checked_at", { ascending: true, nullsFirst: true })
    .limit(PER_RUN);
  if (error) return new Response(error.message, { status: 500 });

  const report: Record<string, string> = {};
  for (const r of rows ?? []) {
    const now = new Date().toISOString();
    try {
      const picked = pickProduct(await search(r.keyword), r.size_token, Number(r.pack_amount));
      if (!picked) {
        // 맞는 용량이 없으면 예전 값은 그대로 두고, 찾아본 시각만 남긴다
        await db.from("recipe_prices").update({ checked_at: now }).eq("ingredient", r.ingredient);
        report[r.ingredient] = "맞는 용량 없음";
        continue;
      }
      await db.from("recipe_prices").update({
        product_name: picked.item.productName,
        price: picked.item.productPrice,
        unit_price: picked.unitPrice,
        product_url: picked.item.productUrl,
        is_rocket: !!picked.item.isRocket,
        updated_at: now,
        checked_at: now,
      }).eq("ingredient", r.ingredient);
      report[r.ingredient] = `${picked.item.productPrice}원 (${picked.count}개)`;
    } catch (e) {
      await db.from("recipe_prices").update({ checked_at: now }).eq("ingredient", r.ingredient);
      report[r.ingredient] = `실패: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return new Response(JSON.stringify(report), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
});
