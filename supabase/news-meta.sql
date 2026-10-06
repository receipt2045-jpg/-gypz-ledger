-- 오늘의 경제 기사 사진·언론사 (2026-10-06)
-- 뉴스 글 속 기사 주소마다 대표 사진(og:image)과 언론사 이름을 저장해 둔다.
-- 채우는 쪽: Edge Function telegram-post (글이 올라올 때 service role로) — 앱은 읽기만.
-- 여러 번 실행해도 괜찮다.

create table if not exists public.news_meta (
  url text primary key,
  image text,
  press text,
  fetched_at timestamptz not null default now()
);

alter table public.news_meta enable row level security;

drop policy if exists "news_meta read" on public.news_meta;
create policy "news_meta read" on public.news_meta
  for select to anon, authenticated
  using (true);
