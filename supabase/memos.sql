-- 우리집 메모 (2026-11-24) — 2026-11-13 의견: "메모 탭이 있으면 좋겠어요. 가계부 관련된 메모들만 따로 모아불리에 작성하고 싶어요."
-- 부부가 같이 보고 같이 고친다. 여러 번 실행해도 괜찮다.

create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_no smallint not null check (member_no in (1, 2)), -- 쓴 사람
  body text not null check (char_length(body) between 1 and 2000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists memos_household on public.memos (household_id, updated_at desc);

alter table public.memos enable row level security;
drop policy if exists "memos_all" on public.memos;
create policy "memos_all" on public.memos
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));
