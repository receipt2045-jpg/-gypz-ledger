-- ============================================================
-- gypz-ledger: 부부 가계부 스키마
-- Supabase SQL Editor에 전체를 붙여넣고 Run 하면 됩니다.
-- ============================================================

-- 1) 가구(부부 한 쌍 = 가구 하나)
create table public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default upper(encode(gen_random_bytes(4), 'hex')),
  member1_name text not null default '남편',
  member2_name text not null default '아내',
  target_net_worth bigint not null default 1000000000,
  start_year int not null default date_part('year', now()),
  categories jsonb not null default '{
    "income": ["주수입", "부수입", "투자수익"],
    "saving": ["주택청약", "예금", "적금", "연금", "목적저금"],
    "investment": ["주식", "부동산", "코인"],
    "fixed": ["보험", "통신", "용돈", "주거", "구독"],
    "variable": ["식비", "생활용품", "건강", "육아", "꾸밈", "자기계발", "여행", "자동차", "문화생활", "세금", "반려견", "경조사"]
  }'::jsonb,
  created_at timestamptz not null default now()
);

-- 2) 가구 멤버 (로그인 계정 <-> 가구 연결, 최대 2명)
create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_no smallint not null check (member_no in (1, 2)),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (household_id, member_no),
  unique (user_id) -- 한 계정은 하나의 가구에만 속함
);

-- 3) 월간 가계부 (한 달 = 한 행, 수입/지출 항목은 items JSON에)
create table public.ledgers (
  household_id uuid not null references public.households(id) on delete cascade,
  ym text not null check (ym ~ '^[0-9]{4}-[0-9]{2}$'),
  items jsonb not null default '[]'::jsonb,
  closed boolean not null default false,
  settled_members jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, ym)
);

-- 4) 자산 스냅샷 (한 달 = 한 행, 계좌 목록은 items JSON에)
create table public.snapshots (
  household_id uuid not null references public.households(id) on delete cascade,
  ym text not null check (ym ~ '^[0-9]{4}-[0-9]{2}$'),
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, ym)
);

-- 5) 경조사/연간비 기록
create table public.occasions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date date not null,
  category text not null,
  title text not null,
  amount bigint not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RLS(행 수준 보안): 자기 가구 데이터만 읽고 쓸 수 있음
-- ============================================================

-- 멤버십 확인 함수 (정책 안에서 재귀 없이 쓰기 위해 security definer)
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

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.ledgers enable row level security;
alter table public.snapshots enable row level security;
alter table public.occasions enable row level security;

-- households: 멤버만 조회/수정 (생성·참여는 아래 RPC 함수로만)
create policy "households_select" on public.households
  for select using (public.is_member(id));
create policy "households_update" on public.households
  for update using (public.is_member(id)) with check (public.is_member(id));

-- household_members: 자기 가구 멤버 목록만 조회 (등록은 RPC로만)
create policy "members_select" on public.household_members
  for select using (public.is_member(household_id));

-- ledgers / snapshots / occasions: 멤버만 모든 작업 가능
create policy "ledgers_all" on public.ledgers
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "snapshots_all" on public.snapshots
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "occasions_all" on public.occasions
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ============================================================
-- RPC 함수: 가구 만들기 / 초대 코드로 참여하기
-- ============================================================

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

grant execute on function public.create_household() to authenticated;
grant execute on function public.join_household(text) to authenticated;
