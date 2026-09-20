-- 소비 기록에 '공동' 표시를 남길 칸.
--
-- 부부 공동 생활비처럼 한 사람 것으로 가를 수 없는 지출이 있다.
-- member_no는 그대로 '적은 사람'을 담고(정산은 사람별이라 누군가의 몫으로는 잡혀야 한다),
-- 이 칸은 화면에서 '공동' 이름표를 달고 사람별 보기에서 따로 빼는 데 쓴다.

alter table public.confessions add column if not exists shared boolean not null default false;

-- 확인용 — shared 한 줄이 나오면 성공
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'confessions' and column_name = 'shared';
