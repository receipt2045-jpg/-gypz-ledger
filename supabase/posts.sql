-- 정보 탭 '오늘의 경제' 글 (2026-10-05)
-- 읽기: 로그인한 사람 모두 · 쓰기/고치기/지우기: 운영자 계정만
-- 여러 번 실행해도 괜찮다.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'news' check (kind in ('news', 'market', 'notice')),
  title text not null,
  body text not null,
  post_date date not null default (now() at time zone 'Asia/Seoul')::date,
  created_at timestamptz not null default now()
);

create index if not exists posts_date_idx on public.posts (post_date desc, created_at desc);

alter table public.posts enable row level security;

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts
  for select to authenticated
  using (true);

drop policy if exists "posts admin write" on public.posts;
create policy "posts admin write" on public.posts
  for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'receipt2045@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'receipt2045@gmail.com');
