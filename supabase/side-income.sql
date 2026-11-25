-- 부수입 가계부 (2026-11-19) — 살림 가계부와 따로 적고 따로 정산한다.
-- 들어온 돈(cash): 통장에 실제로 들어온 돈 / 아낀 돈(saved): 체험단·포인트처럼 안 나간 돈.
-- 월말 부수입 정산(side_settlements)에서 들어온 돈을 자산 통장·살림으로 보낸다.
-- 여러 번 실행해도 괜찮다.

create table if not exists public.side_incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_no smallint not null check (member_no in (1, 2)), -- 번 사람 (공동이면 적은 사람)
  shared boolean not null default false,
  kind text not null check (kind in ('cash', 'saved', 'spent')), -- 번 돈·아낀 돈·쓴 돈 (spent는 side-income-spent.sql)
  category text not null check (char_length(category) between 1 and 30),
  amount bigint not null check (amount >= 0), -- 들어온 돈 / 아낀 돈
  price bigint check (price >= 0), -- 아낀 돈: 원래 얼마짜리였나
  paid bigint check (paid >= 0), -- 아낀 돈: 그중 내가 낸 돈
  note text check (char_length(note) <= 100),
  earned_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists side_incomes_household on public.side_incomes (household_id, earned_on desc);

alter table public.side_incomes enable row level security;
drop policy if exists "side_incomes_all" on public.side_incomes;
create policy "side_incomes_all" on public.side_incomes
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));

-- 달마다 한 줄 — 있으면 마감한 달. allocations: [{to:'asset', assetId, assetName, amount} | {to:'living', amount, split}]
create table if not exists public.side_settlements (
  household_id uuid not null references public.households(id) on delete cascade,
  ym text not null check (ym ~ '^\d{4}-\d{2}$'),
  allocations jsonb not null default '[]'::jsonb,
  closed_at timestamptz not null default now(),
  primary key (household_id, ym)
);

alter table public.side_settlements enable row level security;
drop policy if exists "side_settlements_all" on public.side_settlements;
create policy "side_settlements_all" on public.side_settlements
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));
