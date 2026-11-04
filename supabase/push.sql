-- 푸시 알림 (2026-11-04, 설계: docs/superpowers/specs/2026-11-04-push-notifications-design.md)
-- 읽기·쓰기: 본인 행만 · 발송(push-dispatch)은 service_role · 캠페인은 운영자 계정만.
-- 크론 예약은 push-cron.sql에 따로 있다(함수 배포 뒤 실행).
-- 여러 번 실행해도 괜찮다.

-- 1) 폰 토큰 — 한 사람이 폰 여러 대면 여러 행
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android' check (platform in ('android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens (user_id);

-- 2) 알림 설정 — 행이 없으면 아직 알림을 켜지 않은 사람
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reminder_on boolean not null default true,
  reminder_time time not null default '21:00',
  settle_on boolean not null default true,
  news_on boolean not null default true,
  promo_on boolean not null default false,
  promo_consent_at timestamptz,
  promo_reconfirm_sent_at timestamptz,
  updated_at timestamptz not null default now()
);
-- 리마인더 시각은 30분 단위만
alter table public.notification_prefs drop constraint if exists notification_prefs_time_step;
alter table public.notification_prefs
  add constraint notification_prefs_time_step
  check (extract(second from reminder_time) = 0 and extract(minute from reminder_time) in (0, 30));

-- 3) 보낸 기록 — 중복 방지와 "3일 뒤 다시" 판단용. 사람 기준 1건
create table if not exists public.push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reminder', 'settle', 'settle_again', 'news', 'notice', 'promo', 'promo_reconfirm')),
  ref_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, ref_key)
);
create index if not exists push_log_sent on public.push_log (sent_at desc);

-- 4) 운영자가 쓰는 공지·홍보
create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notice', 'promo')),
  title text not null check (char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 300),
  path text not null default '/' check (path ~ '^/([^/].*)?$'),
  send_at timestamptz not null default now(),
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'canceled')),
  sent_count int not null default 0,
  fail_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists push_campaigns_due on public.push_campaigns (status, send_at);

-- ── RLS ──
alter table public.push_tokens enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_log enable row level security;
alter table public.push_campaigns enable row level security;

-- 토큰: 본인 것만 보고 지운다. 넣기·바꾸기는 register_push_token()으로만
drop policy if exists "push_tokens own read" on public.push_tokens;
create policy "push_tokens own read" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "push_tokens own delete" on public.push_tokens;
create policy "push_tokens own delete" on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "notification_prefs own" on public.notification_prefs;
create policy "notification_prefs own" on public.notification_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_log own read" on public.push_log;
create policy "push_log own read" on public.push_log
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_campaigns admin" on public.push_campaigns;
create policy "push_campaigns admin" on public.push_campaigns
  for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'receipt2045@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'receipt2045@gmail.com');

-- ── RPC ──
-- 같은 폰에 다른 계정이 로그인하면 토큰 주인을 바꾼다(RLS로는 남의 행을 못 바꿔서 security definer)
create or replace function public.register_push_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 4096 then
    raise exception '알림 토큰이 올바르지 않아요';
  end if;
  insert into push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- 로그아웃·탈퇴 때 이 폰 토큰을 지운다
create or replace function public.forget_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_tokens where token = p_token and user_id = auth.uid();
$$;

-- 관리자 "○명에게 보내요" — 토큰이 있는 사람 중 공지는 news_on, 홍보는 promo_on
create or replace function public.push_audience_count(p_kind text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'receipt2045@gmail.com' then
    raise exception '운영자만 볼 수 있어요';
  end if;
  return (
    select count(distinct t.user_id)::int
    from push_tokens t
    join notification_prefs p on p.user_id = t.user_id
    where case p_kind when 'notice' then p.news_on when 'promo' then p.promo_on else false end
  );
end;
$$;

revoke all on function public.register_push_token(text, text) from public;
revoke all on function public.forget_push_token(text) from public;
revoke all on function public.push_audience_count(text) from public;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.forget_push_token(text) to authenticated;
grant execute on function public.push_audience_count(text) to authenticated;
