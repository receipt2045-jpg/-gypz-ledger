-- ============================================================
-- 고정비 또래 비교 — 모아불리를 쓰는 부부들 사이에서 우리집 위치
--
-- 통계청 대신 우리 사용자를 쓰는 이유:
--   같은 앱·같은 카테고리·전부 부부라 정의가 어긋나지 않는다.
--   통계청이 공표하지 않는 '보험료'도 여기선 정확히 나온다.
--
-- 프라이버시:
--   남의 금액은 한 건도 밖으로 나가지 않는다. 서버에서 분포만 계산해
--   중간값과 순위만 돌려준다. 표본이 적으면 통계값을 null로 비우고
--   표본 수만 준다 (몇 집 안 되는 상태에서 중간값을 주면 역추적된다).
--
-- 표본 단계:
--   n < 20  → 잠금 (표본 수만, "N집 더 모이면 열려요")
--   n < 50  → 3단계만 (많은 편 / 보통 / 적은 편) — 없는 정밀도를 꾸며내지 않는다
--   n >= 50 → 정확한 백분위
-- ============================================================

create or replace function public.fixed_cost_benchmark()
returns table (
  category text,
  n integer,
  my_amount numeric,
  median_amount numeric,
  rank_pct integer,
  band text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select household_id from public.household_members where user_id = auth.uid()
  ),
  -- 가구마다 가장 최근 달 하나만 (오래 쓴 집이 여러 번 세어지지 않게)
  base as (
    select distinct on (l.household_id) l.household_id, l.items, l.closed
      from public.ledgers l
     where jsonb_array_length(l.items) > 0
     order by l.household_id, l.ym desc
  ),
  flat as (
    select b.household_id,
           e->>'group'    as grp,
           e->>'category' as cat,
           case when b.closed then (e->>'actual')::numeric
                else (e->>'planned')::numeric end as amt
      from base b, jsonb_array_elements(b.items) e
  ),
  inc as (
    select household_id, sum(amt) as income from flat where grp = 'income' group by 1
  ),
  fx as (
    select household_id, cat, sum(amt) as amount from flat where grp = 'fixed' group by 1, 2
  ),
  -- 수입 대비 비율로 비교한다. 금액만 보면 많이 버는 집이 무조건 과소비로 보인다.
  joined as (
    select fx.household_id, fx.cat, fx.amount, fx.amount / i.income as ratio
      from fx join inc i using (household_id)
     where i.income > 0 and fx.amount > 0
  ),
  agg as (
    select cat,
           count(*)::int as n,
           percentile_cont(0.5) within group (order by amount) as median_amount,
           percentile_cont(0.5) within group (order by ratio)  as median_ratio
      from joined group by cat
  ),
  mine as (
    select j.cat, j.amount, j.ratio
      from joined j join me on me.household_id = j.household_id
  )
  select a.cat,
         a.n,
         m.amount,
         case when a.n >= 20 then a.median_amount end,
         case when a.n >= 50 then (
           select ((count(*) + 1) * 100 / (a.n + 1))::int
             from joined j2
            where j2.cat = a.cat and j2.ratio > m.ratio
         ) end,
         case when a.n >= 20 then
           case when m.ratio > a.median_ratio * 1.2 then 'high'
                when m.ratio < a.median_ratio * 0.8 then 'low'
                else 'mid' end
         end
    from agg a
    join mine m on m.cat = a.cat;
$$;

revoke all on function public.fixed_cost_benchmark() from public;
revoke all on function public.fixed_cost_benchmark() from anon;
grant execute on function public.fixed_cost_benchmark() to authenticated;
