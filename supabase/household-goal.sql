-- 자산 로드맵 '모을 돈' 목표를 저장할 칸.
--
-- 부부가 같이 보는 값이라 계정(user_metadata)이 아니라 가구(households)에 둔다.
-- 집·집값은 넣지 않는다. 금액·시점·이름·역할·이유만 사용자가 정하고,
-- 나머지(속도·닿는 시점·모자란 돈)는 정산 데이터로 앱이 계산한다.
--
-- 모양: {"amount": 180000000, "targetYm": "2029-03", "name": "…",
--        "role1": "…", "role2": "…", "reason": "…", "createdYm": "2026-09"}

alter table public.households add column if not exists goal jsonb;

-- 확인용 — goal 한 줄이 나오면 성공
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'households' and column_name = 'goal';
