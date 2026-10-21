-- 묻고 답하기 + 1:1 상담 신청 (2026-10-21)
-- 질문: 로그인한 사람 누구나 · 답: 결영이네(staff 명단)만 · 답 달린 질문은 로그인 없이도 읽힌다(공유 링크).
-- 상담 신청: 누구나 보낼 수 있고, 읽기는 staff만.
-- 여러 번 실행해도 괜찮다.

-- ── 답변하는 사람 명단 ─────────────────────────
create table if not exists public.staff (
  email text primary key,
  display_name text not null
);
alter table public.staff enable row level security;
-- 명단은 앱에서 직접 못 읽는다(이메일이 있다). is_staff()로만 확인한다.

insert into public.staff (email, display_name)
values ('receipt2045@gmail.com', '결영이네')
on conflict (email) do nothing;
-- 남편 계정 추가: insert into public.staff (email, display_name) values ('남편이메일', '결영이네') on conflict do nothing;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_staff() to anon, authenticated;

create or replace function public.staff_name()
returns text
language sql stable security definer
set search_path = ''
as $$
  select display_name from public.staff where email = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
grant execute on function public.staff_name() to authenticated;

-- ── 질문 ───────────────────────────────────────
create sequence if not exists public.question_nick_seq;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  category text not null check (category in ('stock', 'home', 'sns', 'couple')),
  title text not null check (char_length(title) between 2 and 80),
  body text not null check (char_length(body) between 5 and 2000),
  nickname text not null default '익명의 부부',
  -- 콘텐츠 활용 안내를 확인한 시각 — 유튜브·인스타에 소개하려면 이 기록이 있어야 한다
  consent_at timestamptz not null,
  hidden boolean not null default false,
  answered boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists questions_created on public.questions (created_at desc);

-- 닉네임·상태는 서버가 정한다 — 앱에서 '결영이네'처럼 적어 보내도 덮어쓴다
create or replace function public.questions_before_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.nickname := '익명의 부부 ' || nextval('public.question_nick_seq');
  new.answered := false;
  new.hidden := false;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists questions_before_insert on public.questions;
create trigger questions_before_insert before insert on public.questions
  for each row execute function public.questions_before_insert();

alter table public.questions enable row level security;

drop policy if exists "questions read" on public.questions;
create policy "questions read" on public.questions
  for select to anon, authenticated
  using (
    public.is_staff()
    or (not hidden and (answered or auth.uid() is not null))
    or user_id = auth.uid()
  );

drop policy if exists "questions insert" on public.questions;
create policy "questions insert" on public.questions
  for insert to authenticated
  with check (user_id = auth.uid() and not hidden and not answered);

drop policy if exists "questions delete own" on public.questions;
create policy "questions delete own" on public.questions
  for delete to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "questions staff update" on public.questions;
create policy "questions staff update" on public.questions
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ── 답 ─────────────────────────────────────────
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  author_name text not null default '결영이네',
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists answers_question on public.answers (question_id, created_at);

alter table public.answers enable row level security;

drop policy if exists "answers read" on public.answers;
create policy "answers read" on public.answers
  for select to anon, authenticated
  using (true);

drop policy if exists "answers staff write" on public.answers;
create policy "answers staff write" on public.answers
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- 답이 생기거나 다 지워지면 질문의 '답변 완료'를 맞춘다
create or replace function public.sync_question_answered()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare qid uuid := coalesce(new.question_id, old.question_id);
begin
  update questions set answered = exists (select 1 from answers where question_id = qid)
  where id = qid;
  return null;
end;
$$;

drop trigger if exists answers_sync on public.answers;
create trigger answers_sync after insert or delete on public.answers
  for each row execute function public.sync_question_answered();

-- ── 1:1 상담 신청 ──────────────────────────────
create table if not exists public.consult_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 30),
  contact text not null check (char_length(contact) between 3 and 60),
  plan text not null check (plan in ('basic', 'premium', 'undecided')),
  region text not null,
  topic text not null check (char_length(topic) between 5 and 2000),
  preferred_time text,
  -- 개인정보 수집·이용 동의 시각
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'done', 'canceled')),
  created_at timestamptz not null default now()
);
create index if not exists consult_requests_created on public.consult_requests (created_at desc);

alter table public.consult_requests enable row level security;

drop policy if exists "consult insert" on public.consult_requests;
create policy "consult insert" on public.consult_requests
  for insert to anon, authenticated
  with check (status = 'new');

drop policy if exists "consult staff read" on public.consult_requests;
create policy "consult staff read" on public.consult_requests
  for select to authenticated
  using (public.is_staff());

drop policy if exists "consult staff update" on public.consult_requests;
create policy "consult staff update" on public.consult_requests
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- 상담 전 우리집 상황 (2026-10-21) — 원팀 '[신혼집] 1:1 상담 신청서' 질문들. 한 칸(jsonb)에 담는다.
alter table public.consult_requests add column if not exists details jsonb;
