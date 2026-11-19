-- ============================================================
-- 모아불리 — 가치관 체크리스트를 ○✕ 에서 1~5점으로 (2026-11-20)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- ○✕ 시절(11-19) 답은 1·2 의 뜻이 달라서 지웁니다(하루 쓴 시범 기간).
-- ============================================================

begin;

delete from public.household_values where answers ~ '^[012]{50}$';

alter table public.household_values drop constraint if exists household_values_answers_check;
alter table public.household_values add constraint household_values_answers_check
  check (answers ~ '^[0-5]{50}$');

commit;

-- 확인용 — 0-5 가 들어간 줄이 나오면 성공
select pg_get_constraintdef(oid) from pg_constraint where conname = 'household_values_answers_check';
