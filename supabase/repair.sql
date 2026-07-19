-- ============================================================
-- 모아불리 — 안전 복구 스크립트 (데이터 보존)
-- Supabase SQL Editor에 전체 붙여넣고 Run 하세요.
-- 모든 문장이 "있으면 건너뛰기 / 규칙만 다시 정의"라서
-- 기존 기록(가계부·자산·고백)은 하나도 지워지지 않습니다.
-- ============================================================

-- 1) 테이블 (없으면 생성)
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default upper(encode(gen_random_bytes(4), 'hex')),
  member1_name text not null default '남편',
  member2_name text not null default '아내',
  child_names jsonb not null default '[]'::jsonb,
  target_net_worth bigint not null default 1000000000,
  start_year int not null default date_part('year', now()),
  categories jsonb not null default '{
    "income": ["주수입", "부수입", "투자수익", "기타"],
    "saving": ["주택청약", "예금", "적금", "연금", "목적저금", "기타"],
    "investment": ["주식", "부동산", "코인", "기타"],
    "fixed": ["보험", "통신", "용돈", "주거", "구독", "기타"],
    "variable": ["식비", "생활용품", "건강", "육아", "꾸밈", "자기계발", "여행", "자동차", "문화생활", "세금", "반려견", "경조사", "기타"]
  }'::jsonb,
  created_at timestamptz not null default now()
);
-- 뒤늦게 추가된 컬럼 보정
alter table public.households add column if not exists child_names jsonb not null default '[]'::jsonb;

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_no smallint not null check (member_no in (1, 2)),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (household_id, member_no),
  unique (user_id)
);

create table if not exists public.ledgers (
  household_id uuid not null references public.households(id) on delete cascade,
  ym text not null check (ym ~ '^[0-9]{4}-[0-9]{2}$'),
  items jsonb not null default '[]'::jsonb,
  closed boolean not null default false,
  settled_members jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, ym)
);
alter table public.ledgers add column if not exists settled_members jsonb not null default '[]'::jsonb;

create table if not exists public.snapshots (
  household_id uuid not null references public.households(id) on delete cascade,
  ym text not null check (ym ~ '^[0-9]{4}-[0-9]{2}$'),
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, ym)
);

create table if not exists public.occasions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date date not null,
  category text not null,
  title text not null,
  amount bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.confessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_no smallint not null check (member_no in (1, 2)),
  category text not null,
  kind text not null check (kind in ('income', 'saving', 'investment', 'fixed', 'variable')),
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists confessions_household_created
  on public.confessions (household_id, created_at desc);

-- 2) 멤버십 확인 함수 (RLS의 핵심 — 다시 정의)
create or replace function public.is_member(hid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- 3) RLS 켜기 (이미 켜져 있으면 무시됨)
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.ledgers enable row level security;
alter table public.snapshots enable row level security;
alter table public.occasions enable row level security;
alter table public.confessions enable row level security;

-- 4) 접근 규칙 (모두 지우고 다시 만들기 → 어긋난 상태 복구)
drop policy if exists "households_select" on public.households;
create policy "households_select" on public.households
  for select using (public.is_member(id));

drop policy if exists "households_update" on public.households;
create policy "households_update" on public.households
  for update using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists "members_select" on public.household_members;
create policy "members_select" on public.household_members
  for select using (public.is_member(household_id));

drop policy if exists "ledgers_all" on public.ledgers;
create policy "ledgers_all" on public.ledgers
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));

drop policy if exists "snapshots_all" on public.snapshots;
create policy "snapshots_all" on public.snapshots
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));

drop policy if exists "occasions_all" on public.occasions;
create policy "occasions_all" on public.occasions
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));

drop policy if exists "confessions_all" on public.confessions;
create policy "confessions_all" on public.confessions
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));

-- 5) RPC 함수 (다시 정의)
create or replace function public.create_household()
returns public.households
language plpgsql security definer
set search_path = public
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception '이미 가계부에 연결된 계정이에요';
  end if;
  insert into households default values returning * into h;
  insert into household_members (household_id, user_id, member_no)
  values (h.id, auth.uid(), 1);
  return h;
end;
$$;

create or replace function public.join_household(code text)
returns public.households
language plpgsql security definer
set search_path = public
as $$
declare
  h public.households;
  cnt int;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception '이미 가계부에 연결된 계정이에요';
  end if;
  select * into h from households where invite_code = upper(trim(code));
  if h.id is null then
    raise exception '초대 코드를 찾을 수 없어요';
  end if;
  select count(*) into cnt from household_members where household_id = h.id;
  if cnt >= 2 then
    raise exception '이 가계부에는 이미 두 명이 연결되어 있어요';
  end if;
  insert into household_members (household_id, user_id, member_no)
  values (h.id, auth.uid(), 2);
  return h;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  hid uuid;
  remaining int;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  select household_id into hid from household_members where user_id = auth.uid();
  if hid is not null then
    delete from household_members where household_id = hid and user_id = auth.uid();
    select count(*) into remaining from household_members where household_id = hid;
    if remaining = 0 then
      delete from households where id = hid;
    end if;
  end if;
end;
$$;

-- 6) 실행 권한
grant execute on function public.create_household() to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
