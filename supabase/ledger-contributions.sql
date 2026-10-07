-- 각자 공동통장으로 보내는 돈 (2026-10-07, 예산 표의 '공동' 칸)
-- {"1": 2000000, "2": 1500000} 처럼 원 단위. 비어 있으면 공동통장을 안 쓰는 달.
-- 여러 번 실행해도 괜찮다.
alter table public.ledgers
  add column if not exists contributions jsonb;
