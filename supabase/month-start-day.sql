-- 우리집 한 달 시작일 (2026-10-07 제보: "급여일이 15일이라 15일부터 한 달로 생활해요")
-- 1이면 예전과 같다(1일~말일). 15면 10월 = 10월 15일 ~ 11월 14일.
-- 여러 번 실행해도 괜찮다.
alter table public.households
  add column if not exists month_start_day smallint not null default 1;

alter table public.households drop constraint if exists households_month_start_day_check;
alter table public.households
  add constraint households_month_start_day_check check (month_start_day between 1 and 28);
