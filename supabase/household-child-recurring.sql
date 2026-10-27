-- 아이 생일·매달 들어오는 아이 돈 (2026-10-27) — 집 설정(households)에 칸 두 개.
-- child_births: {"찰떡이": "2026-03-10"} / child_recurring: 매달 자동으로 적을 규칙 목록 (앱의 ChildRecurring)
-- 칸만 더한다. 여러 번 실행해도 괜찮다.
alter table public.households add column if not exists child_births jsonb;
alter table public.households add column if not exists child_recurring jsonb;
