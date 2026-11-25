-- 부수입 쓴 돈·매달 (2026-11-23) — side-income.sql 다음에 한 번 실행.
-- 쓴 돈(spent): 부수입 때문에 나간 돈. 매달(repeat): 다음 달 같은 날에 저절로 적는다 — 묶음(series)은 처음 기록의 id.
-- 구분 칸 규칙을 바꾸려면 옛 규칙을 지우고 다시 만들어야 해서 대시보드가 '위험한 작업' 경고를 띄운다(기록은 안 지워진다).
alter table public.side_incomes add column if not exists repeat boolean not null default false;
alter table public.side_incomes add column if not exists series uuid;
alter table public.side_incomes drop constraint if exists side_incomes_kind_check;
alter table public.side_incomes
  add constraint side_incomes_kind_check check (kind in ('cash', 'saved', 'spent'));
