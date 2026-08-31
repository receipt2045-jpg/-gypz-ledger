-- 고백을 배우자 몫으로도 적을 수 있게 한다.
--
-- 원래는 '내 번호로만' 쓰도록 막아 뒀다(배우자 이름을 도용해 고백을 남기는 걸 막으려고).
-- 그런데 실제로 쓰는 집을 보면 한 사람이 부부 지출을 몰아서 적는다.
-- 남편이 카톡으로 "오늘 3만원 썼어" 하면 아내가 대신 넣는 식이다.
-- 그걸 막고 있었으니 그 집들은 남편 지출을 아내 지출로 적을 수밖에 없었다.
--
-- 그래서 '같은 가구 사람인지'만 확인한다 — ledgers/snapshots과 같은 기준이다.
-- 부부는 어차피 서로의 가계부를 다 고칠 수 있으므로 새로 열리는 위험은 없다.

drop policy if exists "confessions_insert" on public.confessions;
create policy "confessions_insert" on public.confessions
  for insert with check (public.is_member(household_id));

drop policy if exists "confessions_update" on public.confessions;
create policy "confessions_update" on public.confessions
  for update using (public.is_member(household_id))
  with check (public.is_member(household_id));

drop policy if exists "confessions_delete" on public.confessions;
create policy "confessions_delete" on public.confessions
  for delete using (public.is_member(household_id));

-- 확인용 — insert/update/delete 세 줄이 is_member만 보고 있으면 성공
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'confessions'
order by policyname;
