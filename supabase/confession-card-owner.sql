-- 고백에 '누구 카드로 썼는지'를 남긴다.
--
-- 연말정산 카드 공제는 명의자 기준으로 각각 계산된다. 지금은 사용자가
-- 카드값을 손으로 입력해야 추천이 되는데, 매일 남기는 고백에 카드 주인이
-- 붙으면 실제 사용액이 저절로 쌓인다.
--
-- 기존 행은 null로 남는다(그때는 안 물어봤으니 모르는 게 맞다).
alter table public.confessions
  add column if not exists card_owner smallint
  check (card_owner is null or card_owner in (1, 2));
