-- 전체 초기화가 고백 기록까지 지우게 한다.
--
-- 문제: confessions 삭제 정책이 '내가 쓴 것만'이라, 앱(클라이언트)에서
-- 초기화하면 배우자 고백이 남는다 → "초기화해도 데이터가 남아있어요" 신고.
-- 해결: security definer 함수로 서버에서 가구 전체를 한 번에 지운다.
-- (호출자는 반드시 그 가구의 멤버 — auth.uid()로 확인)
create or replace function public.reset_household()
returns void
language plpgsql security definer
set search_path = public
as $$
declare hid uuid;
begin
  select household_id into hid from household_members where user_id = auth.uid() limit 1;
  if hid is null then
    raise exception '가구가 없습니다';
  end if;
  delete from ledgers where household_id = hid;
  delete from snapshots where household_id = hid;
  delete from occasions where household_id = hid;
  delete from confessions where household_id = hid;
end;
$$;

-- 새 public 함수는 anon에게 EXECUTE가 기본으로 붙는다. 명시적으로 끊는다.
revoke all on function public.reset_household() from public;
revoke all on function public.reset_household() from anon;
grant execute on function public.reset_household() to authenticated;
