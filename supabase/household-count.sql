-- 로그인 화면 사회적 증거 — 가구 수 하나만 익명에게 공개한다.
-- RLS는 그대로 두고(테이블 접근 불가), 숫자만 돌려주는 함수를 연다.
create or replace function public.public_household_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.households;
$$;

revoke all on function public.public_household_count() from public;
grant execute on function public.public_household_count() to anon, authenticated;
