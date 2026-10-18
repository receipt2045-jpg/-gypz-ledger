-- 배우자 가계부로 옮기기 (2026-10-18 제보: "남편이 초대 링크로 가입했는데 제 가계부로 안 넘어가요")
-- 초대 코드를 못 받고 가입해 '새로 만들기'를 누른 사람은 이미 자기 가계부가 있어서 join_household가 막혔다.
-- 혼자 쓰던 가계부일 때만, 그 가계부를 지우고 배우자 가계부에 들어간다.
-- 둘이 쓰는 가계부면 옮기지 않는다(배우자 기록이 사라지면 안 된다).
-- 여러 번 실행해도 괜찮다.
create or replace function public.switch_household(code text)
returns public.households
language plpgsql security definer
set search_path = public
as $$
declare
  h public.households;
  mine uuid;
  cnt int;
  mycnt int;
  slot smallint;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  select * into h from households where invite_code = upper(trim(code));
  if h.id is null then
    raise exception '초대 코드를 찾을 수 없어요';
  end if;
  select household_id into mine from household_members where user_id = auth.uid();
  if mine = h.id then
    raise exception '이미 이 가계부에 연결돼 있어요';
  end if;
  select count(*) into cnt from household_members where household_id = h.id;
  if cnt >= 2 then
    raise exception '이 가계부에는 이미 두 명이 연결되어 있어요';
  end if;
  if mine is not null then
    select count(*) into mycnt from household_members where household_id = mine;
    if mycnt > 1 then
      raise exception '지금 가계부를 배우자와 함께 쓰고 있어서 옮길 수 없어요';
    end if;
    delete from households where id = mine; -- 혼자 쓰던 가계부 — on delete cascade로 기록도 함께 지운다
  end if;
  -- 비어 있는 자리 번호로 (보통 2)
  slot := case when exists (select 1 from household_members where household_id = h.id and member_no = 1)
               then 2 else 1 end;
  insert into household_members (household_id, user_id, member_no)
  values (h.id, auth.uid(), slot);
  return h;
end;
$$;

grant execute on function public.switch_household(text) to authenticated;
