-- '오늘의 경제'를 로그인 없이도 읽게 (2026-10-06)
-- 카톡 톡방 링크(moabuli.com/news)로 들어온 사람도 바로 본다. 쓰기는 그대로 운영자만.
-- 여러 번 실행해도 괜찮다.

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts
  for select to anon, authenticated
  using (true);
