-- 아이 앞으로 들어온 돈 (2026-10-27) — 아동수당·지원금, 용돈·선물을 아이 이름으로 기록
-- child: 설정의 자녀 이름 / child_keep: 아이 통장에 모으면 true, 살림에 보태면 false
-- gift: 부모·조부모가 준 돈(미성년 자녀 증여재산공제 10년 2,000만원 누적에 센다)
-- 여러 번 실행해도 괜찮다.
alter table public.confessions add column if not exists child text check (char_length(child) <= 30);
alter table public.confessions add column if not exists child_keep boolean;
alter table public.confessions add column if not exists gift boolean not null default false;
create index if not exists confessions_child on public.confessions (household_id, child) where child is not null;
