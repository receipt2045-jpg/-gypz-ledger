-- 주식 일지 (2026-10-25) — 종목 하나 = 일지 한 장. 부부가 같이 보고 한 줄씩 남긴다.
-- 현재가는 서버가 받아 오지 않는다(거래소 시세는 남에게 다시 보여주려면 계약이 필요하다).
-- 증권사 화면 캡처에서 읽은 값이나 직접 넣은 값만 last_price에 남긴다.
-- 여러 번 실행해도 괜찮다.

-- ── 종목 ─────────────────────────────────────────
create table if not exists public.stocks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  -- 누구 주식인지: '1' 남편 / '2' 아내 / 'shared' 함께 (구성원 번호는 앱의 이름표를 따른다)
  owner text not null default 'shared' check (owner in ('1', '2', 'shared')),
  market text not null check (market in ('KR', 'US')),
  code text check (char_length(code) <= 12),
  name text not null check (char_length(name) between 1 and 60),
  currency text not null default 'KRW' check (currency in ('KRW', 'USD')),
  pick_reason text check (char_length(pick_reason) <= 1000), -- 종목 선정 사유
  target_price numeric check (target_price >= 0),
  stop_price numeric check (stop_price >= 0),
  sell_plan text check (char_length(sell_plan) <= 500), -- 매도 계획(글)
  last_price numeric check (last_price >= 0), -- 마지막으로 확인한 현재가
  last_price_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stocks_household on public.stocks (household_id, created_at);

alter table public.stocks enable row level security;
drop policy if exists "stocks_all" on public.stocks;
create policy "stocks_all" on public.stocks
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ── 기록 (샀어요·팔았어요·메모·배우자 한 줄) ───────────
create table if not exists public.stock_entries (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references public.stocks(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  member_no smallint not null check (member_no in (1, 2)), -- 적은 사람
  -- holding: 원래 갖고 있던 걸 처음 넣을 때(평균단가·수량) / buy / sell / memo / comment(배우자 한 줄)
  kind text not null check (kind in ('holding', 'buy', 'sell', 'memo', 'comment')),
  qty numeric check (qty > 0),
  price numeric check (price >= 0),
  traded_on date not null default current_date,
  reasons text[] not null default '{}', -- 빠른 선택(실적 좋아서·배당…)
  note text check (char_length(note) <= 2000), -- 왜 샀는지·메모·한 줄
  mood text check (mood in ('sure', 'anxious', 'rushed', 'follow')), -- 확신·불안·조급·남들 따라
  plan_kept text check (plan_kept in ('target', 'early', 'stop', 'unplanned')), -- 팔 때: 목표대로였나
  review text check (char_length(review) <= 300), -- 한줄 평가
  photo_path text check (char_length(photo_path) <= 300), -- stock-photos 버킷 안 경로
  reply_to uuid references public.stock_entries(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists stock_entries_stock on public.stock_entries (stock_id, traded_on, created_at);
create index if not exists stock_entries_household on public.stock_entries (household_id, created_at desc);

alter table public.stock_entries enable row level security;
drop policy if exists "stock_entries_select" on public.stock_entries;
create policy "stock_entries_select" on public.stock_entries
  for select using (public.is_member(household_id));
-- 적은 사람은 '내 번호'로만 — 배우자인 척 남길 수 없게
drop policy if exists "stock_entries_insert" on public.stock_entries;
create policy "stock_entries_insert" on public.stock_entries
  for insert with check (
    public.is_member(household_id) and member_no = public.my_member_no(household_id)
  );
drop policy if exists "stock_entries_update" on public.stock_entries;
create policy "stock_entries_update" on public.stock_entries
  for update using (public.is_member(household_id)) with check (public.is_member(household_id));
drop policy if exists "stock_entries_delete" on public.stock_entries;
create policy "stock_entries_delete" on public.stock_entries
  for delete using (public.is_member(household_id));

-- ── 차트 사진 (비공개 버킷, 경로 첫 칸 = household_id) ─────
insert into storage.buckets (id, name, public)
values ('stock-photos', 'stock-photos', false)
on conflict (id) do nothing;

drop policy if exists "stock_photos_rw" on storage.objects;
create policy "stock_photos_rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'stock-photos' and public.is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'stock-photos' and public.is_member(((storage.foldername(name))[1])::uuid));

-- ── 캡처 읽기 횟수 (functions/stock-capture가 하루 몇 번까지만) ──
create table if not exists public.stock_capture_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists stock_capture_log_user on public.stock_capture_log (user_id, created_at desc);
alter table public.stock_capture_log enable row level security;
-- 정책 없음 — 앱에서는 못 읽고 못 쓴다. 서버 함수(service role)만 쓴다.
