-- ============================================================
-- 모아불리 — 지금 적용할 변경 (2026-07)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다(데이터 안 지워짐).
-- 전체가 한 트랜잭션이라 중간에 실패하면 아무것도 안 바뀝니다.
-- ============================================================

begin;

-- ── 1) 구성원 색상 (아바타 색 선택) ──────────────
alter table public.households add column if not exists member1_color text;
alter table public.households add column if not exists member2_color text;

-- ── 2) 사용자 의견(feedback) 테이블 ──────────────
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  rating smallint check (rating between 1 and 5),
  message text not null,
  screen text,
  app_version text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- 로그인 사용자는 '보내기'만 가능.
-- SELECT 정책을 일부러 만들지 않음 → Postgres 기본 거부 규칙에 따라
-- 앱에서는 누구도 남의 의견을 읽을 수 없음. 운영자는 대시보드(service_role)로만 확인.
drop policy if exists "feedback_insert" on public.feedback;
create policy "feedback_insert" on public.feedback
  for insert to authenticated with check (auth.uid() = user_id);

-- ── 3) 고백 작성자 위조 방지 ─────────────────────
-- 기존 정책은 "우리 가구인가"만 확인해서, 마음만 먹으면
-- 배우자 이름으로 고백을 남길 수 있었음. 내 번호로만 쓰도록 막는다.
create or replace function public.my_member_no(hid uuid)
returns smallint
language sql stable security definer
set search_path = public
as $$
  select member_no from household_members
  where household_id = hid and user_id = auth.uid()
  limit 1;
$$;

drop policy if exists "confessions_all" on public.confessions;
drop policy if exists "confessions_select" on public.confessions;
drop policy if exists "confessions_insert" on public.confessions;
drop policy if exists "confessions_update" on public.confessions;
drop policy if exists "confessions_delete" on public.confessions;

-- 읽기: 우리 가구 것이면 배우자 고백도 볼 수 있음(원래 의도대로)
create policy "confessions_select" on public.confessions
  for select using (public.is_member(household_id));

-- 쓰기: 우리 가구 + 반드시 '내 번호'로만
create policy "confessions_insert" on public.confessions
  for insert with check (
    public.is_member(household_id)
    and member_no = public.my_member_no(household_id)
  );

create policy "confessions_update" on public.confessions
  for update using (
    public.is_member(household_id)
    and member_no = public.my_member_no(household_id)
  ) with check (
    public.is_member(household_id)
    and member_no = public.my_member_no(household_id)
  );

-- 삭제: 자기 고백만 지울 수 있음
create policy "confessions_delete" on public.confessions
  for delete using (
    public.is_member(household_id)
    and member_no = public.my_member_no(household_id)
  );

commit;
