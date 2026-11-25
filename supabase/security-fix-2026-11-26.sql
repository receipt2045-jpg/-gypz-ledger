-- 보안 점검 고치기 (2026-11-26) — security-audit run-1 확인 필요 1·4번
-- 1) 초대 코드 맞추기 막기: 틀린 시도를 계정마다 세서 1시간 10번 / 하루 30번이 넘으면 막는다.
--    틀렸을 때 오류를 내면 시도 기록까지 같이 취소되므로, 틀린 코드면 빈 결과(null)를 돌려준다.
--    앱(src/lib/db.ts)은 빈 결과를 '초대 코드를 찾을 수 없어요'로 보여 준다.
-- 2) 배우자가 탈퇴해 자리가 비면 초대 코드를 새로 바꾼다 — 예전 링크로 다시 못 들어오게.
-- 여러 번 실행해도 괜찮다.

-- 틀린 초대 코드 시도 기록 (정책 없음 = 앱에서 직접 못 읽고 못 쓴다. 아래 함수만 쓴다)
create table if not exists public.invite_attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists invite_attempts_user_time on public.invite_attempts (user_id, created_at);
alter table public.invite_attempts enable row level security;
revoke all on public.invite_attempts from anon, authenticated;

-- 너무 많이 틀렸으면 막는다 (join/switch가 코드를 찾기 전에 부른다)
create or replace function public.invite_guard()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from invite_attempts where user_id = auth.uid() and created_at < now() - interval '2 days';
  if (select count(*) from invite_attempts
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception '초대 코드를 여러 번 틀렸어요. 1시간 뒤에 다시 해 주세요';
  end if;
  if (select count(*) from invite_attempts
      where user_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception '초대 코드를 너무 많이 틀렸어요. 내일 다시 해 주세요';
  end if;
end;
$$;
revoke all on function public.invite_guard() from public, anon, authenticated;

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
  perform invite_guard();
  select * into h from households where invite_code = upper(trim(code));
  if h.id is null then
    insert into invite_attempts (user_id) values (auth.uid());
    return null; -- 틀린 코드: 시도 기록을 남기려고 오류 대신 빈 결과
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
  perform invite_guard();
  select * into h from households where invite_code = upper(trim(code));
  if h.id is null then
    insert into invite_attempts (user_id) values (auth.uid());
    return null; -- 틀린 코드: 시도 기록을 남기려고 오류 대신 빈 결과
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
  slot := case when exists (select 1 from household_members where household_id = h.id and member_no = 1)
               then 2 else 1 end;
  insert into household_members (household_id, user_id, member_no)
  values (h.id, auth.uid(), slot);
  return h;
end;
$$;

-- 탈퇴: 남은 배우자가 있으면 초대 코드를 새로 바꾼다 (계정 자체는 delete-account 함수가 지운다)
create or replace function public.delete_my_account()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  hid uuid;
  remaining int;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  select household_id into hid from household_members where user_id = auth.uid();
  if hid is not null then
    delete from household_members where household_id = hid and user_id = auth.uid();
    select count(*) into remaining from household_members where household_id = hid;
    if remaining = 0 then
      delete from households where id = hid;
    else
      update households
        set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
        where id = hid;
    end if;
  end if;
end;
$$;

revoke all on function public.join_household(text) from public, anon;
revoke all on function public.switch_household(text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.switch_household(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
