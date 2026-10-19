-- 로그인 화면 사회적 증거 — 가구 수 대신 가입한 사람 수로 (2026-10-19)
-- RLS는 그대로 두고(테이블 접근 불가), 숫자만 돌려주는 함수를 연다.
-- 여러 번 실행해도 괜찮다.
create or replace function public.public_member_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from auth.users;
$$;

revoke all on function public.public_member_count() from public;
grant execute on function public.public_member_count() to anon, authenticated;
