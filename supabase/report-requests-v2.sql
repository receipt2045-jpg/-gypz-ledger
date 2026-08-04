-- ============================================================
-- 맞춤 리포트 v2 — 이메일 수신처 + 초안 보관 + 결제·발송 기록
--
-- 결과를 메일로 보내므로 이메일을 따로 받는다(카톡 닉네임은 보조).
-- ============================================================

alter table public.report_requests add column if not exists email text;
alter table public.report_requests add column if not exists paid_at timestamptz;
alter table public.report_requests add column if not exists sent_at timestamptz;

-- 기존 행 보정: contact에 @가 있으면 이메일로 옮긴다
update public.report_requests
   set email = contact
 where email is null and contact like '%@%';

-- 앞으로는 이메일이 주 수신처, 카톡 닉네임은 선택
alter table public.report_requests alter column contact drop not null;

-- ── 초안은 별도 테이블 ────────────────────────
-- RLS는 행 단위라, 같은 행에 두면 신청자도 초안을 읽을 수 있다.
-- 정책을 하나도 만들지 않으면 anon·authenticated 모두 접근 불가 —
-- Edge Function(service_role)만 읽고 쓴다.
create table if not exists public.report_drafts (
  request_id uuid primary key references public.report_requests(id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.report_drafts enable row level security;

comment on table public.report_drafts is
  '운영자 리포트 초안. RLS 정책 없음 = 앱에서 접근 불가, service_role 전용.';
