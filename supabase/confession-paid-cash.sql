-- 소비 기록에 '현금으로 냄' (2026-10-21 의견: "현금으로 쓴 건 기록 못 하나요?")
-- 카드 주인(card_owner)은 비워 두고 이 칸을 켠다. 여러 번 실행해도 괜찮다.
alter table public.confessions
  add column if not exists paid_cash boolean not null default false;
