-- ============================================================
-- 모아불리 — 무지출 기록 허용 (2026-08)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다.
-- ============================================================

begin;

-- 안 쓴 날도 0원으로 기록해야 연속(스트릭)이 끊기지 않는다.
-- 기존 제약은 amount > 0 이라 0원 저장이 막혀 있었다.
alter table public.confessions drop constraint if exists confessions_amount_check;
alter table public.confessions add constraint confessions_amount_check check (amount >= 0);

commit;
