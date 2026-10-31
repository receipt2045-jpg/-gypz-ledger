-- 집밥 레시피 재료값 (2026-11-01)
-- 쿠팡파트너스 검색으로 재료 한 봉지 값을 받아 1g(ml·개)당 값으로 바꿔 둔다.
-- 채우는 쪽: Edge Function coupang-prices (service role) — 앱은 읽기만.
-- 여러 번 실행해도 괜찮다 (검색어·용량만 다시 맞추고, 받아 둔 값은 그대로 둔다).

create table if not exists public.recipe_prices (
  ingredient text primary key,         -- src/lib/recipes.ts INGREDIENTS의 id
  keyword text not null,               -- 쿠팡 검색어
  size_token text not null,            -- 상품 이름에 이 말이 있어야 고른다 (예: '300g')
  pack_amount numeric not null,        -- 그 한 봉지가 몇 g·ml·개인지
  product_name text,
  price integer,                       -- 고른 상품 값
  unit_price numeric,                  -- 1g·ml·개당 값 = price / (pack_amount × 묶음 수)
  product_url text,                    -- 쿠팡파트너스 링크
  is_rocket boolean,
  updated_at timestamptz,              -- 값이 바뀐 때
  checked_at timestamptz               -- 마지막으로 검색한 때 (오래된 것부터 다시 찾는다)
);

alter table public.recipe_prices enable row level security;

drop policy if exists "recipe_prices read" on public.recipe_prices;
create policy "recipe_prices read" on public.recipe_prices
  for select to anon, authenticated
  using (true);

insert into public.recipe_prices (ingredient, keyword, size_token, pack_amount) values
  ('rice', '백미 10kg', '10kg', 10000),
  ('kimchi', '포기김치 3kg', '3kg', 3000),
  ('pork', '돼지 앞다리살 500g', '500g', 500),
  ('tofu', '부침두부 300g', '300g', 300),
  ('greenOnion', '대파 500g', '500g', 500),
  ('onion', '양파 1.5kg', '1.5kg', 1500),
  ('zucchini', '애호박 1개', '1개', 1),
  ('potato', '감자 1kg', '1kg', 1000),
  ('carrot', '당근 1kg', '1kg', 1000),
  ('doenjang', '재래식 된장 1kg', '1kg', 1000),
  ('seaweed', '자른미역 100g', '100g', 100),
  ('beefSoup', '소고기 국거리 300g', '300g', 300),
  ('beefBulgogi', '소고기 불고기용 500g', '500g', 500),
  ('chicken', '닭볶음탕용 닭 1kg', '1kg', 1000),
  ('curry', '카레 약간매운맛 100g', '100g', 100),
  ('egg', '계란 30구', '30구', 30),
  ('gochujang', '고추장 1kg', '1kg', 1000),
  ('gochugaru', '고춧가루 500g', '500g', 500),
  ('soySauce', '진간장 1.8L', '1.8L', 1800),
  ('soupSoy', '국간장 900ml', '900ml', 900),
  ('sugar', '백설탕 1kg', '1kg', 1000),
  ('garlic', '다진마늘 1kg', '1kg', 1000),
  ('sesameOil', '참기름 320ml', '320ml', 320),
  ('oil', '식용유 1.8L', '1.8L', 1800)
on conflict (ingredient) do update
  set keyword = excluded.keyword,
      size_token = excluded.size_token,
      pack_amount = excluded.pack_amount;

-- ── 매시간 자동으로 값 받기 (선택) ──
-- coupang-prices 함수를 배포하고 Secrets를 넣은 뒤, 아래 두 줄의 <...>를 바꿔서 따로 실행한다.
-- 한 번 부를 때 오래된 재료 4개씩 다시 찾는다 (쿠팡 검색 호출 한도 때문에 나눠서).
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule('coupang-prices', '7 * * * *', $$
--   select net.http_post(
--     url := 'https://sygmpteafxlrhfbipkep.supabase.co/functions/v1/coupang-prices',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<COUPANG_CRON_SECRET에 넣은 값>'),
--     body := '{}'::jsonb
--   );
-- $$);
