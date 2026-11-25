-- 집밥 플래너 '우리집 식비 기준' (2026-11-26)
-- 한 주 집밥 돈·한 번 장볼 때·장 보는 간격·배달 날·메인 고기·못 먹는 재료를 집(households)에 저장한다.
-- 이 칸이 있어야 남편·아내 폰에서 같은 기준이 보인다. 없으면 앱은 그 폰에만 저장한다.
-- 쓰기·읽기 권한은 households의 기존 정책(우리집 구성원만)을 그대로 따른다.
alter table public.households add column if not exists meal_plan jsonb;
