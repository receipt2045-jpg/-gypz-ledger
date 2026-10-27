-- 증여 신고 기록 (2026-10-27) — 아이 앞으로 준 돈을 홈택스에 신고했는지 아이별로 남긴다.
-- kind: lump 한 번에(그때그때) 신고 / periodic 매달 정해진 돈을 주기로 하고 한 번에 신고(유기정기금)
-- 정기금은 계약한 전체 금액을 amount에 적는다. 여러 번 실행해도 괜찮다.
create table if not exists public.child_gift_reports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  child text not null check (char_length(child) between 1 and 20),
  reported_on date not null default current_date,
  amount bigint not null check (amount > 0 and amount < 10000000000),
  kind text not null default 'lump' check (kind in ('lump', 'periodic')),
  note text check (char_length(note) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists child_gift_reports_household
  on public.child_gift_reports (household_id, reported_on);

alter table public.child_gift_reports enable row level security;
create policy "child_gift_reports_all" on public.child_gift_reports
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));
