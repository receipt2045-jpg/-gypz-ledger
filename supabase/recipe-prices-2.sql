-- 집밥 플래너 재료값 켜기 (2026-11-26)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- 1) recipe_prices 표(recipe-prices.sql과 같음) 2) 재료 검색어를 앱의 예상 봉지 크기와 같게 3) 매시간 자동 받기
-- 매시간 부르는 비밀값은 서버가 스스로 만들어 표에 둔다 — 사람이 어디에도 적지 않는다.

create table if not exists public.recipe_prices (
  ingredient text primary key,
  keyword text not null,
  size_token text not null,
  pack_amount numeric not null,
  product_name text,
  price integer,
  unit_price numeric,
  product_url text,
  is_rocket boolean,
  updated_at timestamptz,
  checked_at timestamptz
);
alter table public.recipe_prices enable row level security;
drop policy if exists "recipe_prices read" on public.recipe_prices;
create policy "recipe_prices read" on public.recipe_prices
  for select to anon, authenticated
  using (true);

-- 양념·쌀(한 끼 얼마 계산용)은 recipe-prices.sql 그대로 두고, 장보기 재료는 앱과 같은 봉지 크기로
insert into public.recipe_prices (ingredient, keyword, size_token, pack_amount) values
  ('rice', '백미 10kg', '10kg', 10000),
  ('doenjang', '재래식 된장 1kg', '1kg', 1000),
  ('gochujang', '고추장 1kg', '1kg', 1000),
  ('gochugaru', '고춧가루 500g', '500g', 500),
  ('soySauce', '진간장 1.8L', '1.8L', 1800),
  ('soupSoy', '국간장 900ml', '900ml', 900),
  ('sugar', '백설탕 1kg', '1kg', 1000),
  ('garlic', '다진마늘 1kg', '1kg', 1000),
  ('sesameOil', '참기름 320ml', '320ml', 320),
  ('oil', '식용유 1.8L', '1.8L', 1800),
  ('salt', '꽃소금 1kg', '1kg', 1000),
  ('kimchi', '포기김치 1kg', '1kg', 1000),
  ('pork', '돼지고기 앞다리살 600g', '600g', 600),
  ('tofu', '두부 300g', '300g', 300),
  ('greenOnion', '대파 500g', '500g', 500),
  ('onion', '양파 600g', '600g', 600),
  ('zucchini', '애호박 1개', '1개', 1),
  ('potato', '감자 600g', '600g', 600),
  ('carrot', '당근 300g', '300g', 300),
  ('seaweed', '자른 미역 50g', '50g', 50),
  ('beefSoup', '소고기 국거리 300g', '300g', 300),
  ('beefBulgogi', '소고기 불고기용 500g', '500g', 500),
  ('chicken', '닭볶음탕용 닭 1kg', '1kg', 1000),
  ('curry', '카레 가루 100g', '100g', 100),
  ('egg', '계란 10구', '10구', 10),
  ('pancakeMix', '부침가루 500g', '500g', 500),
  ('duck', '오리 슬라이스 400g', '400g', 400),
  ('chickenThigh', '닭다리살 600g', '600g', 600),
  ('porkMince', '다진 돼지고기 400g', '400g', 400),
  ('porkSuyuk', '돼지 앞다리 수육용 800g', '800g', 800),
  ('mackerel', '순살 고등어 400g', '400g', 400),
  ('samchi', '순살 삼치 400g', '400g', 400),
  ('salmon', '생연어 250g', '250g', 250),
  ('oyster', '생굴 300g', '300g', 300),
  ('enoki', '팽이버섯 150g', '150g', 150),
  ('mushroom', '느타리버섯 200g', '200g', 200),
  ('mu', '무 1.5kg', '1.5kg', 1500),
  ('spinach', '시금치 300g', '300g', 300),
  ('beanSprout', '콩나물 300g', '300g', 300),
  ('broccoli', '브로콜리 300g', '300g', 300),
  ('cabbage', '알배추 800g', '800g', 800),
  ('eomuk', '사각 어묵 300g', '300g', 300),
  ('anchovy', '잔멸치 100g', '100g', 100),
  ('porkNeck', '돼지 목살 500g', '500g', 500),
  ('porkRib', '돼지갈비 1kg', '1kg', 1000),
  ('porkTenderloin', '돼지 안심 500g', '500g', 500),
  ('porkLoin', '돼지 등심 500g', '500g', 500),
  ('porkBoneless', '감자탕용 순살 등뼈살 700g', '700g', 700),
  ('beefRib', '소갈비 1kg', '1kg', 1000),
  ('beefRound', '소고기 홍두깨 400g', '400g', 400),
  ('beefTenderloin', '소 안심 200g', '200g', 200),
  ('beefMince', '다진 소고기 300g', '300g', 300),
  ('beefShank', '소 사태 500g', '500g', 500),
  ('chickenLeg', '닭다리 1kg', '1kg', 1000),
  ('chickenWhole', '영계 600g', '600g', 600),
  ('chickenBreast', '닭가슴살 500g', '500g', 500),
  ('chickenMince', '다진 닭고기 400g', '400g', 400),
  ('smokedDuck', '훈제오리 400g', '400g', 400),
  ('hairtail', '손질 갈치 400g', '400g', 400),
  ('cod', '손질 대구 500g', '500g', 500),
  ('shrimp', '냉동 칵테일새우 300g', '300g', 300),
  ('croaker', '손질 조기 6마리', '6마리', 6),
  ('flounder', '손질 가자미 2마리', '2마리', 2),
  ('crab', '냉동 꽃게 2마리', '2마리', 2),
  ('squid', '손질 오징어 2마리', '2마리', 2),
  ('abalone', '활전복 4미', '4미', 4),
  ('clam', '해감 바지락 500g', '500g', 500),
  ('pollack', '손질 동태 600g', '600g', 600),
  ('driedPollack', '북어채 100g', '100g', 100),
  ('mungSprout', '숙주 300g', '300g', 300),
  ('lettuce', '상추 200g', '200g', 200),
  ('cucumber', '오이 3개', '3개', 3),
  ('eggplant', '가지 2개', '2개', 2),
  ('kingOyster', '새송이버섯 300g', '300g', 300),
  ('shiitake', '표고버섯 200g', '200g', 200),
  ('cabbageHead', '양배추 1.5kg', '1.5kg', 1500),
  ('tomato', '토마토 600g', '600g', 600),
  ('cherryTomato', '방울토마토 500g', '500g', 500),
  ('bellPepper', '피망 2개', '2개', 2),
  ('sweetPotato', '고구마 1kg', '1kg', 1000),
  ('kabocha', '단호박 1kg', '1kg', 1000),
  ('perillaLeaf', '깻잎 30g', '30g', 30),
  ('jujube', '대추 100g', '100g', 100),
  ('corn', '옥수수 통조림 340g', '340g', 340),
  ('tofuSoft', '순두부 350g', '350g', 350),
  ('blackBean', '검은콩 300g', '300g', 300),
  ('riceCake', '떡볶이 떡 500g', '500g', 500),
  ('riceCakeSoup', '떡국 떡 1kg', '1kg', 1000),
  ('glassNoodle', '당면 300g', '300g', 300),
  ('somen', '소면 900g', '900g', 900),
  ('udon', '우동면 2인분', '2인분', 2),
  ('spaghetti', '스파게티 면 500g', '500g', 500),
  ('yubu', '초밥용 유부 160g', '160g', 160),
  ('danmuji', '단무지 200g', '200g', 200),
  ('tomatoSauce', '토마토 소스 600g', '600g', 600),
  ('jjajang', '짜장 가루 100g', '100g', 100),
  ('cream', '생크림 500ml', '500ml', 500),
  ('glutinousRice', '찹쌀 1kg', '1kg', 1000),
  ('nuts', '아몬드 슬라이스 100g', '100g', 100)
on conflict (ingredient) do update
  set keyword = excluded.keyword,
      size_token = excluded.size_token,
      pack_amount = excluded.pack_amount;

-- ── 매시간 부르는 비밀값: 서버 안에서 만들고, 아무도 못 읽게(서비스 키만) ──
create table if not exists public.app_secrets (
  name text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets (name, value)
  values ('coupang_cron', encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (name) do nothing;

-- ── 매시간 7분에 오래된 재료 4개씩 다시 찾기 ──
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('coupang-prices') where exists (select 1 from cron.job where jobname = 'coupang-prices');
select cron.schedule('coupang-prices', '7 * * * *', $$
  select net.http_post(
    url := 'https://sygmpteafxlrhfbipkep.supabase.co/functions/v1/coupang-prices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_secrets where name = 'coupang_cron')
    ),
    body := '{}'::jsonb
  );
$$);
