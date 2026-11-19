-- ============================================================
-- 모아불리 — 부부 재테크 가치관 체크리스트 답 (2026-11-19)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- moabuli.com/#/values 에서 로그인한 부부는 각자 폰으로 답하면 여기서 합쳐진다.
-- 한 사람 = 한 행. role 은 그 사람이 고른 칸(w 아내 · h 남편), answers 는 50글자(0 빈칸·1 ○·2 ✕).
-- 같은 가구 멤버만 읽고, 자기 행만 쓴다.
-- ============================================================

begin;

create table if not exists public.household_values (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('w', 'h')),
  answers text not null check (answers ~ '^[012]{50}$'),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table public.household_values enable row level security;

drop policy if exists "values_select" on public.household_values;
create policy "values_select" on public.household_values
  for select using (public.is_member(household_id));

drop policy if exists "values_insert" on public.household_values;
create policy "values_insert" on public.household_values
  for insert with check (public.is_member(household_id) and user_id = auth.uid());

drop policy if exists "values_update" on public.household_values;
create policy "values_update" on public.household_values
  for update using (user_id = auth.uid())
  with check (public.is_member(household_id) and user_id = auth.uid());

drop policy if exists "values_delete" on public.household_values;
create policy "values_delete" on public.household_values
  for delete using (user_id = auth.uid());

commit;

-- 확인용 — household_values 한 줄이 나오면 성공
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'household_values';
