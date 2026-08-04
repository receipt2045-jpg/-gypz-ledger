-- ============================================================
-- 우리 부부 맞춤 리포트 신청 + 데이터 열람 동의
--
-- 남의 가계부를 사람이 직접 열어보는 일이라, 신청과 '동의'를 한 행에 같이
-- 남긴다. 동의 없이는 행이 만들어지지 않고(consent_at not null),
-- 언제든 철회할 수 있다(revoke_report_consent).
-- ============================================================

create table if not exists public.report_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contact text not null,                     -- 결과를 받을 곳 (카톡 닉네임/이메일)
  note text,                                 -- 특히 궁금한 점
  consent_at timestamptz not null default now(),  -- 데이터 열람 동의 시각
  revoked_at timestamptz,                    -- 동의 철회 시각 (있으면 열람 불가)
  status text not null default 'requested'
    check (status in ('requested', 'paid', 'writing', 'done', 'canceled')),
  created_at timestamptz not null default now()
);

create index if not exists report_requests_household on public.report_requests (household_id);
create index if not exists report_requests_created on public.report_requests (created_at desc);

alter table public.report_requests enable row level security;

-- 신청: 본인 계정으로, 자기 가구 것만
drop policy if exists "report_requests_insert" on public.report_requests;
create policy "report_requests_insert" on public.report_requests
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_member(household_id));

-- 조회: 우리 가구 신청 내역만 (배우자도 볼 수 있어야 중복 신청을 막는다)
drop policy if exists "report_requests_select" on public.report_requests;
create policy "report_requests_select" on public.report_requests
  for select to authenticated
  using (public.is_member(household_id));

-- 수정 정책은 두지 않는다. 철회는 아래 RPC로만 — 상태(status)는 운영자만 바꾼다.
create or replace function public.revoke_report_consent(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update report_requests
     set revoked_at = now(), status = 'canceled'
   where id = request_id
     and revoked_at is null
     and is_member(household_id);
end;
$$;

-- Supabase는 public 스키마의 새 함수에 anon 실행 권한을 기본으로 부여한다.
-- 'from public' 회수만으로는 그 명시적 grant가 지워지지 않으므로 anon도 직접 회수한다.
-- (안 하면 로그인 없이도 이 함수를 호출할 수 있다. is_member가 막아서 실제
--  변경은 일어나지 않지만, 애초에 부를 수 없게 해두는 게 맞다.)
revoke all on function public.revoke_report_consent(uuid) from public;
revoke all on function public.revoke_report_consent(uuid) from anon;
grant execute on function public.revoke_report_consent(uuid) to authenticated;
