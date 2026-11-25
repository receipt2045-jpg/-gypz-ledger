-- push-dispatch를 5분마다 부른다 (2026-11-04, 푸시 2단계).
-- 순서: push.sql 실행 → 함수 배포·시크릿 설정 → 아래 Vault 한 줄 → 이 파일 실행.
--
-- 비밀 헤더 값은 Vault에 둔다. 이 파일에는 값을 적지 않는다.
-- SQL Editor에서 값만 바꿔 한 번 실행(PUSH_CRON_SECRET 시크릿과 같은 값):
--   select vault.create_secret('<PUSH_CRON_SECRET과 같은 값>', 'push_cron_secret');
-- 값을 바꿀 때: select vault.update_secret(id, '<새 값>') from vault.secrets where name = 'push_cron_secret';
--
-- 여러 번 실행해도 괜찮다.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'push-dispatch';

select cron.schedule(
  'push-dispatch',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://sygmpteafxlrhfbipkep.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);

-- 확인: select jobname, schedule, active from cron.job where jobname = 'push-dispatch';
-- 결과의 status_code가 401이면 원인은 둘 중 하나다:
--   1) Vault의 push_cron_secret이 없거나 함수 시크릿(PUSH_CRON_SECRET)과 값이 다르다.
--   2) 함수를 Verify JWT를 켠 채로 다시 배포했다(크론은 JWT 없이 부른다). supabase/config.toml의 verify_jwt = false로 배포하거나 대시보드에서 끈다.
-- 크론 실행 기록: select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- 최근 결과: select status_code, content from net._http_response order by created desc limit 5;
