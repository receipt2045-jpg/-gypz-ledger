-- 자산 로드맵(/roadmap) 가정·계획을 저장할 칸. (2026-10-05)
--
-- 부부가 같이 보는 값이라 가구(households)에 둔다. goal 칸과 같은 방식.
-- 모양: {"targetYear": 2036, "monthlySaving": 2500000, "returnRate": 0.05,
--        "incomeGrowth": 0.03, "realTerms": false,
--        "events": [{"id": "…", "kind": "house", "ym": "2028-06", "price": 600000000, "loan": 400000000}]}
--
-- 배포 전에 먼저 실행할 것. 칸이 없는 DB에 roadmap을 보내면 이름·목표 저장까지 같이 실패한다.

alter table public.households add column if not exists roadmap jsonb;

-- 확인용 — roadmap 한 줄이 나오면 성공
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'households' and column_name = 'roadmap';
