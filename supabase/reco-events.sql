-- 맞춤 추천 카드 보임·누름 기록 (2026-10-24)
-- 소비 기록 직후·정산 완료 화면의 카드가 얼마나 보이고 눌리는지 본다. 앱은 쓰기만, 읽기는 SQL 편집기에서.
-- 여러 번 실행해도 괜찮다.
create table if not exists public.reco_events (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  slot text not null check (slot in ('confess', 'settle')),
  card text not null check (char_length(card) <= 60),
  action text not null check (action in ('view', 'click')),
  created_at timestamptz not null default now()
);
create index if not exists reco_events_created on public.reco_events (created_at desc);

alter table public.reco_events enable row level security;

drop policy if exists "reco insert own" on public.reco_events;
create policy "reco insert own" on public.reco_events
  for insert to authenticated
  with check (user_id = auth.uid());

-- 보는 법:
-- select slot, card, count(*) filter (where action = 'view') views,
--        count(*) filter (where action = 'click') clicks
-- from public.reco_events where created_at > now() - interval '7 days'
-- group by 1, 2 order by 3 desc;
