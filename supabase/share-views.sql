-- 자료 나눔 — 몇 명이 봤는지 (2026-11-21)
-- 자료를 연 기기를 한 번씩만 센다. 기기마다 앱이 만든 무작위 번호(viewer)만 남기고 누구인지는 남기지 않는다.
-- 표를 직접 읽고 쓰지 못하게 하고(RLS, 정책 없음), 아래 두 함수로만 남기고 센다. 로그인 안 해도 된다.
-- 여러 번 실행해도 괜찮다.

create table if not exists public.share_views (
  slug text not null check (slug ~ '^[a-z0-9-]{1,60}$'),
  viewer uuid not null,
  first_at timestamptz not null default now(),
  primary key (slug, viewer)
);
alter table public.share_views enable row level security;

create or replace function public.record_share_view(p_slug text, p_viewer uuid)
returns void
language sql security definer
set search_path = public
as $$
  insert into share_views (slug, viewer)
  select p_slug, p_viewer
  where p_slug ~ '^[a-z0-9-]{1,60}$'
  on conflict (slug, viewer) do nothing;
$$;

create or replace function public.share_view_counts()
returns table (slug text, viewers bigint)
language sql security definer stable
set search_path = public
as $$
  select slug, count(*) from share_views group by slug;
$$;

grant execute on function public.record_share_view(text, uuid) to anon, authenticated;
grant execute on function public.share_view_counts() to anon, authenticated;
