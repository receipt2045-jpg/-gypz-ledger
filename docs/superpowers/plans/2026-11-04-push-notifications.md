# 푸시 알림(2단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 안드로이드 앱(moabuli.app 1.2.0, versionCode 3)이 기록 리마인더·정산·오늘의 경제·공지·홍보 알림을 규칙대로 한 번씩 받고, 사람마다 종류별로 켜고 끄며, 결영이 관리자 화면에서 공지·홍보를 보내거나 예약한다.

**Architecture:** 앱은 `@capacitor/push-notifications`로 FCM 토큰을 받아 Supabase `push_tokens`에 등록한다. pg_cron이 5분마다 Edge Function `push-dispatch`를 비밀 헤더로 부르고, 함수는 DB에서 재료를 모아 순수 함수 `supabase/functions/_shared/pushRules.ts`에 "지금 보낼 것"을 묻고, `push_log`(유일 키)에 먼저 적은 것만 `_shared/fcm.ts`로 FCM HTTP v1에 보낸다. 웹 코드는 `pushSupported()`(= `isNative()` + 플러그인 있음)일 때만 푸시 코드를 실행한다.

**Tech Stack:** Vite + React 18 + TS, Supabase JS v2 (Postgres RLS, RPC, pg_cron, pg_net, Vault), Supabase Edge Functions(Deno), FCM HTTP v1(서비스 계정 OAuth, WebCrypto RS256), Capacitor 8 + `@capacitor/push-notifications` 8.x, vitest + jsdom(공유 코드 테스트는 node 환경).

## Global Constraints

- 설계 문서(기준): `docs/superpowers/specs/2026-11-04-push-notifications-design.md`
- 패키지명 `moabuli.app`, versionName `1.2.0`, versionCode `3`. Firebase 프로젝트는 기존 GCP 프로젝트 `striped-century-502904-r5`에 추가. Supabase 프로젝트 `sygmpteafxlrhfbipkep`.
- **웹 동작은 바뀌지 않는다.** `isNative()`가 false면 모든 푸시 코드는 아무것도 하지 않는다. 웹에서 보이는 변화는 설정 > 알림의 "알림은 모아불리 앱에서 받을 수 있어요" 한 줄뿐. 플러그인이 없는 1.1.0 앱이 새 웹을 불러와도 `pushSupported()`가 false라 죽지 않는다.
- 이 레포는 다른 세션도 동시에 커밋한다 → 커밋은 항상 `git add <내 파일들>` 후 `git commit -m "…" -- <내 파일들>`로 경로를 지정한다. `git push`는 하지 않는다(배포는 Task 8에서 결영 확인 후).
- `npm run build`(= tsc + eslint + vitest + vite build)가 통과해야 커밋한다.
- 앱 문구는 결영 말투: 짧고 정돈된 존댓말, 잠언체·AI 톤 금지. 설계 문서의 문구를 그대로 쓴다.
- 시크릿(`FIREBASE_SERVICE_ACCOUNT`, `PUSH_CRON_SECRET`)은 Supabase Secrets(크론 쪽은 Vault)에만 둔다. **레포·대화·로그에 값을 쓰거나 출력하지 않는다.** 서비스 계정 키 파일은 레포 밖에 둔다. `android/app/google-services.json`은 공개 설정값이라 레포에 넣는다.
- 모든 시각은 한국 시간(Asia/Seoul, UTC+9 고정, 서머타임 없음). 서버·규칙 코드는 `kstParts`/`kstInstant`로만 날짜를 계산하고 `getHours()` 같은 로컬 시간대 함수를 쓰지 않는다.
- 광고(홍보) 알림 규칙(정보통신망법 제50조): 사전 동의(체크박스 기본 해제) · 제목 앞에 `(광고) ` · 본문 끝에 `\n수신 거부: 설정 > 알림` · 한국 시간 21:00~07:59 발송 금지(08:00~20:59에만, 시간 밖이면 다음 08:00으로 미룸) · 동의·철회 즉시 처리 결과 안내("2026년 11월 4일 수신 동의(거부)가 처리됐어요") · 기준일(`max(promo_consent_at, promo_reconfirm_sent_at)`) + 23개월 뒤 재확인 알림(그래서 2년마다).
- 안드로이드 빌드는 항상 `npm run android:release`(`android/BUILD.md`). gradlew를 직접 부르지 않는다.
- `supabase/functions/_shared/*`는 Deno와 vitest·앱이 같이 쓴다 → Deno 전용 import(`npm:`, `jsr:`, `Deno.*`) 금지, 상대 import는 `.ts` 확장자까지 쓴다.

## 설계에서 열어 둔 것 — 이렇게 정함

1. **리마인더 시각 선택**: 30분 단위 48칸(00:00~23:30), 기본 21:00. DB에 check로 강제한다.
2. **"오늘 기록이 있음"**: `confessions`에서 `household_id = 그 집`, `member_no = 본인 번호`, `created_at`이 한국 시간 오늘 00:00 이상 내일 00:00 미만인 행이 하나라도 있으면(0원 무지출 기록 포함). 배우자 몫으로 대신 적어 준 기록은 배우자 기록으로 친다(member_no 기준).
3. **3일 뒤 다시**: "오늘 − 3일"이 정산일인지로 판단 → 2월 28일 정산일이면 3월 3일에 간다. 대상 달은 그 정산일 기준.
4. **오늘의 경제 글이 여러 개**: `news`를 `market`보다 먼저, 같은 종류면 먼저 올린 글.
5. **토큰 등록**: 클라이언트가 직접 insert하지 않고 RPC `register_push_token`(security definer) — 같은 폰에 다른 계정이 로그인하면 토큰 주인을 바꿔야 해서. 로그아웃·탈퇴 때 `forget_push_token`으로 지운다.
6. **[지금 보내기]**: `send_at = now()`로 캠페인을 저장하고 다음 크론 실행(5분 안)에서 보낸다. 밤에 홍보를 [지금 보내기] 하면 08:00 실행에서 간다(안내 문구로 알림).
7. **"○명에게 보내요"**: RPC `push_audience_count(kind)` — 토큰이 있는 사람 중 공지는 `news_on`, 홍보는 `promo_on`.
8. **[설정 열기]**: 폰 설정 화면을 여는 플러그인을 더하지 않는다. 버튼은 [알림 켜기](권한 다시 요청)이고, 폰에서 막혀 있으면 "폰 설정 > 애플리케이션 > 모아불리 > 알림에서 켜 주세요"를 보여 준다. (결영 확인 필요 — 원하면 3단계에서 플러그인 추가)
9. **재확인 문구 날짜**: `2024년 12월 4일`처럼 네 자리 연도.
10. **앱이 켜져 있을 때 온 알림**: 안드로이드 FCM 기본대로 알림 줄에 안 뜬다. 이번엔 그대로 둔다.
11. **캠페인 보낸 수·실패 수**: 사람 기준(폰이 여러 대면 하나라도 성공하면 보냄 1).
12. `push_log` 오래된 행 정리는 이번에 안 한다.

## File Structure

| 파일 | 책임 |
|---|---|
| `supabase/push.sql` (신규) | 테이블 4개, RLS, RPC 3개(`register_push_token`, `forget_push_token`, `push_audience_count`) |
| `supabase/push-cron.sql` (신규) | pg_cron + pg_net 5분 예약(비밀 헤더는 Vault에서). 함수 배포 뒤 Task 8에서 실행 |
| `supabase/functions/_shared/pushRules.ts` (신규) | 보내는 규칙(순수 함수) + 한국 시간 도우미 + 광고 문구 |
| `supabase/functions/_shared/pushRules.test.ts` (신규) | 규칙 단위 테스트 |
| `supabase/functions/_shared/fcm.ts` (신규) | 서비스 계정 OAuth(JWT RS256), FCM v1 페이로드·발송, 무효 토큰 판별 |
| `supabase/functions/_shared/fcm.test.ts` (신규) | fetch mock 테스트 |
| `supabase/functions/push-dispatch/index.ts` (신규) | DB 재료 모으기 → `planPushes` → 기록 후 발송 → 무효 토큰 삭제 → 캠페인 마감 |
| `tsconfig.json` (수정) | `supabase/functions/_shared`도 tsc 검사 |
| `src/lib/pushPrefs.ts` (신규) | 알림 설정·토큰 DB 함수, 처음 안내 7일 규칙, 동의 안내 문구, 시각 칸 |
| `src/lib/pushPrefs.test.ts` (신규) | |
| `src/lib/pushNative.ts` (신규) | Capacitor 플러그인: 채널·리스너, 권한, 토큰 등록, 알림 누르면 화면 이동 |
| `src/lib/pushNative.test.ts` (신규) | |
| `src/components/PushAskSheet.tsx` (신규) | 홈의 처음 안내 바텀시트 |
| `src/components/PushAskSheet.screen.test.tsx` (신규) | |
| `src/components/NotificationSettings.tsx` (신규) | 설정 > 알림 |
| `src/components/NotificationSettings.screen.test.tsx` (신규) | |
| `src/lib/pushAdmin.ts` (신규) | 캠페인 DB 함수, 광고 미리보기, 예약 시각 검사 |
| `src/lib/pushAdmin.test.ts` (신규) | |
| `src/pages/AdminPush.tsx` (신규) | 관리자 > 알림 보내기 |
| `src/pages/AdminPush.screen.test.tsx` (신규) | |
| `src/main.tsx`, `src/App.tsx`, `src/pages/Home.tsx`, `src/pages/Settings.tsx`, `src/pages/AdminPosts.tsx` (수정) | 연결 |
| `src/pages/Legal.tsx`, `public/privacy.html` (수정) + `src/pages/Legal.privacy.test.tsx` (신규) | 개인정보처리방침 |
| `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle`, `android/app/src/main/res/drawable/ic_stat_moabuli.xml`(신규), `scripts/android-release.sh`, `android/BUILD.md` (수정) | 권한·아이콘·채널·버전·빌드 검사 |
| `android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle` (cap sync가 수정) | 플러그인 등록 |

---

### Task 1: DB — 테이블·RLS·RPC, 크론 예약 SQL

**Files:**
- Create: `supabase/push.sql`, `supabase/push-cron.sql`

**Interfaces:**
- Produces (뒤 Task들이 이 이름을 그대로 쓴다):
  - 테이블 `push_tokens(token pk, user_id, platform, updated_at)`, `notification_prefs(user_id pk, reminder_on, reminder_time, settle_on, news_on, promo_on, promo_consent_at, promo_reconfirm_sent_at, updated_at)`, `push_log(user_id, kind, ref_key, sent_at, unique(user_id,kind,ref_key))`, `push_campaigns(id, kind, title, body, path, send_at, status, sent_count, fail_count, created_at)`
  - RPC `register_push_token(p_token text, p_platform text default 'android') returns void`
  - RPC `forget_push_token(p_token text) returns void`
  - RPC `push_audience_count(p_kind text) returns integer` (운영자만)
  - 크론 잡 이름 `push-dispatch`, 헤더 `x-push-secret`, Vault 시크릿 이름 `push_cron_secret`

이 Task는 SQL을 쓰기만 한다. 실행은 Task 8(컨트롤러·결영)에서 한다.

- [ ] **Step 1: `supabase/push.sql` 작성**

```sql
-- 푸시 알림 (2026-11-04, 설계: docs/superpowers/specs/2026-11-04-push-notifications-design.md)
-- 읽기·쓰기: 본인 행만 · 발송(push-dispatch)은 service_role · 캠페인은 운영자 계정만.
-- 크론 예약은 push-cron.sql에 따로 있다(함수 배포 뒤 실행).
-- 여러 번 실행해도 괜찮다.

-- 1) 폰 토큰 — 한 사람이 폰 여러 대면 여러 행
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android' check (platform in ('android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens (user_id);

-- 2) 알림 설정 — 행이 없으면 아직 알림을 켜지 않은 사람
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reminder_on boolean not null default true,
  reminder_time time not null default '21:00',
  settle_on boolean not null default true,
  news_on boolean not null default true,
  promo_on boolean not null default false,
  promo_consent_at timestamptz,
  promo_reconfirm_sent_at timestamptz,
  updated_at timestamptz not null default now()
);
-- 리마인더 시각은 30분 단위만
alter table public.notification_prefs drop constraint if exists notification_prefs_time_step;
alter table public.notification_prefs
  add constraint notification_prefs_time_step
  check (extract(second from reminder_time) = 0 and extract(minute from reminder_time) in (0, 30));

-- 3) 보낸 기록 — 중복 방지와 "3일 뒤 다시" 판단용. 사람 기준 1건
create table if not exists public.push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reminder', 'settle', 'settle_again', 'news', 'notice', 'promo', 'promo_reconfirm')),
  ref_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, ref_key)
);
create index if not exists push_log_sent on public.push_log (sent_at desc);

-- 4) 운영자가 쓰는 공지·홍보
create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notice', 'promo')),
  title text not null check (char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 300),
  path text not null default '/' check (path ~ '^/([^/].*)?$'),
  send_at timestamptz not null default now(),
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'canceled')),
  sent_count int not null default 0,
  fail_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists push_campaigns_due on public.push_campaigns (status, send_at);

-- ── RLS ──
alter table public.push_tokens enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_log enable row level security;
alter table public.push_campaigns enable row level security;

-- 토큰: 본인 것만 보고 지운다. 넣기·바꾸기는 register_push_token()으로만
drop policy if exists "push_tokens own read" on public.push_tokens;
create policy "push_tokens own read" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "push_tokens own delete" on public.push_tokens;
create policy "push_tokens own delete" on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "notification_prefs own" on public.notification_prefs;
create policy "notification_prefs own" on public.notification_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_log own read" on public.push_log;
create policy "push_log own read" on public.push_log
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_campaigns admin" on public.push_campaigns;
create policy "push_campaigns admin" on public.push_campaigns
  for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'receipt2045@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'receipt2045@gmail.com');

-- ── RPC ──
-- 같은 폰에 다른 계정이 로그인하면 토큰 주인을 바꾼다(RLS로는 남의 행을 못 바꿔서 security definer)
create or replace function public.register_push_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 4096 then
    raise exception '알림 토큰이 올바르지 않아요';
  end if;
  insert into push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- 로그아웃·탈퇴 때 이 폰 토큰을 지운다
create or replace function public.forget_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_tokens where token = p_token and user_id = auth.uid();
$$;

-- 관리자 "○명에게 보내요" — 토큰이 있는 사람 중 공지는 news_on, 홍보는 promo_on
create or replace function public.push_audience_count(p_kind text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'receipt2045@gmail.com' then
    raise exception '운영자만 볼 수 있어요';
  end if;
  return (
    select count(distinct t.user_id)::int
    from push_tokens t
    join notification_prefs p on p.user_id = t.user_id
    where case p_kind when 'notice' then p.news_on when 'promo' then p.promo_on else false end
  );
end;
$$;

revoke all on function public.register_push_token(text, text) from public;
revoke all on function public.forget_push_token(text) from public;
revoke all on function public.push_audience_count(text) from public;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.forget_push_token(text) to authenticated;
grant execute on function public.push_audience_count(text) to authenticated;
```

- [ ] **Step 2: `supabase/push-cron.sql` 작성**

```sql
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
-- 최근 결과: select status_code, content from net._http_response order by created desc limit 5;
```

- [ ] **Step 3: 정적 확인**

Run: `grep -c "create policy" supabase/push.sql; grep -c "drop policy if exists" supabase/push.sql`
Expected: 두 숫자가 같다(6, 6) — 다시 실행해도 정책이 겹치지 않는다.
Run: `grep -nE "secret'|create_secret\('[^<]" supabase/push-cron.sql`
Expected: 주석의 자리표시자(`<…>`)만 나오고 실제 값은 없다.

- [ ] **Step 4: 빌드 확인 후 커밋**

Run: `npm run build`
Expected: 통과(SQL만 추가라 변화 없음)

```bash
git add supabase/push.sql supabase/push-cron.sql
git commit -m "푸시 알림 DB: 토큰·설정·보낸 기록·캠페인 테이블, RLS, 등록·대상 수 함수, 5분 크론 SQL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- supabase/push.sql supabase/push-cron.sql
```

---

### Task 2: 보내는 규칙 (순수 함수)

**Files:**
- Create: `supabase/functions/_shared/pushRules.ts`, `supabase/functions/_shared/pushRules.test.ts`
- Modify: `tsconfig.json` (`include`)

**Interfaces:**
- Produces (Task 3·4·5·6이 쓴다):
  - `type PushKind = 'reminder' | 'settle' | 'settle_again' | 'news' | 'notice' | 'promo' | 'promo_reconfirm'`
  - `interface PushPrefs { userId; reminderOn; reminderTime: string; settleOn; newsOn; promoOn; promoConsentAt: string | null; promoReconfirmSentAt: string | null }`
  - `interface PushMember { householdId: string; memberNo: 1 | 2; monthStartDay: number }`
  - `interface TodayPost { id; kind: 'news' | 'market'; title; createdAt }`
  - `interface DueCampaign { id; kind: 'notice' | 'promo'; title; body; path; sendAt }`
  - `interface PushInput { now: Date; prefs: PushPrefs[]; members: Record<string, PushMember>; confessedToday: Set<string>; closedLedgers: Set<string>; todayPosts: TodayPost[]; campaigns: DueCampaign[]; sentLog: Set<string> }`
  - `interface PlannedPush { userId; kind: PushKind; refKey; title; body; path; campaignId?: string }`, `interface PushPlan { sends: PlannedPush[]; campaignsDone: string[] }`
  - `planPushes(input: PushInput): PushPlan`
  - `logKey(userId, kind, refKey): string` → `${userId}|${kind}|${refKey}`
  - `kstParts(now: Date): { date: 'YYYY-MM-DD'; ym: 'YYYY-MM'; year; month; day; hour; minute }`
  - `kstInstant(date: string, hhmm: string): number` (UTC ms), `shiftDate(date, days): string`, `shiftYm(ym, delta): string`
  - `inWindow(now: Date, target: number): boolean`, `promoHourOk(now: Date): boolean`
  - `promoText(title, body): { title; body }`, `PROMO_PREFIX`, `PROMO_FOOTER`
  - `koreanDate(iso: string): string` → `'2026년 11월 4일'`(KST)
  - `addMonthsKst(iso, months): number`, `settleTargetOn(date, monthStartDay): string | null`
  - 키 모양: `confessedToday`는 `${householdId}:${memberNo}`, `closedLedgers`는 `${householdId}:${ym}`

- [ ] **Step 1: tsc가 공유 코드도 보게 한다** — `tsconfig.json`의 `"include": ["src"]`를 바꾼다:

```json
  "include": ["src", "supabase/functions/_shared"],
```

(vitest는 기본 include `**/*.test.ts`라 따로 설정할 것이 없다. 아래 테스트 파일 맨 위 `// @vitest-environment node`로 jsdom 대신 node에서 돈다.)

- [ ] **Step 2: 실패하는 테스트 작성** — `supabase/functions/_shared/pushRules.test.ts`

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  addMonthsKst,
  inWindow,
  kstInstant,
  kstParts,
  koreanDate,
  logKey,
  planPushes,
  promoHourOk,
  promoText,
  settleTargetOn,
  shiftDate,
  type DueCampaign,
  type PushInput,
  type PushPrefs,
} from './pushRules.ts'

const at = (iso: string) => new Date(iso)

function pref(userId: string, o: Partial<PushPrefs> = {}): PushPrefs {
  return {
    userId,
    reminderOn: true,
    reminderTime: '21:00:00',
    settleOn: true,
    newsOn: true,
    promoOn: false,
    promoConsentAt: null,
    promoReconfirmSentAt: null,
    ...o,
  }
}

function input(o: Partial<PushInput> & { now: Date }): PushInput {
  return {
    prefs: [pref('u1')],
    members: { u1: { householdId: 'h1', memberNo: 1, monthStartDay: 1 } },
    confessedToday: new Set(),
    closedLedgers: new Set(),
    todayPosts: [],
    campaigns: [],
    sentLog: new Set(),
    ...o,
  }
}

const kinds = (i: PushInput) => planPushes(i).sends.map((s) => `${s.userId}:${s.kind}:${s.refKey}`)

describe('한국 시간 도우미', () => {
  it('UTC 23:30은 한국 다음 날 08:30', () => {
    expect(kstParts(at('2026-11-04T23:30:00Z'))).toMatchObject({
      date: '2026-11-05',
      ym: '2026-11',
      day: 5,
      hour: 8,
      minute: 30,
    })
  })
  it('kstInstant는 한국 시각을 UTC로', () => {
    expect(new Date(kstInstant('2026-11-05', '09:30')).toISOString()).toBe('2026-11-05T00:30:00.000Z')
  })
  it('shiftDate는 달·해를 넘긴다', () => {
    expect(shiftDate('2026-03-03', -3)).toBe('2026-02-28')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('5분 창: now-5분 < t ≤ now', () => {
    const now = at('2026-11-04T21:00:00+09:00')
    const t = now.getTime()
    expect(inWindow(now, t)).toBe(true)
    expect(inWindow(now, t - 4 * 60_000 - 59_000)).toBe(true)
    expect(inWindow(now, t - 5 * 60_000)).toBe(false)
    expect(inWindow(now, t + 1000)).toBe(false)
  })
  it('광고 가능 시간은 08:00~20:59', () => {
    expect(promoHourOk(at('2026-11-04T07:59:00+09:00'))).toBe(false)
    expect(promoHourOk(at('2026-11-04T08:00:00+09:00'))).toBe(true)
    expect(promoHourOk(at('2026-11-04T20:59:00+09:00'))).toBe(true)
    expect(promoHourOk(at('2026-11-04T21:00:00+09:00'))).toBe(false)
  })
  it('koreanDate는 한국 날짜로 쓴다', () => {
    expect(koreanDate('2026-11-04T15:30:00Z')).toBe('2026년 11월 5일')
  })
  it('addMonthsKst는 한국 달력으로 더한다', () => {
    expect(new Date(addMonthsKst('2024-12-04T10:00:00+09:00', 23)).toISOString()).toBe(
      new Date('2026-11-04T10:00:00+09:00').toISOString(),
    )
  })
  it('promoText는 (광고)와 수신 거부 안내를 붙인다', () => {
    expect(promoText('연말 특강', '자리 남았어요')).toEqual({
      title: '(광고) 연말 특강',
      body: '자리 남았어요\n수신 거부: 설정 > 알림',
    })
  })
})

describe('정산일', () => {
  it('시작일 1이면 1일, 대상은 앞 달', () => {
    expect(settleTargetOn('2026-11-01', 1)).toBe('2026-10')
    expect(settleTargetOn('2026-11-02', 1)).toBeNull()
  })
  it('시작일 25면 25일, 대상은 앞 달', () => {
    expect(settleTargetOn('2026-11-25', 25)).toBe('2026-10')
    expect(settleTargetOn('2026-11-24', 25)).toBeNull()
  })
  it('1월 1일 정산일이면 대상은 지난해 12월', () => {
    expect(settleTargetOn('2027-01-01', 1)).toBe('2026-12')
  })
  it('시작일이 이상한 값이면 1로 본다', () => {
    expect(settleTargetOn('2026-11-01', 0)).toBe('2026-10')
    expect(settleTargetOn('2026-11-01', 31)).toBe('2026-10')
  })
})

describe('reminder', () => {
  const now = at('2026-11-04T21:00:30+09:00')
  it('시각 창 안이고 오늘 기록이 없으면 보낸다', () => {
    const plan = planPushes(input({ now }))
    expect(plan.sends).toEqual([
      {
        userId: 'u1',
        kind: 'reminder',
        refKey: '2026-11-04',
        title: '오늘 기록할 시간이에요',
        body: '쓴 돈 30초면 남겨요.',
        path: '/confess',
      },
    ])
  })
  it('오늘 내 기록이 있으면 안 보낸다', () => {
    expect(kinds(input({ now, confessedToday: new Set(['h1:1']) }))).toEqual([])
  })
  it('배우자 기록만 있으면 나는 받는다', () => {
    expect(kinds(input({ now, confessedToday: new Set(['h1:2']) }))).toEqual(['u1:reminder:2026-11-04'])
  })
  it('창을 놓치면(5분 30초 뒤) 안 보낸다', () => {
    expect(kinds(input({ now: at('2026-11-04T21:05:30+09:00') }))).toEqual([])
  })
  it('사람마다 시각이 다르다', () => {
    const i = input({ now: at('2026-11-04T07:30:10+09:00'), prefs: [pref('u1', { reminderTime: '07:30' })] })
    expect(kinds(i)).toEqual(['u1:reminder:2026-11-04'])
  })
  it('끈 사람, 집이 없는 사람은 안 받는다', () => {
    expect(kinds(input({ now, prefs: [pref('u1', { reminderOn: false })] }))).toEqual([])
    expect(kinds(input({ now, members: {} }))).toEqual([])
  })
  it('이미 보냈으면 다시 안 보낸다', () => {
    const sentLog = new Set([logKey('u1', 'reminder', '2026-11-04')])
    expect(kinds(input({ now, sentLog }))).toEqual([])
  })
})

describe('settle / settle_again', () => {
  const off = { reminderOn: false }
  it('정산일 20:00 창에 부부 둘 다 받는다', () => {
    const i = input({
      now: at('2026-11-01T20:00:20+09:00'),
      prefs: [pref('u1', off), pref('u2', off)],
      members: {
        u1: { householdId: 'h1', memberNo: 1, monthStartDay: 1 },
        u2: { householdId: 'h1', memberNo: 2, monthStartDay: 1 },
      },
    })
    const plan = planPushes(i)
    expect(plan.sends.map((s) => `${s.userId}:${s.kind}:${s.refKey}`)).toEqual([
      'u1:settle:2026-10:settle',
      'u2:settle:2026-10:settle',
    ])
    expect(plan.sends[0]).toMatchObject({ title: '이번 달 정산할 날이에요', body: '한 달 돈 흐름, 같이 맞춰봐요.', path: '/monthly' })
  })
  it('시작일 25인 집은 25일에', () => {
    const members = { u1: { householdId: 'h1', memberNo: 1 as const, monthStartDay: 25 } }
    expect(kinds(input({ now: at('2026-11-25T20:01:00+09:00'), prefs: [pref('u1', off)], members }))).toEqual([
      'u1:settle:2026-10:settle',
    ])
    expect(kinds(input({ now: at('2026-11-24T20:01:00+09:00'), prefs: [pref('u1', off)], members }))).toEqual([])
  })
  it('19:59, 20:05엔 안 보낸다', () => {
    expect(kinds(input({ now: at('2026-11-01T19:59:00+09:00'), prefs: [pref('u1', off)] }))).toEqual([])
    expect(kinds(input({ now: at('2026-11-01T20:05:00+09:00'), prefs: [pref('u1', off)] }))).toEqual([])
  })
  it('정산을 마쳤으면 안 보낸다', () => {
    const i = input({ now: at('2026-11-01T20:00:20+09:00'), prefs: [pref('u1', off)], closedLedgers: new Set(['h1:2026-10']) })
    expect(kinds(i)).toEqual([])
  })
  it('settle_on을 끈 사람은 안 받는다', () => {
    expect(kinds(input({ now: at('2026-11-01T20:00:20+09:00'), prefs: [pref('u1', { ...off, settleOn: false })] }))).toEqual([])
  })
  it('3일 뒤 20:00, 첫 알림을 보냈고 아직 안 했으면 다시', () => {
    const i = input({
      now: at('2026-11-04T20:00:00+09:00'),
      prefs: [pref('u1', off)],
      sentLog: new Set([logKey('u1', 'settle', '2026-10:settle')]),
    })
    const plan = planPushes(i)
    expect(plan.sends).toEqual([
      { userId: 'u1', kind: 'settle_again', refKey: '2026-10:again', title: '정산이 아직이에요', body: '5분이면 끝나요.', path: '/monthly' },
    ])
  })
  it('첫 알림이 없었으면 3일 뒤에도 안 보낸다', () => {
    expect(kinds(input({ now: at('2026-11-04T20:00:00+09:00'), prefs: [pref('u1', off)] }))).toEqual([])
  })
  it('3일 사이에 정산했으면 안 보낸다', () => {
    const i = input({
      now: at('2026-11-04T20:00:00+09:00'),
      prefs: [pref('u1', off)],
      sentLog: new Set([logKey('u1', 'settle', '2026-10:settle')]),
      closedLedgers: new Set(['h1:2026-10']),
    })
    expect(kinds(i)).toEqual([])
  })
  it('월말: 시작일 28이면 2월 28일 정산, 3월 3일 다시', () => {
    const members = { u1: { householdId: 'h1', memberNo: 1 as const, monthStartDay: 28 } }
    expect(kinds(input({ now: at('2026-02-28T20:00:10+09:00'), prefs: [pref('u1', off)], members }))).toEqual([
      'u1:settle:2026-01:settle',
    ])
    const again = input({
      now: at('2026-03-03T20:00:10+09:00'),
      prefs: [pref('u1', off)],
      members,
      sentLog: new Set([logKey('u1', 'settle', '2026-01:settle')]),
    })
    expect(kinds(again)).toEqual(['u1:settle_again:2026-01:again'])
  })
})

describe('news', () => {
  const now = at('2026-11-04T08:00:10+09:00')
  const posts = [
    { id: 'm1', kind: 'market' as const, title: '미국 증시 마감 정리', createdAt: '2026-11-03T22:00:00Z' },
    { id: 'n2', kind: 'news' as const, title: '오늘 볼 뉴스 둘', createdAt: '2026-11-03T22:40:00Z' },
    { id: 'n1', kind: 'news' as const, title: '금리 동결, 대출은?', createdAt: '2026-11-03T22:30:00Z' },
  ]
  it('08:00 창에 오늘 글 제목으로 보낸다 (news 먼저, 먼저 올린 글)', () => {
    const plan = planPushes(input({ now, prefs: [pref('u1', { reminderOn: false })], todayPosts: posts }))
    expect(plan.sends).toEqual([
      { userId: 'u1', kind: 'news', refKey: '2026-11-04', title: '오늘의 경제', body: '금리 동결, 대출은?', path: '/info/n1' },
    ])
  })
  it('news가 없으면 market 글', () => {
    const plan = planPushes(input({ now, todayPosts: [posts[0]] }))
    expect(plan.sends[0]).toMatchObject({ body: '미국 증시 마감 정리', path: '/info/m1' })
  })
  it('오늘 글이 없거나, 끈 사람, 07:59엔 안 보낸다', () => {
    expect(kinds(input({ now }))).toEqual([])
    expect(kinds(input({ now, todayPosts: posts, prefs: [pref('u1', { newsOn: false })] }))).toEqual([])
    expect(kinds(input({ now: at('2026-11-04T07:59:00+09:00'), todayPosts: posts }))).toEqual([])
  })
})

describe('notice / promo 캠페인', () => {
  const notice: DueCampaign = { id: 'c1', kind: 'notice', title: '새 기능', body: '정산이 쉬워졌어요', path: '/monthly', sendAt: '2026-11-04T13:58:00+09:00' }
  const promo: DueCampaign = { id: 'c2', kind: 'promo', title: '연말 특강', body: '자리 남았어요', path: '/consult', sendAt: '2026-11-04T13:58:00+09:00' }
  const people = [pref('u1', { reminderOn: false }), pref('u2', { reminderOn: false, newsOn: false, promoOn: true })]

  it('공지는 send_at 이후 첫 실행에 news_on인 사람에게', () => {
    const plan = planPushes(input({ now: at('2026-11-04T14:00:00+09:00'), prefs: people, campaigns: [notice] }))
    expect(plan.sends).toEqual([
      { userId: 'u1', kind: 'notice', refKey: 'campaign:c1', title: '새 기능', body: '정산이 쉬워졌어요', path: '/monthly', campaignId: 'c1' },
    ])
    expect(plan.campaignsDone).toEqual(['c1'])
  })
  it('공지는 밤에도 간다', () => {
    const plan = planPushes(input({ now: at('2026-11-04T22:00:00+09:00'), prefs: people, campaigns: [notice] }))
    expect(plan.campaignsDone).toEqual(['c1'])
  })
  it('send_at 전이면 아무것도 안 한다', () => {
    const plan = planPushes(input({ now: at('2026-11-04T13:50:00+09:00'), prefs: people, campaigns: [notice] }))
    expect(plan).toEqual({ sends: [], campaignsDone: [] })
  })
  it('홍보는 promo_on인 사람에게 (광고)·수신 거부를 붙여서', () => {
    const plan = planPushes(input({ now: at('2026-11-04T14:00:00+09:00'), prefs: people, campaigns: [promo] }))
    expect(plan.sends).toEqual([
      {
        userId: 'u2',
        kind: 'promo',
        refKey: 'campaign:c2',
        title: '(광고) 연말 특강',
        body: '자리 남았어요\n수신 거부: 설정 > 알림',
        path: '/consult',
        campaignId: 'c2',
      },
    ])
    expect(plan.campaignsDone).toEqual(['c2'])
  })
  it('홍보는 21~08시면 미룬다 (안 보내고 마감도 안 함)', () => {
    for (const t of ['2026-11-04T21:10:00+09:00', '2026-11-05T07:55:00+09:00']) {
      expect(planPushes(input({ now: at(t), prefs: people, campaigns: [promo] }))).toEqual({ sends: [], campaignsDone: [] })
    }
    expect(planPushes(input({ now: at('2026-11-05T08:00:05+09:00'), prefs: people, campaigns: [promo] })).campaignsDone).toEqual(['c2'])
  })
  it('받을 사람이 없어도 캠페인은 마감한다', () => {
    const plan = planPushes(input({ now: at('2026-11-04T14:00:00+09:00'), prefs: [pref('u3', { newsOn: false })], campaigns: [notice] }))
    expect(plan).toEqual({ sends: [], campaignsDone: ['c1'] })
  })
  it('이미 보낸 사람은 건너뛴다', () => {
    const plan = planPushes(
      input({ now: at('2026-11-04T14:00:00+09:00'), prefs: people, campaigns: [notice], sentLog: new Set([logKey('u1', 'notice', 'campaign:c1')]) }),
    )
    expect(plan.sends).toEqual([])
  })
})

describe('promo_reconfirm (2년마다 동의 재확인)', () => {
  const p = pref('u1', { reminderOn: false, promoOn: true, promoConsentAt: '2024-12-04T10:00:00+09:00' })
  it('동의 후 23개월이 지난 첫 실행(광고 가능 시간)에 보낸다', () => {
    const plan = planPushes(input({ now: at('2026-11-04T10:00:00+09:00'), prefs: [p] }))
    expect(plan.sends).toEqual([
      {
        userId: 'u1',
        kind: 'promo_reconfirm',
        refKey: 'reconfirm:2026-11',
        title: '소식·혜택 알림, 계속 받으시겠어요?',
        body: '2024년 12월 4일에 동의하셨어요. 그만 받으려면 설정 > 알림에서 꺼 주세요.',
        path: '/settings',
      },
    ])
  })
  it('23개월 전이면 안 보낸다', () => {
    expect(kinds(input({ now: at('2026-11-04T09:55:00+09:00'), prefs: [p] }))).toEqual([])
  })
  it('밤이면 다음 날 아침으로 미룬다', () => {
    expect(kinds(input({ now: at('2026-11-04T22:00:00+09:00'), prefs: [p] }))).toEqual([])
    expect(kinds(input({ now: at('2026-11-05T08:00:00+09:00'), prefs: [p] }))).toEqual(['u1:promo_reconfirm:reconfirm:2026-11'])
  })
  it('재확인을 보낸 뒤엔 그때부터 다시 23개월', () => {
    const sent = { ...p, promoReconfirmSentAt: '2026-11-04T10:00:00+09:00' }
    expect(kinds(input({ now: at('2026-12-01T10:00:00+09:00'), prefs: [sent] }))).toEqual([])
    expect(kinds(input({ now: at('2028-10-04T10:00:00+09:00'), prefs: [sent] }))).toEqual(['u1:promo_reconfirm:reconfirm:2028-10'])
  })
  it('광고를 끈 사람, 동의 기록이 없는 사람은 안 받는다', () => {
    expect(kinds(input({ now: at('2026-11-04T10:00:00+09:00'), prefs: [{ ...p, promoOn: false }] }))).toEqual([])
    expect(kinds(input({ now: at('2026-11-04T10:00:00+09:00'), prefs: [{ ...p, promoConsentAt: null }] }))).toEqual([])
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run supabase/functions/_shared/pushRules.test.ts`
Expected: FAIL — `Failed to resolve import "./pushRules.ts"` (파일이 잡혀 돈다는 것도 확인)

- [ ] **Step 4: 구현** — `supabase/functions/_shared/pushRules.ts`

```ts
/**
 * 푸시 알림 보내는 규칙 (2026-11-04, 설계: docs/superpowers/specs/2026-11-04-push-notifications-design.md)
 *
 * "지금 누구에게 무엇을 보낼지"만 정한다. DB·FCM은 모른다.
 * push-dispatch(Deno), 앱(관리자 미리보기·동의 안내), vitest가 같이 쓴다 → Deno 전용 import 금지.
 * 모든 시각은 한국 시간(UTC+9, 서머타임 없음). getHours() 같은 로컬 시간대 함수는 쓰지 않는다.
 */

export type PushKind =
  | 'reminder'
  | 'settle'
  | 'settle_again'
  | 'news'
  | 'notice'
  | 'promo'
  | 'promo_reconfirm'

export interface PushPrefs {
  userId: string
  reminderOn: boolean
  /** 'HH:MM' 또는 DB 그대로 'HH:MM:SS' */
  reminderTime: string
  settleOn: boolean
  newsOn: boolean
  promoOn: boolean
  promoConsentAt: string | null
  promoReconfirmSentAt: string | null
}

export interface PushMember {
  householdId: string
  memberNo: 1 | 2
  /** households.month_start_day (1~28) */
  monthStartDay: number
}

export interface TodayPost {
  id: string
  kind: 'news' | 'market'
  title: string
  createdAt: string
}

export interface DueCampaign {
  id: string
  kind: 'notice' | 'promo'
  title: string
  body: string
  path: string
  sendAt: string
}

export interface PushInput {
  now: Date
  /** 토큰이 하나라도 있는 사람의 설정만 */
  prefs: PushPrefs[]
  /** userId → 집. 집이 없으면 리마인더·정산은 안 보낸다 */
  members: Record<string, PushMember>
  /** 오늘(KST) 기록이 있는 `${householdId}:${memberNo}` */
  confessedToday: Set<string>
  /** 정산을 마친(closed=true) `${householdId}:${ym}` */
  closedLedgers: Set<string>
  /** 오늘(KST) post_date인 news·market 글 */
  todayPosts: TodayPost[]
  /** status='scheduled'이고 send_at이 지난 캠페인 */
  campaigns: DueCampaign[]
  /** push_log에 이미 있는 logKey(userId, kind, refKey) */
  sentLog: Set<string>
}

export interface PlannedPush {
  userId: string
  kind: PushKind
  refKey: string
  title: string
  body: string
  path: string
  campaignId?: string
}

export interface PushPlan {
  sends: PlannedPush[]
  /** 이번 실행에서 마감할 캠페인(받을 사람이 0명이어도). 광고 시간 밖이면 빠진다 */
  campaignsDone: string[]
}

const KST_MS = 9 * 60 * 60 * 1000
const WINDOW_MS = 5 * 60 * 1000
const p2 = (n: number) => String(n).padStart(2, '0')

export const PROMO_PREFIX = '(광고) '
export const PROMO_FOOTER = '\n수신 거부: 설정 > 알림'

const FIXED = {
  reminder: { title: '오늘 기록할 시간이에요', body: '쓴 돈 30초면 남겨요.', path: '/confess' },
  settle: { title: '이번 달 정산할 날이에요', body: '한 달 돈 흐름, 같이 맞춰봐요.', path: '/monthly' },
  settle_again: { title: '정산이 아직이에요', body: '5분이면 끝나요.', path: '/monthly' },
} as const

export const logKey = (userId: string, kind: PushKind, refKey: string) => `${userId}|${kind}|${refKey}`

export interface KstParts {
  date: string
  ym: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

export function kstParts(now: Date): KstParts {
  const k = new Date(now.getTime() + KST_MS)
  const year = k.getUTCFullYear()
  const month = k.getUTCMonth() + 1
  const day = k.getUTCDate()
  return {
    year,
    month,
    day,
    hour: k.getUTCHours(),
    minute: k.getUTCMinutes(),
    ym: `${year}-${p2(month)}`,
    date: `${year}-${p2(month)}-${p2(day)}`,
  }
}

/** 한국 날짜 'YYYY-MM-DD'의 'HH:MM' → UTC ms */
export function kstInstant(date: string, hhmm: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm) - KST_MS
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`
}

/** src/lib/format.ts의 shiftYm과 같다 (Deno가 src를 못 읽어 따로 둔다) */
export function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const base = y * 12 + (m - 1) + delta
  return `${Math.floor(base / 12)}-${p2((base % 12) + 1)}`
}

/** 5분 창: now-5분 < target ≤ now. 창을 놓친 알림은 보내지 않는다(늦은 알림보다 안 보내는 게 낫다) */
export function inWindow(now: Date, target: number): boolean {
  const t = now.getTime()
  return t - WINDOW_MS < target && target <= t
}

/** 광고는 08:00~20:59에만 (정보통신망법: 21시~다음 날 8시 금지) */
export function promoHourOk(now: Date): boolean {
  const h = kstParts(now).hour
  return h >= 8 && h <= 20
}

export function promoText(title: string, body: string): { title: string; body: string } {
  return { title: PROMO_PREFIX + title, body: body + PROMO_FOOTER }
}

/** '2026년 11월 4일' (한국 날짜) */
export function koreanDate(iso: string): string {
  const k = kstParts(new Date(iso))
  return `${k.year}년 ${k.month}월 ${k.day}일`
}

/** 한국 달력으로 n달 뒤 같은 시각 (UTC ms) */
export function addMonthsKst(iso: string, months: number): number {
  const k = new Date(Date.parse(iso) + KST_MS)
  k.setUTCMonth(k.getUTCMonth() + months)
  return k.getTime() - KST_MS
}

/** format.ts setMonthStartDay와 같은 규칙: 1~28이 아니면 1 */
const startDayOf = (d: number) => (d >= 1 && d <= 28 ? Math.floor(d) : 1)

/**
 * 그날이 정산일이면 정산 대상 달, 아니면 null.
 * 시작일 d인 집은 매달 d일에 새 달이 시작되고(ymOfDate), 끝난 앞 달이 정산 대상이다.
 */
export function settleTargetOn(date: string, monthStartDay: number): string | null {
  if (Number(date.slice(8, 10)) !== startDayOf(monthStartDay)) return null
  return shiftYm(date.slice(0, 7), -1)
}

/** news를 market보다 먼저, 같은 종류면 먼저 올린 글 */
function pickNews(posts: TodayPost[]): TodayPost | null {
  const sorted = [...posts].sort((a, b) =>
    a.kind === b.kind ? a.createdAt.localeCompare(b.createdAt) : a.kind === 'news' ? -1 : 1,
  )
  return sorted[0] ?? null
}

export function planPushes(input: PushInput): PushPlan {
  const { now } = input
  const today = kstParts(now)
  const sends: PlannedPush[] = []
  const add = (p: PlannedPush) => {
    if (!input.sentLog.has(logKey(p.userId, p.kind, p.refKey))) sends.push(p)
  }

  const news = pickNews(input.todayPosts)
  const newsDue = inWindow(now, kstInstant(today.date, '08:00'))
  const settleDue = inWindow(now, kstInstant(today.date, '20:00'))
  const promoOk = promoHourOk(now)

  for (const pref of input.prefs) {
    const userId = pref.userId
    const m = input.members[userId]

    if (
      pref.reminderOn &&
      m &&
      inWindow(now, kstInstant(today.date, pref.reminderTime.slice(0, 5))) &&
      !input.confessedToday.has(`${m.householdId}:${m.memberNo}`)
    ) {
      add({ userId, kind: 'reminder', refKey: today.date, ...FIXED.reminder })
    }

    if (pref.settleOn && m && settleDue) {
      const ym = settleTargetOn(today.date, m.monthStartDay)
      if (ym && !input.closedLedgers.has(`${m.householdId}:${ym}`)) {
        add({ userId, kind: 'settle', refKey: `${ym}:settle`, ...FIXED.settle })
      }
      const ymAgain = settleTargetOn(shiftDate(today.date, -3), m.monthStartDay)
      if (
        ymAgain &&
        !input.closedLedgers.has(`${m.householdId}:${ymAgain}`) &&
        input.sentLog.has(logKey(userId, 'settle', `${ymAgain}:settle`))
      ) {
        add({ userId, kind: 'settle_again', refKey: `${ymAgain}:again`, ...FIXED.settle_again })
      }
    }

    if (pref.newsOn && news && newsDue) {
      add({ userId, kind: 'news', refKey: today.date, title: '오늘의 경제', body: news.title, path: `/info/${news.id}` })
    }

    if (pref.promoOn && pref.promoConsentAt && promoOk) {
      const base = Math.max(
        ...[pref.promoConsentAt, pref.promoReconfirmSentAt].filter((v): v is string => !!v).map(Date.parse),
      )
      if (now.getTime() >= addMonthsKst(new Date(base).toISOString(), 23)) {
        add({
          userId,
          kind: 'promo_reconfirm',
          refKey: `reconfirm:${today.ym}`,
          title: '소식·혜택 알림, 계속 받으시겠어요?',
          body: `${koreanDate(pref.promoConsentAt)}에 동의하셨어요. 그만 받으려면 설정 > 알림에서 꺼 주세요.`,
          path: '/settings',
        })
      }
    }
  }

  const campaignsDone: string[] = []
  for (const c of input.campaigns) {
    if (Date.parse(c.sendAt) > now.getTime()) continue
    if (c.kind === 'promo' && !promoOk) continue // 다음 08:00 실행으로 미룬다
    campaignsDone.push(c.id)
    const text = c.kind === 'promo' ? promoText(c.title, c.body) : { title: c.title, body: c.body }
    for (const pref of input.prefs) {
      if (c.kind === 'notice' ? !pref.newsOn : !pref.promoOn) continue
      add({ userId: pref.userId, kind: c.kind, refKey: `campaign:${c.id}`, ...text, path: c.path, campaignId: c.id })
    }
  }

  return { sends, campaignsDone }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run supabase/functions/_shared/pushRules.test.ts`
Expected: PASS (전부)

- [ ] **Step 6: 빌드 후 커밋**

Run: `npm run build`
Expected: 통과(tsc가 `_shared`도 검사)

```bash
git add tsconfig.json supabase/functions/_shared/pushRules.ts supabase/functions/_shared/pushRules.test.ts
git commit -m "푸시 보내는 규칙(pushRules) — 리마인더·정산·오늘의 경제·공지·광고·재확인, 한국 시간 5분 창

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- tsconfig.json supabase/functions/_shared/pushRules.ts supabase/functions/_shared/pushRules.test.ts
```

---

### Task 3: FCM 발송 + push-dispatch 함수

**Files:**
- Create: `supabase/functions/_shared/fcm.ts`, `supabase/functions/_shared/fcm.test.ts`, `supabase/functions/push-dispatch/index.ts`

**Interfaces:**
- Consumes (Task 2): `planPushes`, `kstParts`, `kstInstant`, `shiftDate`, `shiftYm`, `logKey`, 타입 `DueCampaign`, `PlannedPush`, `PushMember`, `PushPrefs`, `TodayPost`
- Consumes (Task 1): 테이블·열 이름, 헤더 `x-push-secret`
- Produces:
  - `CHANNEL_ID = 'moabuli'`, `SMALL_ICON = 'ic_stat_moabuli'` (Task 4 채널, Task 7 매니페스트·아이콘과 같아야 함)
  - `interface ServiceAccount { project_id; client_email; private_key }`, `interface FcmMessage { title; body; path }`
  - `buildFcmBody(token, m)`, `isInvalidToken(status, json): boolean`, `signJwt(sa, nowSec): Promise<string>`
  - `createFcmSender(sa, fetchFn?, nowSec?): FcmSender` — `send(token, m): Promise<'ok' | 'invalid' | 'error'>`, OAuth 토큰은 한 실행에서 한 번만 받는다
  - `sendToUser(sender, tokens, m): Promise<{ ok: number; errors: number; invalid: string[] }>`
  - Edge Function `push-dispatch` (Verify JWT 끔, `x-push-secret` 검사)

- [ ] **Step 1: 실패하는 테스트 작성** — `supabase/functions/_shared/fcm.test.ts`

```ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { buildFcmBody, createFcmSender, isInvalidToken, sendToUser, signJwt, type ServiceAccount } from './fcm.ts'

async function testAccount(): Promise<{ sa: ServiceAccount; publicKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64')
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`
  return {
    sa: { project_id: 'moabuli-test', client_email: 'push@moabuli-test.iam.gserviceaccount.com', private_key: pem },
    publicKey: pair.publicKey,
  }
}

const b64urlDecode = (s: string) => new Uint8Array(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'))

/** 구글 OAuth와 FCM을 흉내 낸다. fcm(token)이 그 토큰에 대한 응답을 정한다 */
function fakeFetch(fcm: (token: string) => { status: number; json?: unknown }) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }), { status: 200 })
    }
    const token = JSON.parse(String(init?.body)).message.token as string
    const r = fcm(token)
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status })
  })
}

const msg = { title: '오늘 기록할 시간이에요', body: '쓴 돈 30초면 남겨요.', path: '/confess' }
const unregistered = { status: 404, json: { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } } }

describe('buildFcmBody', () => {
  it('알림·이동할 화면·안드로이드 채널을 담는다', () => {
    expect(buildFcmBody('tok', msg)).toEqual({
      message: {
        token: 'tok',
        notification: { title: msg.title, body: msg.body },
        data: { path: '/confess' },
        android: { priority: 'HIGH', notification: { channel_id: 'moabuli', icon: 'ic_stat_moabuli' } },
      },
    })
  })
})

describe('isInvalidToken', () => {
  it('UNREGISTERED·INVALID_ARGUMENT는 지울 토큰', () => {
    expect(isInvalidToken(404, unregistered.json)).toBe(true)
    expect(isInvalidToken(400, { error: { status: 'INVALID_ARGUMENT' } })).toBe(true)
    expect(isInvalidToken(400, { error: { status: 'INVALID_ARGUMENT', details: [{ errorCode: 'INVALID_ARGUMENT' }] } })).toBe(true)
  })
  it('일시 오류는 지우지 않는다', () => {
    expect(isInvalidToken(500, { error: { status: 'INTERNAL' } })).toBe(false)
    expect(isInvalidToken(429, { error: { status: 'RESOURCE_EXHAUSTED' } })).toBe(false)
    expect(isInvalidToken(503, null)).toBe(false)
  })
})

describe('signJwt', () => {
  it('서비스 계정 키로 RS256 서명한 FCM 범위 토큰을 만든다', async () => {
    const { sa, publicKey } = await testAccount()
    const jwt = await signJwt(sa, 1_800_000_000)
    const [h, c, s] = jwt.split('.')
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(h)))).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(c)))).toEqual({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    })
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, b64urlDecode(s), new TextEncoder().encode(`${h}.${c}`))
    expect(ok).toBe(true)
  })
})

describe('createFcmSender / sendToUser', () => {
  it('OAuth 토큰은 한 번만 받고, v1 주소로 Bearer와 함께 보낸다', async () => {
    const { sa } = await testAccount()
    const f = fakeFetch(() => ({ status: 200, json: { name: 'projects/moabuli-test/messages/1' } }))
    const sender = createFcmSender(sa, f)
    expect(await sender.send('tok-a', msg)).toBe('ok')
    expect(await sender.send('tok-b', msg)).toBe('ok')
    const calls = f.mock.calls.map(([url]) => url)
    expect(calls.filter((u) => u === 'https://oauth2.googleapis.com/token')).toHaveLength(1)
    const [url, init] = f.mock.calls[1]
    expect(url).toBe('https://fcm.googleapis.com/v1/projects/moabuli-test/messages:send')
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer ya29.test')
  })

  it('사람의 폰 여러 대: 성공·무효·일시 오류를 나눠 센다', async () => {
    const { sa } = await testAccount()
    const f = fakeFetch((t) => (t === 'gone-token' ? unregistered : t === 'flaky-token' ? { status: 503 } : { status: 200 }))
    const r = await sendToUser(createFcmSender(sa, f), ['good-token', 'gone-token', 'flaky-token'], msg)
    expect(r).toEqual({ ok: 1, errors: 1, invalid: ['gone-token'] })
  })

  it('OAuth가 실패하면 던지지 않고 error', async () => {
    const { sa } = await testAccount()
    const f = vi.fn(async () => new Response('{}', { status: 401 }))
    expect(await createFcmSender(sa, f).send('tok', msg)).toBe('error')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run supabase/functions/_shared/fcm.test.ts`
Expected: FAIL — `Failed to resolve import "./fcm.ts"`

- [ ] **Step 3: 구현** — `supabase/functions/_shared/fcm.ts`

```ts
/**
 * FCM HTTP v1 발송 (2026-11-04, 푸시 2단계).
 * 서비스 계정 JSON(시크릿 FIREBASE_SERVICE_ACCOUNT)으로 OAuth 토큰을 만들어 부른다.
 * Deno(push-dispatch)와 vitest가 같이 쓴다 → Deno 전용 import 금지. fetch·crypto.subtle만 쓴다.
 * 토큰·키 값은 로그에 남기지 않는다.
 */

/** 앱 src/lib/pushNative.ts의 채널, AndroidManifest의 기본 채널과 같아야 한다 */
export const CHANNEL_ID = 'moabuli'
/** android/app/src/main/res/drawable/ic_stat_moabuli.xml */
export const SMALL_ICON = 'ic_stat_moabuli'

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

export interface FcmMessage {
  title: string
  body: string
  path: string
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>
export type SendResult = 'ok' | 'invalid' | 'error'

export interface FcmSender {
  send(token: string, m: FcmMessage): Promise<SendResult>
}

export function buildFcmBody(token: string, m: FcmMessage) {
  return {
    message: {
      token,
      notification: { title: m.title, body: m.body },
      data: { path: m.path },
      android: { priority: 'HIGH', notification: { channel_id: CHANNEL_ID, icon: SMALL_ICON } },
    },
  }
}

/** 지워야 할 토큰(앱 삭제·만료·잘못된 값)인지. 그 외 실패는 일시 오류로 본다 */
export function isInvalidToken(status: number, json: unknown): boolean {
  const err = (json as { error?: { status?: string; details?: { errorCode?: string }[] } } | null)?.error
  const codes = (err?.details ?? []).map((d) => d.errorCode)
  if (codes.includes('UNREGISTERED') || codes.includes('INVALID_ARGUMENT')) return true
  return (status === 404 && err?.status === 'NOT_FOUND') || (status === 400 && err?.status === 'INVALID_ARGUMENT')
}

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): ArrayBuffer {
  const bin = atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}

export async function signJwt(sa: ServiceAccount, nowSec: number): Promise<string> {
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claims = b64url(
    enc.encode(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 })),
  )
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${claims}`)))
  return `${header}.${claims}.${b64url(sig)}`
}

export function createFcmSender(
  sa: ServiceAccount,
  fetchFn: FetchLike = fetch,
  nowSec: () => number = () => Math.floor(Date.now() / 1000),
): FcmSender {
  let access: Promise<string> | null = null

  const getAccess = (): Promise<string> => {
    if (!access) {
      access = (async () => {
        const res = await fetchFn(TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: await signJwt(sa, nowSec()),
          }).toString(),
        })
        if (!res.ok) throw new Error(`google oauth ${res.status}`)
        return ((await res.json()) as { access_token: string }).access_token
      })()
      access.catch(() => {
        access = null // 다음 send에서 다시 시도
      })
    }
    return access
  }

  return {
    async send(token, m) {
      try {
        const res = await fetchFn(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: 'POST',
          headers: { authorization: `Bearer ${await getAccess()}`, 'content-type': 'application/json' },
          body: JSON.stringify(buildFcmBody(token, m)),
        })
        if (res.ok) return 'ok'
        const json = await res.json().catch(() => null)
        return isInvalidToken(res.status, json) ? 'invalid' : 'error'
      } catch {
        return 'error'
      }
    },
  }
}

/** 한 사람의 폰 전부에 보낸다. 일시 오류는 다시 보내지 않는다(중복보다 누락이 낫다) */
export async function sendToUser(
  sender: FcmSender,
  tokens: string[],
  m: FcmMessage,
): Promise<{ ok: number; errors: number; invalid: string[] }> {
  const out = { ok: 0, errors: 0, invalid: [] as string[] }
  for (const t of tokens) {
    const r = await sender.send(t, m)
    if (r === 'ok') out.ok++
    else if (r === 'invalid') out.invalid.push(t)
    else out.errors++
  }
  return out
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run supabase/functions/_shared/fcm.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Edge Function 작성** — `supabase/functions/push-dispatch/index.ts` (Deno, vitest 대상 아님 — 규칙·발송은 위에서 테스트했고, 실제 동작은 Task 8 폰 확인)

```ts
// 푸시 알림 보내기 — Supabase Edge Function (2026-11-04, 설계: docs/superpowers/specs/2026-11-04-push-notifications-design.md)
//
// pg_cron이 5분마다 부른다(supabase/push-cron.sql). 무엇을 보낼지는 _shared/pushRules.ts가 정하고,
// 여기서는 DB에서 재료를 모으고 → push_log에 먼저 적고(유일 키) 들어간 것만 보낸다 → 무효 토큰을 지운다.
// 그래서 두 번 돌아도 한 번만 간다. FCM 일시 오류는 다시 보내지 않는다(중복보다 누락이 낫다).
// 한 종류가 실패해도 다른 종류는 계속 보낸다.
//
// 설정(Secrets): FIREBASE_SERVICE_ACCOUNT(서비스 계정 JSON 전체), PUSH_CRON_SECRET
// 배포할 때 'Verify JWT'는 끈다 — pg_cron은 로그인 토큰 대신 x-push-secret 헤더를 보낸다.
import { createClient } from "npm:@supabase/supabase-js";
import { createFcmSender, sendToUser, type ServiceAccount } from "../_shared/fcm.ts";
import {
  kstInstant,
  kstParts,
  logKey,
  planPushes,
  shiftDate,
  shiftYm,
  type DueCampaign,
  type PlannedPush,
  type PushKind,
  type PushMember,
  type PushPrefs,
  type TodayPost,
} from "../_shared/pushRules.ts";

const SECRET = Deno.env.get("PUSH_CRON_SECRET") ?? "";
const DAY = 24 * 60 * 60 * 1000;

// deno-lint-ignore no-explicit-any
function rows(r: { data: any[] | null; error: unknown }, what: string): any[] {
  if (r.error) throw new Error(`${what}: ${JSON.stringify(r.error)}`);
  return r.data ?? [];
}

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get("x-push-secret") !== SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "");
  } catch {
    console.error("[push-dispatch] FIREBASE_SERVICE_ACCOUNT를 못 읽었어요");
    return Response.json({ ok: false, reason: "no service account" });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();
  const today = kstParts(now);

  try {
    // 1) 토큰이 있는 사람만 대상
    const tokensByUser = new Map<string, string[]>();
    for (const t of rows(await db.from("push_tokens").select("token, user_id"), "push_tokens")) {
      tokensByUser.set(t.user_id, [...(tokensByUser.get(t.user_id) ?? []), t.token]);
    }
    const userIds = [...tokensByUser.keys()];

    const campaigns: DueCampaign[] = rows(
      await db
        .from("push_campaigns")
        .select("id, kind, title, body, path, send_at")
        .eq("status", "scheduled")
        .lte("send_at", now.toISOString()),
      "push_campaigns",
    ).map((c) => ({ id: c.id, kind: c.kind, title: c.title, body: c.body, path: c.path, sendAt: c.send_at }));

    // 2) 설정·집·오늘 기록·정산·보낸 기록
    const prefs: PushPrefs[] = [];
    const members: Record<string, PushMember> = {};
    const confessedToday = new Set<string>();
    const closedLedgers = new Set<string>();
    const sentLog = new Set<string>();

    if (userIds.length) {
      for (const p of rows(await db.from("notification_prefs").select("*").in("user_id", userIds), "notification_prefs")) {
        prefs.push({
          userId: p.user_id,
          reminderOn: p.reminder_on,
          reminderTime: String(p.reminder_time),
          settleOn: p.settle_on,
          newsOn: p.news_on,
          promoOn: p.promo_on,
          promoConsentAt: p.promo_consent_at,
          promoReconfirmSentAt: p.promo_reconfirm_sent_at,
        });
      }

      const memberRows = rows(
        await db.from("household_members").select("user_id, household_id, member_no").in("user_id", userIds),
        "household_members",
      );
      const hids = [...new Set(memberRows.map((m) => m.household_id as string))];
      const startDay = new Map<string, number>();
      if (hids.length) {
        for (const h of rows(await db.from("households").select("id, month_start_day").in("id", hids), "households")) {
          startDay.set(h.id, h.month_start_day ?? 1);
        }
        // 오늘(한국) 00:00 ~ 내일 00:00 사이에 그 사람 번호로 남은 기록
        const dayStart = new Date(kstInstant(today.date, "00:00")).toISOString();
        const dayEnd = new Date(kstInstant(shiftDate(today.date, 1), "00:00")).toISOString();
        for (const c of rows(
          await db
            .from("confessions")
            .select("household_id, member_no")
            .in("household_id", hids)
            .gte("created_at", dayStart)
            .lt("created_at", dayEnd),
          "confessions",
        )) {
          confessedToday.add(`${c.household_id}:${c.member_no}`);
        }
        // 정산 대상 달은 앞 달(오늘 정산일) 또는 앞앞 달(3일 전이 지난달 말 정산일)
        for (const l of rows(
          await db
            .from("ledgers")
            .select("household_id, ym")
            .in("household_id", hids)
            .in("ym", [shiftYm(today.ym, -1), shiftYm(today.ym, -2)])
            .eq("closed", true),
          "ledgers",
        )) {
          closedLedgers.add(`${l.household_id}:${l.ym}`);
        }
      }
      for (const m of memberRows) {
        members[m.user_id] = {
          householdId: m.household_id,
          memberNo: m.member_no,
          monthStartDay: startDay.get(m.household_id) ?? 1,
        };
      }

      for (const l of rows(
        await db
          .from("push_log")
          .select("user_id, kind, ref_key")
          .in("user_id", userIds)
          .gte("sent_at", new Date(now.getTime() - 40 * DAY).toISOString()),
        "push_log",
      )) {
        sentLog.add(logKey(l.user_id, l.kind, l.ref_key));
      }
    }

    const todayPosts: TodayPost[] = rows(
      await db.from("posts").select("id, kind, title, created_at").eq("post_date", today.date).in("kind", ["news", "market"]),
      "posts",
    ).map((p) => ({ id: p.id, kind: p.kind, title: p.title, createdAt: p.created_at }));

    // 3) 규칙 → 보내기 (종류별 try)
    const plan = planPushes({ now, prefs, members, confessedToday, closedLedgers, todayPosts, campaigns, sentLog });
    const sender = createFcmSender(sa);
    const byKind = new Map<PushKind, PlannedPush[]>();
    for (const p of plan.sends) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p]);

    const stats = new Map<string, { sent: number; fail: number }>();
    const summary: Record<string, number> = {};
    for (const [kind, list] of byKind) {
      try {
        for (const p of list) {
          const logged = rows(
            await db
              .from("push_log")
              .upsert(
                { user_id: p.userId, kind: p.kind, ref_key: p.refKey },
                { onConflict: "user_id,kind,ref_key", ignoreDuplicates: true },
              )
              .select("user_id"),
            "push_log insert",
          );
          if (!logged.length) continue; // 다른 실행이 이미 보냈다

          const r = await sendToUser(sender, tokensByUser.get(p.userId) ?? [], p);
          if (r.invalid.length) await db.from("push_tokens").delete().in("token", r.invalid);
          const ok = r.ok > 0;
          if (ok) summary[kind] = (summary[kind] ?? 0) + 1;
          if (p.campaignId) {
            const s = stats.get(p.campaignId) ?? { sent: 0, fail: 0 };
            if (ok) s.sent++;
            else s.fail++;
            stats.set(p.campaignId, s);
          }
          if (p.kind === "promo_reconfirm" && ok) {
            await db.from("notification_prefs").update({ promo_reconfirm_sent_at: now.toISOString() }).eq("user_id", p.userId);
          }
        }
      } catch (err) {
        console.error(`[push-dispatch] ${kind}`, err);
      }
    }

    // 4) 캠페인 마감 (받을 사람이 0명이어도)
    for (const id of plan.campaignsDone) {
      const s = stats.get(id) ?? { sent: 0, fail: 0 };
      await db
        .from("push_campaigns")
        .update({ status: "sent", sent_count: s.sent, fail_count: s.fail })
        .eq("id", id)
        .eq("status", "scheduled");
    }

    return Response.json({ ok: true, sent: summary, campaigns: plan.campaignsDone.length });
  } catch (err) {
    console.error("[push-dispatch]", err);
    return Response.json({ ok: false });
  }
});
```

- [ ] **Step 6: 빌드 후 커밋**

Run: `npm run build`
Expected: 통과 (index.ts는 tsc 대상 밖 — `_shared`만 검사)

```bash
git add supabase/functions/_shared/fcm.ts supabase/functions/_shared/fcm.test.ts supabase/functions/push-dispatch/index.ts
git commit -m "푸시 발송: FCM v1(서비스 계정 OAuth)·무효 토큰 삭제, 5분마다 도는 push-dispatch 함수

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- supabase/functions/_shared/fcm.ts supabase/functions/_shared/fcm.test.ts supabase/functions/push-dispatch/index.ts
```

---

### Task 4: 앱 — 플러그인, 토큰 등록, 알림 누르면 이동, 처음 안내

**Files:**
- Create: `src/lib/pushPrefs.ts`, `src/lib/pushPrefs.test.ts`, `src/lib/pushNative.ts`, `src/lib/pushNative.test.ts`, `src/components/PushAskSheet.tsx`, `src/components/PushAskSheet.screen.test.tsx`
- Modify: `package.json`, `package-lock.json`, `src/main.tsx`, `src/App.tsx` (`onSignedIn`), `src/pages/Home.tsx`, `android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle` (cap sync)

**Interfaces:**
- Consumes (Task 1): RPC `register_push_token`, `forget_push_token`, 테이블 `notification_prefs`
- Consumes (Task 2): `koreanDate` (`../../supabase/functions/_shared/pushRules.ts`)
- Produces (Task 5·6이 쓴다):
  - `pushPrefs.ts`: `interface NotificationPrefs { reminderOn; reminderTime: 'HH:MM'; settleOn; newsOn; promoOn; promoConsentAt: string | null }`, `type PrefsPatch = Partial<Pick<NotificationPrefs, 'reminderOn' | 'reminderTime' | 'settleOn' | 'newsOn'>>`, `DEFAULT_REMINDER_TIME = '21:00'`, `TIME_SLOTS: string[]`(48칸), `shouldAskPush(askedAt: string | null, now: Date): boolean`, `readAskedAt(): string | null`, `markAsked(now: Date): void`, `consentNotice(on: boolean, at: Date): string`, `firstConsentText(at: Date): string`, `fetchPrefs(): Promise<NotificationPrefs | null>`, `createPrefs(promo: boolean, now: Date): Promise<NotificationPrefs>`, `updatePrefs(patch: PrefsPatch): Promise<void>`, `setPromo(on: boolean, now: Date): Promise<void>`, `registerToken(token: string): Promise<void>`, `forgetToken(token: string): Promise<void>`
  - `pushNative.ts`: `CHANNEL_ID = 'moabuli'`, `type PushPermission = 'granted' | 'denied' | 'prompt'`, `pushSupported(): boolean`, `safePath(p: unknown): string | null`, `openFromNotification(data: unknown): void`, `installPush(): void`, `pushPermission(): Promise<PushPermission>`, `askPushPermission(): Promise<boolean>`, `startPush(): Promise<void>`, `syncPushToken(userId: string): Promise<void>`, `forgetPushToken(): Promise<void>`
  - `PushAskSheet` (default export, props 없음)

- [ ] **Step 1: 플러그인 설치 + cap sync**

```bash
npm i @capacitor/push-notifications@^8.0.0
npx cap sync android
```
Expected: `package.json`에 `@capacitor/push-notifications` 8.x, sync 로그에 `@capacitor/push-notifications` 포함. `git diff --stat android/`에 `capacitor.settings.gradle`, `app/capacitor.build.gradle`이 바뀐다. 설치된 정확한 버전을 커밋 메시지에 적는다.

- [ ] **Step 2: 실패하는 테스트 작성** — `src/lib/pushPrefs.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const eq = vi.fn(async () => ({ error: null }))
  return {
    eq,
    update: vi.fn(() => ({ eq })),
    upsert: vi.fn(async () => ({ error: null })),
    rpc: vi.fn(async () => ({ error: null })),
  }
})
vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
    from: vi.fn(() => ({ update: h.update, upsert: h.upsert })),
    rpc: h.rpc,
  },
}))

import {
  TIME_SLOTS,
  consentNotice,
  createPrefs,
  firstConsentText,
  markAsked,
  readAskedAt,
  registerToken,
  setPromo,
  shouldAskPush,
} from './pushPrefs'

beforeEach(() => localStorage.clear())

describe('처음 안내 7일 규칙', () => {
  const now = new Date('2026-11-10T12:00:00+09:00')
  it('물어본 적 없으면 묻는다', () => expect(shouldAskPush(null, now)).toBe(true))
  it('3일 전에 물었으면 안 묻는다', () => expect(shouldAskPush('2026-11-07T12:00:00+09:00', now)).toBe(false))
  it('7일이 지나면 다시 묻는다', () => expect(shouldAskPush('2026-11-03T12:00:00+09:00', now)).toBe(true))
  it('기록을 남기고 읽는다', () => {
    markAsked(now)
    expect(readAskedAt()).toBe(now.toISOString())
  })
})

describe('동의 안내 문구 (한국 날짜)', () => {
  const at = new Date('2026-11-04T15:30:00Z') // 한국 11월 5일 00:30
  it('처리 결과 안내', () => {
    expect(consentNotice(true, at)).toBe('2026년 11월 5일 수신 동의가 처리됐어요')
    expect(consentNotice(false, at)).toBe('2026년 11월 5일 수신 거부가 처리됐어요')
  })
  it('처음 안내에서 동의', () => {
    expect(firstConsentText(at)).toBe('11월 5일 소식·혜택 알림 수신에 동의하셨어요')
  })
})

describe('TIME_SLOTS', () => {
  it('30분 단위 48칸', () => {
    expect(TIME_SLOTS).toHaveLength(48)
    expect(TIME_SLOTS.slice(0, 3)).toEqual(['00:00', '00:30', '01:00'])
    expect(TIME_SLOTS).toContain('21:00')
    expect(TIME_SLOTS.at(-1)).toBe('23:30')
  })
})

describe('DB', () => {
  const now = new Date('2026-11-04T10:00:00+09:00')
  it('처음 켤 때 기본값으로 만든다 (광고는 체크했을 때만 동의 시각과 함께)', async () => {
    const p = await createPrefs(true, now)
    expect(p).toEqual({
      reminderOn: true,
      reminderTime: '21:00',
      settleOn: true,
      newsOn: true,
      promoOn: true,
      promoConsentAt: now.toISOString(),
    })
    expect(h.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', promo_on: true, promo_consent_at: now.toISOString(), promo_reconfirm_sent_at: null }),
    )
    const off = await createPrefs(false, now)
    expect(off.promoConsentAt).toBeNull()
  })
  it('광고 켜기는 동의 시각을 새로 남기고 재확인 기록을 지운다', async () => {
    await setPromo(true, now)
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({ promo_on: true, promo_consent_at: now.toISOString(), promo_reconfirm_sent_at: null }),
    )
    await setPromo(false, now)
    expect(h.update).toHaveBeenLastCalledWith(expect.objectContaining({ promo_on: false }))
    expect(h.eq).toHaveBeenCalledWith('user_id', 'u1')
  })
  it('토큰은 RPC로 등록한다', async () => {
    await registerToken('tok-123')
    expect(h.rpc).toHaveBeenCalledWith('register_push_token', { p_token: 'tok-123', p_platform: 'android' })
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/pushPrefs.test.ts`
Expected: FAIL — `Failed to resolve import "./pushPrefs"`

- [ ] **Step 4: 구현** — `src/lib/pushPrefs.ts`

```ts
/**
 * 알림 설정·토큰을 DB에 두는 곳 (2026-11-04, 푸시 2단계). 테이블: supabase/push.sql
 * 화면은 이 함수들만 부른다. 폰(Capacitor) 쪽은 pushNative.ts.
 */
import { supabase } from './supabase'
import { koreanDate } from '../../supabase/functions/_shared/pushRules.ts'

export interface NotificationPrefs {
  reminderOn: boolean
  /** 'HH:MM' */
  reminderTime: string
  settleOn: boolean
  newsOn: boolean
  promoOn: boolean
  promoConsentAt: string | null
}

export type PrefsPatch = Partial<Pick<NotificationPrefs, 'reminderOn' | 'reminderTime' | 'settleOn' | 'newsOn'>>

export const DEFAULT_REMINDER_TIME = '21:00'

/** 리마인더 시각 — 30분 단위 (DB check와 같다) */
export const TIME_SLOTS: string[] = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
)

// ── 처음 안내: [나중에]·권한 거부면 7일 동안 다시 안 띄운다 ──
const ASKED_KEY = 'pushAskedAt'
const ASK_AGAIN_MS = 7 * 24 * 60 * 60 * 1000

export function shouldAskPush(askedAt: string | null, now: Date): boolean {
  if (!askedAt) return true
  const t = Date.parse(askedAt)
  return Number.isNaN(t) || now.getTime() - t >= ASK_AGAIN_MS
}

export function readAskedAt(): string | null {
  try {
    return localStorage.getItem(ASKED_KEY)
  } catch {
    return null
  }
}

export function markAsked(now: Date): void {
  try {
    localStorage.setItem(ASKED_KEY, now.toISOString())
  } catch {
    // 시크릿 모드 등 — 다음에 또 물어도 괜찮다
  }
}

// ── 광고 알림 동의·철회 처리 결과 안내 (정보통신망법 제50조) ──
export function consentNotice(on: boolean, at: Date): string {
  return `${koreanDate(at.toISOString())} 수신 ${on ? '동의' : '거부'}가 처리됐어요`
}

export function firstConsentText(at: Date): string {
  return `${koreanDate(at.toISOString()).replace(/^\d+년 /, '')} 소식·혜택 알림 수신에 동의하셨어요`
}

// ── DB ──
async function myId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const uid = data.user?.id
  if (!uid) throw new Error('로그인이 필요해요')
  return uid
}

interface PrefsRow {
  reminder_on: boolean
  reminder_time: string
  settle_on: boolean
  news_on: boolean
  promo_on: boolean
  promo_consent_at: string | null
}

const fromRow = (r: PrefsRow): NotificationPrefs => ({
  reminderOn: r.reminder_on,
  reminderTime: String(r.reminder_time).slice(0, 5),
  settleOn: r.settle_on,
  newsOn: r.news_on,
  promoOn: r.promo_on,
  promoConsentAt: r.promo_consent_at,
})

/** 내 알림 설정. 없으면 null(아직 알림을 켜지 않은 사람) */
export async function fetchPrefs(): Promise<NotificationPrefs | null> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return null
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('reminder_on, reminder_time, settle_on, news_on, promo_on, promo_consent_at')
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data as PrefsRow) : null
}

/** 처음 알림을 켤 때 — 기본값으로 만든다. 광고는 체크했을 때만 동의 시각과 함께 */
export async function createPrefs(promo: boolean, now: Date): Promise<NotificationPrefs> {
  const uid = await myId()
  const prefs: NotificationPrefs = {
    reminderOn: true,
    reminderTime: DEFAULT_REMINDER_TIME,
    settleOn: true,
    newsOn: true,
    promoOn: promo,
    promoConsentAt: promo ? now.toISOString() : null,
  }
  const { error } = await supabase.from('notification_prefs').upsert({
    user_id: uid,
    reminder_on: prefs.reminderOn,
    reminder_time: prefs.reminderTime,
    settle_on: prefs.settleOn,
    news_on: prefs.newsOn,
    promo_on: prefs.promoOn,
    promo_consent_at: prefs.promoConsentAt,
    promo_reconfirm_sent_at: null,
    updated_at: now.toISOString(),
  })
  if (error) throw error
  return prefs
}

export async function updatePrefs(patch: PrefsPatch): Promise<void> {
  const uid = await myId()
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.reminderOn !== undefined) row.reminder_on = patch.reminderOn
  if (patch.reminderTime !== undefined) row.reminder_time = patch.reminderTime
  if (patch.settleOn !== undefined) row.settle_on = patch.settleOn
  if (patch.newsOn !== undefined) row.news_on = patch.newsOn
  const { error } = await supabase.from('notification_prefs').update(row).eq('user_id', uid)
  if (error) throw error
}

/** 광고 알림 켜기·끄기. 켤 때마다 동의 시각을 새로 남긴다(2년 재확인 기준일) */
export async function setPromo(on: boolean, now: Date): Promise<void> {
  const uid = await myId()
  const row = on
    ? { promo_on: true, promo_consent_at: now.toISOString(), promo_reconfirm_sent_at: null, updated_at: now.toISOString() }
    : { promo_on: false, updated_at: now.toISOString() }
  const { error } = await supabase.from('notification_prefs').update(row).eq('user_id', uid)
  if (error) throw error
}

export async function registerToken(token: string): Promise<void> {
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: 'android' })
  if (error) throw error
}

export async function forgetToken(token: string): Promise<void> {
  const { error } = await supabase.rpc('forget_push_token', { p_token: token })
  if (error) throw error
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/pushPrefs.test.ts`
Expected: PASS

- [ ] **Step 6: 실패하는 테스트 작성** — `src/lib/pushNative.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  native: false,
  plugin: true,
  handlers: {} as Record<string, (e: unknown) => void>,
  addListener: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  register: vi.fn(),
  createChannel: vi.fn(),
  registerToken: vi.fn(),
  forgetToken: vi.fn(),
  fetchPrefs: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => h.native, isPluginAvailable: () => h.plugin },
}))
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    addListener: (name: string, fn: (e: unknown) => void) => {
      h.handlers[name] = fn
      h.addListener(name)
      return Promise.resolve({ remove: async () => {} })
    },
    checkPermissions: () => h.checkPermissions(),
    requestPermissions: () => h.requestPermissions(),
    register: () => h.register(),
    createChannel: (o: unknown) => h.createChannel(o),
  },
}))
vi.mock('./pushPrefs', () => ({
  registerToken: (t: string) => h.registerToken(t),
  forgetToken: (t: string) => h.forgetToken(t),
  fetchPrefs: () => h.fetchPrefs(),
}))

async function load() {
  vi.resetModules()
  return import('./pushNative')
}

beforeEach(() => {
  h.native = false
  h.plugin = true
  h.handlers = {}
  h.checkPermissions.mockResolvedValue({ receive: 'granted' })
  h.requestPermissions.mockResolvedValue({ receive: 'granted' })
  h.register.mockResolvedValue(undefined)
  h.createChannel.mockResolvedValue(undefined)
  h.registerToken.mockResolvedValue(undefined)
  h.forgetToken.mockResolvedValue(undefined)
  h.fetchPrefs.mockResolvedValue({ reminderOn: true })
  localStorage.clear()
  window.location.hash = ''
})

describe('웹에서는 아무것도 안 한다', () => {
  it('리스너·권한·등록 모두 건너뛴다', async () => {
    const m = await load()
    m.installPush()
    expect(h.addListener).not.toHaveBeenCalled()
    expect(await m.pushPermission()).toBe('denied')
    expect(await m.askPushPermission()).toBe(false)
    await m.syncPushToken('u1')
    await m.forgetPushToken()
    expect(h.checkPermissions).not.toHaveBeenCalled()
    expect(h.register).not.toHaveBeenCalled()
    expect(h.forgetToken).not.toHaveBeenCalled()
  })
  it('플러그인이 없는 옛 앱(1.1.0)도 건너뛴다', async () => {
    h.native = true
    h.plugin = false
    const m = await load()
    expect(m.pushSupported()).toBe(false)
    m.installPush()
    expect(h.addListener).not.toHaveBeenCalled()
  })
})

describe('앱', () => {
  beforeEach(() => {
    h.native = true
  })

  it('채널을 만들고, 받은 토큰을 등록하고 기억한다', async () => {
    const m = await load()
    m.installPush()
    m.installPush() // 두 번 불러도 한 번만
    expect(h.createChannel).toHaveBeenCalledTimes(1)
    expect(h.createChannel).toHaveBeenCalledWith({ id: 'moabuli', name: '모아불리 알림', importance: 4 })
    h.handlers.registration({ value: 'tok-123' })
    expect(h.registerToken).toHaveBeenCalledWith('tok-123')
    expect(localStorage.getItem('pushToken')).toBe('tok-123')
  })

  it('알림을 누르면 그 화면으로 간다', async () => {
    const m = await load()
    m.installPush()
    h.handlers.pushNotificationActionPerformed({ notification: { data: { path: '/confess' } } })
    expect(window.location.hash).toBe('#/confess')
  })

  it('바깥 주소·이상한 경로는 무시한다', async () => {
    const m = await load()
    expect(m.safePath('/info/abc')).toBe('/info/abc')
    expect(m.safePath('https://evil.example')).toBeNull()
    expect(m.safePath('//evil.example')).toBeNull()
    expect(m.safePath('confess')).toBeNull()
    expect(m.safePath(undefined)).toBeNull()
    m.openFromNotification({ path: 'https://evil.example' })
    expect(window.location.hash).toBe('')
  })

  it('권한 상태를 세 가지로 돌려준다', async () => {
    const m = await load()
    h.checkPermissions.mockResolvedValueOnce({ receive: 'prompt-with-rationale' })
    expect(await m.pushPermission()).toBe('prompt')
    h.checkPermissions.mockResolvedValueOnce({ receive: 'denied' })
    expect(await m.pushPermission()).toBe('denied')
    h.requestPermissions.mockResolvedValueOnce({ receive: 'denied' })
    expect(await m.askPushPermission()).toBe(false)
  })

  it('로그인 후: 권한이 있고 설정을 만든 사람만, 사람마다 한 번 등록', async () => {
    const m = await load()
    await m.syncPushToken('u1')
    await m.syncPushToken('u1')
    expect(h.register).toHaveBeenCalledTimes(1)

    h.fetchPrefs.mockResolvedValueOnce(null)
    await m.syncPushToken('u2')
    expect(h.register).toHaveBeenCalledTimes(1)

    h.checkPermissions.mockResolvedValueOnce({ receive: 'denied' })
    await m.syncPushToken('u3')
    expect(h.register).toHaveBeenCalledTimes(1)
  })

  it('로그아웃 때 이 폰 토큰을 지운다', async () => {
    const m = await load()
    localStorage.setItem('pushToken', 'tok-123')
    await m.forgetPushToken()
    expect(h.forgetToken).toHaveBeenCalledWith('tok-123')
    expect(localStorage.getItem('pushToken')).toBeNull()
  })
})
```

- [ ] **Step 7: 실패 확인**

Run: `npx vitest run src/lib/pushNative.test.ts`
Expected: FAIL — `Failed to resolve import "./pushNative"`

- [ ] **Step 8: 구현** — `src/lib/pushNative.ts`

```ts
/**
 * 폰 푸시 알림 (2026-11-04, 푸시 2단계). 웹에서는 아무것도 하지 않는다.
 * - 앱 시작 시 installPush(): 알림 채널, 토큰 받기·알림 누르기 리스너
 * - 로그인 후 syncPushToken(): 권한이 있고 알림 설정을 만든 사람만 토큰을 다시 등록
 * 플러그인이 없는 1.1.0 앱이 새 웹을 불러와도 죽지 않게 pushSupported()로 먼저 확인한다.
 */
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { isNative } from './native'
import { fetchPrefs, forgetToken, registerToken } from './pushPrefs'

/** supabase/functions/_shared/fcm.ts, AndroidManifest 기본 채널과 같아야 한다 */
export const CHANNEL_ID = 'moabuli'
const TOKEN_KEY = 'pushToken'

export type PushPermission = 'granted' | 'denied' | 'prompt'

export function pushSupported(): boolean {
  return isNative() && Capacitor.isPluginAvailable('PushNotifications')
}

/** 우리 앱 안 경로만 ('/'로 시작, 바깥 주소 아님) */
export function safePath(p: unknown): string | null {
  if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//') || p.includes('://')) return null
  return p
}

export function openFromNotification(data: unknown): void {
  const path = safePath((data as { path?: unknown } | null)?.path)
  if (path) window.location.hash = `#${path}`
}

const warn = (what: string) => (err: unknown) => console.warn(`[push] ${what}`, err)

function keepToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // 없어도 된다 — 로그아웃 때 못 지울 뿐, 앱을 지우면 서버가 무효 토큰으로 지운다
  }
}

function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

let installed = false

export function installPush(): void {
  if (!pushSupported() || installed) return
  installed = true
  PushNotifications.createChannel({ id: CHANNEL_ID, name: '모아불리 알림', importance: 4 }).catch(warn('채널'))
  PushNotifications.addListener('registration', ({ value }) => {
    keepToken(value)
    registerToken(value).catch(warn('토큰 등록'))
  }).catch(warn('registration'))
  PushNotifications.addListener('registrationError', warn('토큰 발급')).catch(warn('registrationError'))
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) =>
    openFromNotification(notification.data),
  ).catch(warn('알림 누르기'))
}

export async function pushPermission(): Promise<PushPermission> {
  if (!pushSupported()) return 'denied'
  try {
    const { receive } = await PushNotifications.checkPermissions()
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'denied'
  }
}

/** OS 권한 창. 거부·실패는 조용히 false */
export async function askPushPermission(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    return (await PushNotifications.requestPermissions()).receive === 'granted'
  } catch {
    return false
  }
}

/** 토큰 발급 → 'registration' 리스너가 등록한다 */
export async function startPush(): Promise<void> {
  if (!pushSupported()) return
  await PushNotifications.register().catch(warn('register'))
}

let syncedFor: string | null = null

/** 로그인 직후. 토큰이 바뀌었을 수 있어 사람마다 한 번 다시 등록한다 */
export async function syncPushToken(userId: string): Promise<void> {
  if (!pushSupported() || syncedFor === userId) return
  try {
    if ((await pushPermission()) !== 'granted') return
    if (!(await fetchPrefs())) return
    syncedFor = userId
    await startPush()
  } catch (err) {
    warn('sync')(err)
  }
}

/** 로그아웃·탈퇴 전에 — 이 폰으로 그 사람 알림이 더 가지 않게 */
export async function forgetPushToken(): Promise<void> {
  if (!pushSupported()) return
  const token = storedToken()
  if (!token) return
  try {
    await forgetToken(token)
    localStorage.removeItem(TOKEN_KEY)
    syncedFor = null
  } catch (err) {
    warn('토큰 지우기')(err)
  }
}
```

- [ ] **Step 9: 통과 확인**

Run: `npx vitest run src/lib/pushNative.test.ts`
Expected: PASS

- [ ] **Step 10: 실패하는 테스트 작성** — `src/components/PushAskSheet.screen.test.tsx`

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import PushAskSheet from './PushAskSheet'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'

const h = vi.hoisted(() => ({
  supported: true,
  ask: vi.fn(),
  start: vi.fn(),
  fetchPrefs: vi.fn(),
  createPrefs: vi.fn(),
}))
vi.mock('../lib/pushNative', () => ({
  pushSupported: () => h.supported,
  askPushPermission: () => h.ask(),
  startPush: () => h.start(),
}))
vi.mock('../lib/pushPrefs', async (orig) => ({
  ...(await orig<typeof import('../lib/pushPrefs')>()),
  fetchPrefs: () => h.fetchPrefs(),
  createPrefs: (promo: boolean, now: Date) => h.createPrefs(promo, now),
}))

const TITLE = '놓치지 않게 알려드릴게요'
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  h.supported = true
  h.ask.mockResolvedValue(true)
  h.start.mockResolvedValue(undefined)
  h.fetchPrefs.mockResolvedValue(null)
  h.createPrefs.mockResolvedValue({})
  localStorage.clear()
  seedStore({})
  useLedgerStore.setState({ householdId: 'h1', sample: false })
})

describe('처음 알림 안내', () => {
  it('앱 + 우리집 + 설정 없음 + 처음이면 뜬다', async () => {
    renderScreen(<PushAskSheet />)
    expect(await screen.findByText(TITLE)).toBeInTheDocument()
    expect(screen.getByText(/기록할 시간 · 밤 9시/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked() // 광고 동의 기본 해제
  })

  it('웹에선 안 뜨고 서버도 안 부른다', async () => {
    h.supported = false
    renderScreen(<PushAskSheet />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    expect(h.fetchPrefs).not.toHaveBeenCalled()
  })

  it('둘러보기(예시)에선 안 뜬다', async () => {
    useLedgerStore.setState({ householdId: null, sample: true })
    renderScreen(<PushAskSheet />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  it('이미 알림 설정이 있으면 안 뜬다', async () => {
    h.fetchPrefs.mockResolvedValue({ reminderOn: true })
    renderScreen(<PushAskSheet />)
    await waitFor(() => expect(h.fetchPrefs).toHaveBeenCalled())
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  it('3일 전에 [나중에] 했으면 안 뜨고, 8일 지나면 다시 뜬다', async () => {
    localStorage.setItem('pushAskedAt', new Date(Date.now() - 3 * DAY).toISOString())
    const first = renderScreen(<PushAskSheet />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    first.unmount()

    localStorage.setItem('pushAskedAt', new Date(Date.now() - 8 * DAY).toISOString())
    renderScreen(<PushAskSheet />)
    expect(await screen.findByText(TITLE)).toBeInTheDocument()
  })

  it('광고 체크 후 [알림 받기] → 권한 → 설정 저장 → 토큰 → 동의 안내', async () => {
    const { user } = renderScreen(<PushAskSheet />)
    await user.click(await screen.findByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '알림 받기' }))
    expect(h.createPrefs).toHaveBeenCalledWith(true, expect.any(Date))
    expect(h.start).toHaveBeenCalled()
    expect(await screen.findByText(/월 \d+일 소식·혜택 알림 수신에 동의하셨어요/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(screen.queryByText(/동의하셨어요/)).not.toBeInTheDocument()
  })

  it('광고 체크 없이 [알림 받기]면 바로 닫힌다', async () => {
    const { user } = renderScreen(<PushAskSheet />)
    await user.click(await screen.findByRole('button', { name: '알림 받기' }))
    expect(h.createPrefs).toHaveBeenCalledWith(false, expect.any(Date))
    await waitFor(() => expect(screen.queryByText(TITLE)).not.toBeInTheDocument())
  })

  it('권한을 거부하면 저장하지 않고 7일 뒤로 미룬다', async () => {
    h.ask.mockResolvedValue(false)
    const { user } = renderScreen(<PushAskSheet />)
    await user.click(await screen.findByRole('button', { name: '알림 받기' }))
    expect(h.createPrefs).not.toHaveBeenCalled()
    expect(localStorage.getItem('pushAskedAt')).not.toBeNull()
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  it('[나중에]도 7일 뒤로 미룬다', async () => {
    const { user } = renderScreen(<PushAskSheet />)
    await user.click(await screen.findByRole('button', { name: '나중에' }))
    expect(localStorage.getItem('pushAskedAt')).not.toBeNull()
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 11: 실패 확인**

Run: `npx vitest run src/components/PushAskSheet.screen.test.tsx`
Expected: FAIL — `Failed to resolve import "./PushAskSheet"`

- [ ] **Step 12: 구현** — `src/components/PushAskSheet.tsx`

```tsx
import { useEffect, useState } from 'react'
import { useLedgerStore } from '../lib/store'
import { askPushPermission, pushSupported, startPush } from '../lib/pushNative'
import { createPrefs, fetchPrefs, firstConsentText, markAsked, readAskedAt, shouldAskPush } from '../lib/pushPrefs'

/**
 * 처음 알림 안내 (2026-11-04, 푸시 2단계). 앱에서만, 로그인한 우리집 홈에서 한 번.
 * [나중에]·권한 거부면 7일 동안 다시 안 띄운다. 설정 > 알림에서 언제든 켤 수 있다.
 * 광고 동의 체크박스는 기본 해제(정보통신망법).
 */
export default function PushAskSheet() {
  const householdId = useLedgerStore((s) => s.householdId)
  const sample = useLedgerStore((s) => s.sample)
  const [phase, setPhase] = useState<'hidden' | 'ask' | 'done'>('hidden')
  const [promo, setPromo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [doneText, setDoneText] = useState('')

  useEffect(() => {
    if (!pushSupported() || !householdId || sample) return
    if (!shouldAskPush(readAskedAt(), new Date())) return
    let alive = true
    fetchPrefs()
      .then((p) => {
        if (alive && !p) setPhase('ask')
      })
      .catch(() => {
        /* 조용히 넘어간다 — 설정에서 켤 수 있다 */
      })
    return () => {
      alive = false
    }
  }, [householdId, sample])

  if (phase === 'hidden') return null

  const later = () => {
    markAsked(new Date())
    setPhase('hidden')
  }

  const accept = async () => {
    setBusy(true)
    const now = new Date()
    try {
      if (!(await askPushPermission())) return later()
      await createPrefs(promo, now)
      await startPush()
      if (promo) {
        setDoneText(firstConsentText(now))
        setPhase('done')
      } else {
        setPhase('hidden')
      }
    } catch {
      setPhase('hidden')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="알림 안내"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
    >
      <div className="w-full max-w-app rounded-t-[20px] bg-white px-6 pb-8 pt-6">
        {phase === 'done' ? (
          <>
            <p className="text-[17px] font-bold text-ink">알림을 켰어요</p>
            <p className="mt-2 text-[14px] text-sub">{doneText}</p>
            <button
              onClick={() => setPhase('hidden')}
              className="mt-5 h-12 w-full rounded-btn bg-brand text-[15px] font-bold text-white"
            >
              확인
            </button>
          </>
        ) : (
          <>
            <p className="text-[18px] font-extrabold text-ink">놓치지 않게 알려드릴게요</p>
            <ul className="mt-3 space-y-1.5 text-[14px] text-sub">
              <li>· 기록할 시간 · 밤 9시</li>
              <li>· 정산하는 날 · 저녁 8시</li>
              <li>· 오늘의 경제 · 아침 8시</li>
            </ul>
            <label className="mt-4 flex items-start gap-2.5 rounded-btn bg-bg px-3.5 py-3 text-[13.5px] text-ink">
              <input
                type="checkbox"
                checked={promo}
                onChange={(e) => setPromo(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
              />
              <span>
                결영이네 소식·혜택 알림 받기 <span className="text-cap">(선택, 광고)</span>
              </span>
            </label>
            <button
              onClick={accept}
              disabled={busy}
              className="mt-5 h-12 w-full rounded-btn bg-brand text-[15px] font-bold text-white disabled:opacity-50"
            >
              알림 받기
            </button>
            <button
              onClick={later}
              disabled={busy}
              className="mt-2 h-11 w-full text-[14px] font-semibold text-sub"
            >
              나중에
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 13: 통과 확인**

Run: `npx vitest run src/components/PushAskSheet.screen.test.tsx`
Expected: PASS

- [ ] **Step 14: 연결**

`src/main.tsx` — import 아래에 추가하고, `installNativeShell()` 바로 다음 줄에서 부른다(앱이 꺼진 상태에서 알림을 눌러 열려도 리스너가 먼저 붙게):

```tsx
import { installPush } from './lib/pushNative'
```
```tsx
// 앱(하이브리드)일 때만 뒤로가기·바깥 링크·앱 링크를 처리한다
installNativeShell()
// 앱일 때만: 알림 채널·토큰·알림 누르면 그 화면으로 (2026-11-04)
installPush()
```

`src/App.tsx` — import 추가 `import { syncPushToken } from './lib/pushNative'`, `onSignedIn` 마지막 줄에:

```tsx
async function onSignedIn(user: User) {
  rememberLogin(true) // 다음에 이 기기로 오면 예시 대신 로그인 화면부터
  await attachSourceToUser(user)
  await applyMarketingChoice(user)
  void syncPushToken(user.id) // 앱에서 알림을 켠 사람만 토큰을 다시 등록 (웹은 아무것도 안 함)
}
```

`src/pages/Home.tsx` — import 추가 `import PushAskSheet from '../components/PushAskSheet'`, `Home`의 `return (` 바로 아래 최상위 div 첫 자식으로:

```tsx
    <div className="animate-fade-up space-y-4 pb-24">
      {/* 앱 처음 알림 안내 (웹·예시에선 안 뜬다) */}
      <PushAskSheet />
```

- [ ] **Step 15: 빌드 후 커밋**

Run: `npm run build`
Expected: 통과 (기존 Home·Settings 화면 테스트도 그대로 — 웹이라 시트가 안 뜬다)

```bash
git add package.json package-lock.json src/lib/pushPrefs.ts src/lib/pushPrefs.test.ts src/lib/pushNative.ts src/lib/pushNative.test.ts src/components/PushAskSheet.tsx src/components/PushAskSheet.screen.test.tsx src/main.tsx src/App.tsx src/pages/Home.tsx android/capacitor.settings.gradle android/app/capacitor.build.gradle
git commit -m "앱 푸시: 토큰 등록, 알림 누르면 그 화면으로, 홈 처음 안내(광고 동의는 선택) — 웹은 그대로 (@capacitor/push-notifications <설치 버전>)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- package.json package-lock.json src/lib/pushPrefs.ts src/lib/pushPrefs.test.ts src/lib/pushNative.ts src/lib/pushNative.test.ts src/components/PushAskSheet.tsx src/components/PushAskSheet.screen.test.tsx src/main.tsx src/App.tsx src/pages/Home.tsx android/capacitor.settings.gradle android/app/capacitor.build.gradle
```

---

### Task 5: 설정 > 알림

**Files:**
- Create: `src/components/NotificationSettings.tsx`, `src/components/NotificationSettings.screen.test.tsx`
- Modify: `src/pages/Settings.tsx` (계정 카드 위에 알림 카드, 로그아웃·탈퇴 전 토큰 지우기)

**Interfaces:**
- Consumes (Task 4): `isNative` (`../lib/native`), `pushSupported`, `pushPermission`, `askPushPermission`, `startPush`, `forgetPushToken`, `type PushPermission` (`../lib/pushNative`), `TIME_SLOTS`, `consentNotice`, `createPrefs`, `fetchPrefs`, `updatePrefs`, `setPromo`, `type NotificationPrefs`, `type PrefsPatch` (`../lib/pushPrefs`)
- Produces: `NotificationSettings` (default export, props 없음)

- [ ] **Step 1: 실패하는 테스트 작성** — `src/components/NotificationSettings.screen.test.tsx`

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationSettings from './NotificationSettings'
import type { NotificationPrefs } from '../lib/pushPrefs'

const h = vi.hoisted(() => ({
  native: true,
  supported: true,
  perm: vi.fn(),
  ask: vi.fn(),
  start: vi.fn(),
  fetchPrefs: vi.fn(),
  createPrefs: vi.fn(),
  updatePrefs: vi.fn(),
  setPromo: vi.fn(),
}))
vi.mock('../lib/native', () => ({ isNative: () => h.native }))
vi.mock('../lib/pushNative', () => ({
  pushSupported: () => h.supported,
  pushPermission: () => h.perm(),
  askPushPermission: () => h.ask(),
  startPush: () => h.start(),
}))
vi.mock('../lib/pushPrefs', async (orig) => ({
  ...(await orig<typeof import('../lib/pushPrefs')>()),
  fetchPrefs: () => h.fetchPrefs(),
  createPrefs: (p: boolean, n: Date) => h.createPrefs(p, n),
  updatePrefs: (p: unknown) => h.updatePrefs(p),
  setPromo: (on: boolean, n: Date) => h.setPromo(on, n),
}))

const PREFS: NotificationPrefs = {
  reminderOn: true,
  reminderTime: '21:00',
  settleOn: true,
  newsOn: true,
  promoOn: false,
  promoConsentAt: null,
}

beforeEach(() => {
  h.native = true
  h.supported = true
  h.perm.mockResolvedValue('granted')
  h.ask.mockResolvedValue(true)
  h.start.mockResolvedValue(undefined)
  h.fetchPrefs.mockResolvedValue({ ...PREFS })
  h.createPrefs.mockResolvedValue({ ...PREFS })
  h.updatePrefs.mockResolvedValue(undefined)
  h.setPromo.mockResolvedValue(undefined)
})

describe('설정 > 알림', () => {
  it('웹에선 안내 한 줄만', () => {
    h.native = false
    render(<NotificationSettings />)
    expect(screen.getByText('알림은 모아불리 앱에서 받을 수 있어요')).toBeInTheDocument()
    expect(h.perm).not.toHaveBeenCalled()
  })

  it('플러그인 없는 옛 앱은 업데이트 안내', () => {
    h.supported = false
    render(<NotificationSettings />)
    expect(screen.getByText('앱을 업데이트하면 알림을 받을 수 있어요')).toBeInTheDocument()
  })

  it('폰에서 막혀 있으면 알리고, 다시 거부되면 켜는 곳을 알려 준다', async () => {
    h.perm.mockResolvedValue('denied')
    h.ask.mockResolvedValue(false)
    render(<NotificationSettings />)
    expect(await screen.findByText('폰 설정에서 알림이 꺼져 있어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '알림 켜기' }))
    expect(await screen.findByText('폰 설정 > 애플리케이션 > 모아불리 > 알림에서 켜 주세요')).toBeInTheDocument()
  })

  it('아직 안 켠 사람은 [알림 켜기]로 기본값을 만들고 스위치가 보인다', async () => {
    h.perm.mockResolvedValue('prompt')
    h.fetchPrefs.mockResolvedValue(null)
    render(<NotificationSettings />)
    await userEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
    expect(h.createPrefs).toHaveBeenCalledWith(false, expect.any(Date))
    expect(h.start).toHaveBeenCalled()
    expect(await screen.findByRole('switch', { name: '기록 리마인더' })).toBeChecked()
  })

  it('종류별 스위치와 리마인더 시각(30분 단위)', async () => {
    render(<NotificationSettings />)
    const reminder = await screen.findByRole('switch', { name: '기록 리마인더' })
    expect(screen.getByRole('switch', { name: '월말 정산' })).toBeChecked()
    expect(screen.getByRole('switch', { name: '오늘의 경제·공지' })).toBeChecked()
    expect(screen.getByRole('switch', { name: '결영이네 소식·혜택 (광고)' })).not.toBeChecked()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '리마인더 시각' }), '07:30')
    expect(h.updatePrefs).toHaveBeenCalledWith({ reminderTime: '07:30' })
    expect(screen.getAllByRole('option')).toHaveLength(48)

    await userEvent.click(reminder)
    expect(h.updatePrefs).toHaveBeenLastCalledWith({ reminderOn: false })
    expect(screen.getByRole('combobox', { name: '리마인더 시각' })).toBeDisabled()
  })

  it('광고 켜기·끄기는 바로 처리 결과를 알려 준다', async () => {
    render(<NotificationSettings />)
    const promo = await screen.findByRole('switch', { name: '결영이네 소식·혜택 (광고)' })
    await userEvent.click(promo)
    expect(h.setPromo).toHaveBeenCalledWith(true, expect.any(Date))
    expect(await screen.findByText(/^\d{4}년 \d+월 \d+일 수신 동의가 처리됐어요$/)).toBeInTheDocument()
    await userEvent.click(promo)
    expect(h.setPromo).toHaveBeenLastCalledWith(false, expect.any(Date))
    expect(await screen.findByText(/수신 거부가 처리됐어요$/)).toBeInTheDocument()
  })

  it('저장에 실패하면 되돌린다', async () => {
    h.updatePrefs.mockRejectedValue(new Error('x'))
    render(<NotificationSettings />)
    const settle = await screen.findByRole('switch', { name: '월말 정산' })
    await userEvent.click(settle)
    expect(await screen.findByText('바꾸지 못했어요. 잠시 후 다시 해 주세요')).toBeInTheDocument()
    await waitFor(() => expect(settle).toBeChecked())
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/NotificationSettings.screen.test.tsx`
Expected: FAIL — `Failed to resolve import "./NotificationSettings"`

- [ ] **Step 3: 구현** — `src/components/NotificationSettings.tsx`

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { isNative } from '../lib/native'
import { askPushPermission, pushPermission, pushSupported, startPush, type PushPermission } from '../lib/pushNative'
import {
  TIME_SLOTS,
  consentNotice,
  createPrefs,
  fetchPrefs,
  setPromo,
  updatePrefs,
  type NotificationPrefs,
  type PrefsPatch,
} from '../lib/pushPrefs'

const FAIL = '바꾸지 못했어요. 잠시 후 다시 해 주세요'

/**
 * 설정 > 알림 (2026-11-04, 푸시 2단계).
 * 웹은 안내 한 줄. 앱은 종류별 스위치 + 리마인더 시각. 광고 스위치는 바꾸는 즉시 처리 결과를 알린다(정보통신망법).
 */
export default function NotificationSettings() {
  if (!isNative()) return <p className="text-[13.5px] text-sub">알림은 모아불리 앱에서 받을 수 있어요</p>
  if (!pushSupported()) return <p className="text-[13.5px] text-sub">앱을 업데이트하면 알림을 받을 수 있어요</p>
  return <AppNotificationSettings />
}

function AppNotificationSettings() {
  const [loaded, setLoaded] = useState(false)
  const [perm, setPerm] = useState<PushPermission>('prompt')
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [msg, setMsg] = useState('')
  const [hint, setHint] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([pushPermission(), fetchPrefs().catch(() => null)]).then(([p, pr]) => {
      if (!alive) return
      setPerm(p)
      setPrefs(pr)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!loaded) return null

  const enable = async () => {
    setHint('')
    setMsg('')
    if (!(await askPushPermission())) {
      setPerm('denied')
      setHint('폰 설정 > 애플리케이션 > 모아불리 > 알림에서 켜 주세요')
      return
    }
    setPerm('granted')
    try {
      setPrefs(prefs ?? (await createPrefs(false, new Date())))
      await startPush()
    } catch {
      setMsg('켜지 못했어요. 잠시 후 다시 해 주세요')
    }
  }

  if (perm !== 'granted' || !prefs) {
    return (
      <div className="rounded-btn bg-bg px-4 py-3">
        <p className="text-[14px] font-semibold text-ink">
          {perm === 'denied' ? '폰 설정에서 알림이 꺼져 있어요' : '알림이 아직 꺼져 있어요'}
        </p>
        <button
          onClick={enable}
          className="mt-2 h-10 rounded-btn bg-brand px-4 text-[14px] font-bold text-white active:bg-brand-dark"
        >
          알림 켜기
        </button>
        {hint && <p className="mt-2 text-[12.5px] text-sub">{hint}</p>}
        {msg && <p className="mt-2 text-[12.5px] font-medium text-danger">{msg}</p>}
      </div>
    )
  }

  const change = async (patch: PrefsPatch) => {
    const before = prefs
    setPrefs({ ...prefs, ...patch })
    setMsg('')
    try {
      await updatePrefs(patch)
    } catch {
      setPrefs(before)
      setMsg(FAIL)
    }
  }

  const changePromo = async (on: boolean) => {
    const before = prefs
    const now = new Date()
    setPrefs({ ...prefs, promoOn: on, promoConsentAt: on ? now.toISOString() : prefs.promoConsentAt })
    setMsg('')
    try {
      await setPromo(on, now)
      setMsg(consentNotice(on, now))
    } catch {
      setPrefs(before)
      setMsg(FAIL)
    }
  }

  return (
    <div className="space-y-2">
      <SwitchRow label="기록 리마인더" checked={prefs.reminderOn} onChange={(v) => change({ reminderOn: v })}>
        <select
          aria-label="리마인더 시각"
          value={prefs.reminderTime}
          disabled={!prefs.reminderOn}
          onChange={(e) => change({ reminderTime: e.target.value })}
          className="rounded-btn border border-line bg-white px-2 py-1.5 text-[14px] text-ink disabled:opacity-40"
        >
          {TIME_SLOTS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </SwitchRow>
      <SwitchRow label="월말 정산" checked={prefs.settleOn} onChange={(v) => change({ settleOn: v })} />
      <SwitchRow label="오늘의 경제·공지" checked={prefs.newsOn} onChange={(v) => change({ newsOn: v })} />
      <SwitchRow label="결영이네 소식·혜택 (광고)" checked={prefs.promoOn} onChange={changePromo} />
      {msg && <p className="pl-1 text-[12.5px] font-medium text-brand">{msg}</p>}
    </div>
  )
}

function SwitchRow({
  label,
  checked,
  onChange,
  children,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-btn bg-bg px-4 py-3">
      <label className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="text-[14.5px] font-semibold text-ink">{label}</span>
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-brand"
        />
      </label>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/NotificationSettings.screen.test.tsx`
Expected: PASS

- [ ] **Step 5: Settings에 연결** — `src/pages/Settings.tsx`

import 추가:
```tsx
import NotificationSettings from '../components/NotificationSettings'
import { forgetPushToken } from '../lib/pushNative'
```

`{/* 계정 */}` 카드 바로 위에:
```tsx
            {/* 알림 (2026-11-04) — 앱에서만 스위치, 웹은 안내 한 줄 */}
            <Card>
              <h2 className="mb-3 text-[15px] font-bold text-ink">알림</h2>
              <NotificationSettings />
            </Card>

```

로그아웃 버튼의 `onClick={() => supabase.auth.signOut()}`을:
```tsx
                  onClick={async () => {
                    await forgetPushToken() // 이 폰으로 알림이 더 가지 않게 (웹은 아무것도 안 함)
                    await supabase.auth.signOut()
                  }}
```

`withdraw` 안의 `await deleteMyAccount()` 바로 앞에:
```tsx
      await forgetPushToken()
```

- [ ] **Step 6: 빌드 후 커밋**

Run: `npm run build`
Expected: 통과 (`Settings.switch`·`Settings.categories` 화면 테스트도 그대로 — 웹 경로)

```bash
git add src/components/NotificationSettings.tsx src/components/NotificationSettings.screen.test.tsx src/pages/Settings.tsx
git commit -m "설정 > 알림: 종류별 스위치·리마인더 시각(30분 단위), 광고 동의·거부 처리 결과 바로 안내, 로그아웃 때 토큰 지우기

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/components/NotificationSettings.tsx src/components/NotificationSettings.screen.test.tsx src/pages/Settings.tsx
```

---

### Task 6: 관리자 > 알림 보내기

**Files:**
- Create: `src/lib/pushAdmin.ts`, `src/lib/pushAdmin.test.ts`, `src/pages/AdminPush.tsx`, `src/pages/AdminPush.screen.test.tsx`
- Modify: `src/pages/AdminPosts.tsx` (탭 두 개)

**Interfaces:**
- Consumes (Task 1): 테이블 `push_campaigns`, RPC `push_audience_count`
- Consumes (Task 2): `promoText`, `promoHourOk`, `kstParts` (`../../supabase/functions/_shared/pushRules.ts`)
- Consumes (Task 4): `TIME_SLOTS` (`./pushPrefs`)
- Consumes (기존): `fetchPosts`, `type Post` (`../lib/posts`)
- Produces:
  - `type CampaignKind = 'notice' | 'promo'`, `type CampaignStatus = 'scheduled' | 'sent' | 'canceled'`
  - `interface Campaign { id; kind; title; body; path; sendAt; status; sentCount; failCount }`, `interface CampaignDraft { kind; title; body; path; sendAt }`
  - `CAMPAIGN_KIND_LABEL`, `STATUS_LABEL`, `PATH_OPTIONS: { label: string; path: string }[]`
  - `previewText(kind, title, body)`, `promoTimeAllowed(hhmm): boolean`, `timeSlotsFor(kind): string[]`, `kstSendAt(date, hhmm): string`(ISO), `scheduleError(kind, date, hhmm, now): string | null`, `sendAtLabel(iso): string`, re-export `promoHourOk`
  - `fetchCampaigns(limit?)`, `createCampaign(d)`, `cancelCampaign(id)`, `audienceCount(kind): Promise<number>`
  - `AdminPush` (default export)

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/pushAdmin.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { kstSendAt, previewText, promoTimeAllowed, scheduleError, sendAtLabel, timeSlotsFor } from './pushAdmin'

describe('광고 미리보기', () => {
  it('홍보는 (광고)와 수신 거부를 붙이고, 공지는 그대로', () => {
    expect(previewText('promo', '연말 특강', '자리 남았어요')).toEqual({
      title: '(광고) 연말 특강',
      body: '자리 남았어요\n수신 거부: 설정 > 알림',
    })
    expect(previewText('notice', '새 기능', '정산이 쉬워졌어요')).toEqual({ title: '새 기능', body: '정산이 쉬워졌어요' })
  })
})

describe('예약 시각', () => {
  const now = new Date('2026-11-04T12:00:00+09:00')
  it('홍보는 08:00~20:30만 고를 수 있다', () => {
    const slots = timeSlotsFor('promo')
    expect(slots[0]).toBe('08:00')
    expect(slots.at(-1)).toBe('20:30')
    expect(slots).toHaveLength(26)
    expect(slots).not.toContain('21:00')
    expect(slots).not.toContain('07:30')
    expect(timeSlotsFor('notice')).toHaveLength(48)
    expect(promoTimeAllowed('20:59')).toBe(true)
    expect(promoTimeAllowed('21:00')).toBe(false)
  })
  it('한국 시각으로 저장한다', () => {
    expect(kstSendAt('2026-11-05', '09:30')).toBe('2026-11-05T00:30:00.000Z')
    expect(sendAtLabel('2026-11-05T00:30:00.000Z')).toBe('11/5 09:30')
  })
  it('검사', () => {
    expect(scheduleError('notice', '', '', now)).toBe('날짜와 시각을 골라 주세요')
    expect(scheduleError('promo', '2026-11-05', '21:00', now)).toBe('광고 알림은 밤 9시부터 아침 8시까지 보낼 수 없어요')
    expect(scheduleError('notice', '2026-11-04', '11:30', now)).toBe('지난 시각은 고를 수 없어요')
    expect(scheduleError('notice', '2026-11-04', '22:00', now)).toBeNull()
    expect(scheduleError('promo', '2026-11-05', '08:00', now)).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/pushAdmin.test.ts`
Expected: FAIL — `Failed to resolve import "./pushAdmin"`

- [ ] **Step 3: 구현** — `src/lib/pushAdmin.ts`

```ts
/**
 * 관리자 > 알림 보내기 (2026-11-04, 푸시 2단계). 테이블: supabase/push.sql의 push_campaigns
 * 실제로 보내는 건 push-dispatch(5분마다). 여기서는 캠페인을 적어 두기만 한다.
 * 진짜 권한은 DB(RLS·RPC)가 막는다.
 */
import { supabase } from './supabase'
import { kstParts, promoHourOk, promoText } from '../../supabase/functions/_shared/pushRules.ts'
import { TIME_SLOTS } from './pushPrefs'

export { promoHourOk }

export type CampaignKind = 'notice' | 'promo'
export type CampaignStatus = 'scheduled' | 'sent' | 'canceled'

export interface Campaign {
  id: string
  kind: CampaignKind
  title: string
  body: string
  path: string
  sendAt: string
  status: CampaignStatus
  sentCount: number
  failCount: number
}

export interface CampaignDraft {
  kind: CampaignKind
  title: string
  body: string
  path: string
  sendAt: string
}

export const CAMPAIGN_KIND_LABEL: Record<CampaignKind, string> = { notice: '공지', promo: '홍보' }
export const STATUS_LABEL: Record<CampaignStatus, string> = { scheduled: '예약', sent: '보냄', canceled: '취소' }

/** 알림을 누르면 열릴 화면 (특정 글은 화면에서 최근 글 목록을 덧붙인다) */
export const PATH_OPTIONS: { label: string; path: string }[] = [
  { label: '홈', path: '/' },
  { label: '오늘의 경제', path: '/info' },
  { label: '상담 신청', path: '/consult' },
  { label: '묻고 답하기', path: '/qna' },
  { label: '월간 가계부', path: '/monthly' },
  { label: '소비 기록', path: '/confess' },
  { label: '설정', path: '/settings' },
]

export function previewText(kind: CampaignKind, title: string, body: string): { title: string; body: string } {
  return kind === 'promo' ? promoText(title, body) : { title, body }
}

/** 광고는 08:00~20:59 (예약 칸은 30분 단위라 08:00~20:30) */
export function promoTimeAllowed(hhmm: string): boolean {
  const h = Number(hhmm.slice(0, 2))
  return h >= 8 && h <= 20
}

export function timeSlotsFor(kind: CampaignKind): string[] {
  return kind === 'promo' ? TIME_SLOTS.filter(promoTimeAllowed) : TIME_SLOTS
}

/** 한국 날짜·시각 → ISO */
export function kstSendAt(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00+09:00`).toISOString()
}

export function scheduleError(kind: CampaignKind, date: string, hhmm: string, now: Date): string | null {
  if (!date || !hhmm) return '날짜와 시각을 골라 주세요'
  if (kind === 'promo' && !promoTimeAllowed(hhmm)) return '광고 알림은 밤 9시부터 아침 8시까지 보낼 수 없어요'
  if (Date.parse(kstSendAt(date, hhmm)) <= now.getTime()) return '지난 시각은 고를 수 없어요'
  return null
}

/** '11/5 09:30' (한국 시간) */
export function sendAtLabel(iso: string): string {
  const k = kstParts(new Date(iso))
  return `${k.month}/${k.day} ${String(k.hour).padStart(2, '0')}:${String(k.minute).padStart(2, '0')}`
}

interface CampaignRow {
  id: string
  kind: CampaignKind
  title: string
  body: string
  path: string
  send_at: string
  status: CampaignStatus
  sent_count: number
  fail_count: number
}

export async function fetchCampaigns(limit = 20): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('push_campaigns')
    .select('id, kind, title, body, path, send_at, status, sent_count, fail_count')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as CampaignRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    path: r.path,
    sendAt: r.send_at,
    status: r.status,
    sentCount: r.sent_count,
    failCount: r.fail_count,
  }))
}

export async function createCampaign(d: CampaignDraft): Promise<void> {
  const { error } = await supabase
    .from('push_campaigns')
    .insert({ kind: d.kind, title: d.title, body: d.body, path: d.path, send_at: d.sendAt })
  if (error) throw error
}

export async function cancelCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('push_campaigns')
    .update({ status: 'canceled' })
    .eq('id', id)
    .eq('status', 'scheduled')
  if (error) throw error
}

/** 받을 사람 수 (서버 함수 — 운영자만) */
export async function audienceCount(kind: CampaignKind): Promise<number> {
  const { data, error } = await supabase.rpc('push_audience_count', { p_kind: kind })
  if (error) throw error
  return Number(data ?? 0)
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/pushAdmin.test.ts`
Expected: PASS

- [ ] **Step 5: 실패하는 화면 테스트 작성** — `src/pages/AdminPush.screen.test.tsx`

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminPush from './AdminPush'
import * as pushAdmin from '../lib/pushAdmin'

vi.mock('../lib/pushAdmin', async (orig) => ({
  ...(await orig<typeof import('../lib/pushAdmin')>()),
  fetchCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  cancelCampaign: vi.fn(),
  audienceCount: vi.fn(),
}))
vi.mock('../lib/posts', async (orig) => ({
  ...(await orig<typeof import('../lib/posts')>()),
  fetchPosts: vi.fn().mockResolvedValue([]),
}))

const scheduled: pushAdmin.Campaign = {
  id: 'c1',
  kind: 'notice',
  title: '점검 안내',
  body: '내일 새벽 2시 점검해요',
  path: '/',
  sendAt: '2026-12-01T00:30:00.000Z',
  status: 'scheduled',
  sentCount: 0,
  failCount: 0,
}

beforeEach(() => {
  vi.mocked(pushAdmin.fetchCampaigns).mockResolvedValue([scheduled])
  vi.mocked(pushAdmin.createCampaign).mockResolvedValue()
  vi.mocked(pushAdmin.cancelCampaign).mockResolvedValue()
  vi.mocked(pushAdmin.audienceCount).mockResolvedValue(3)
})

async function fill(kind: '공지' | '홍보', title: string, body: string) {
  await userEvent.selectOptions(screen.getByRole('combobox', { name: '종류' }), kind)
  await userEvent.type(screen.getByRole('textbox', { name: '제목' }), title)
  await userEvent.type(screen.getByRole('textbox', { name: '내용' }), body)
}

describe('관리자 > 알림 보내기', () => {
  it('홍보 미리보기에 (광고)와 수신 거부 문구가 붙는다', async () => {
    render(<AdminPush />)
    await fill('홍보', '연말 특강', '자리 남았어요')
    expect(screen.getByText('(광고) 연말 특강')).toBeInTheDocument()
    expect(screen.getByText(/자리 남았어요\s*수신 거부: 설정 > 알림/)).toBeInTheDocument()
  })

  it('홍보는 21~08시를 예약할 수 없다', async () => {
    render(<AdminPush />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '종류' }), '홍보')
    await userEvent.click(screen.getByRole('radio', { name: '예약' }))
    const time = screen.getByRole('combobox', { name: '시각' })
    const opts = Array.from((time as HTMLSelectElement).options).map((o) => o.value)
    expect(opts).toContain('08:00')
    expect(opts).toContain('20:30')
    expect(opts).not.toContain('21:00')
    expect(opts).not.toContain('07:30')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '종류' }), '공지')
    const all = Array.from((screen.getByRole('combobox', { name: '시각' }) as HTMLSelectElement).options).map((o) => o.value)
    expect(all).toContain('21:00')
  })

  it('지금 보내기: 대상 수를 확인하고 저장한다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AdminPush />)
    await fill('공지', '새 기능', '정산이 쉬워졌어요')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '열릴 화면' }), '/monthly')
    await userEvent.click(screen.getByRole('button', { name: '보내기' }))
    expect(pushAdmin.audienceCount).toHaveBeenCalledWith('notice')
    expect(confirm).toHaveBeenCalledWith('3명에게 보내요. 보낼까요?')
    expect(pushAdmin.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'notice', title: '새 기능', body: '정산이 쉬워졌어요', path: '/monthly' }),
    )
    expect(await screen.findByText(/보내져요|예약했어요/)).toBeInTheDocument()
  })

  it('확인에서 취소하면 저장하지 않는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AdminPush />)
    await fill('공지', '새 기능', '정산이 쉬워졌어요')
    await userEvent.click(screen.getByRole('button', { name: '보내기' }))
    expect(pushAdmin.createCampaign).not.toHaveBeenCalled()
  })

  it('목록에서 예약을 취소한다', async () => {
    render(<AdminPush />)
    await userEvent.click(await screen.findByRole('button', { name: '점검 안내 예약 취소' }))
    expect(pushAdmin.cancelCampaign).toHaveBeenCalledWith('c1')
  })
})
```

- [ ] **Step 6: 실패 확인**

Run: `npx vitest run src/pages/AdminPush.screen.test.tsx`
Expected: FAIL — `Failed to resolve import "./AdminPush"`

- [ ] **Step 7: 구현** — `src/pages/AdminPush.tsx`

```tsx
import { useEffect, useState } from 'react'
import Card from '../components/Card'
import { fetchPosts, type Post } from '../lib/posts'
import {
  CAMPAIGN_KIND_LABEL,
  PATH_OPTIONS,
  STATUS_LABEL,
  audienceCount,
  cancelCampaign,
  createCampaign,
  fetchCampaigns,
  kstSendAt,
  previewText,
  promoHourOk,
  scheduleError,
  sendAtLabel,
  timeSlotsFor,
  type Campaign,
  type CampaignKind,
} from '../lib/pushAdmin'

const field = 'mt-1 w-full rounded-btn border border-line bg-white px-3 py-2 text-[14px] text-ink'

/**
 * 관리자 > 알림 보내기 (2026-11-04, 푸시 2단계). /admin/posts의 두 번째 탭.
 * 적어 두면 push-dispatch가 5분 안에 보낸다. 홍보는 21~08시 예약 불가, 미리보기에 (광고)·수신 거부가 붙는다.
 */
export default function AdminPush() {
  const [kind, setKind] = useState<CampaignKind>('notice')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [path, setPath] = useState('/')
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [list, setList] = useState<Campaign[]>([])
  const [posts, setPosts] = useState<Post[]>([])

  const reload = () =>
    fetchCampaigns()
      .then(setList)
      .catch(() => setList([]))

  useEffect(() => {
    fetchCampaigns()
      .then(setList)
      .catch(() => setList([]))
    fetchPosts(10)
      .then(setPosts)
      .catch(() => setPosts([]))
  }, [])

  const slots = timeSlotsFor(kind)
  const preview = previewText(kind, title || '제목', body || '내용')

  const changeKind = (k: CampaignKind) => {
    setKind(k)
    if (time && !timeSlotsFor(k).includes(time)) setTime('')
  }

  const submit = async () => {
    if (!title.trim() || !body.trim()) return setMsg('제목과 내용을 적어 주세요.')
    const now = new Date()
    if (when === 'later') {
      const err = scheduleError(kind, date, time, now)
      if (err) return setMsg(err)
    }
    setBusy(true)
    setMsg('')
    try {
      const count = await audienceCount(kind)
      if (!window.confirm(`${count}명에게 보내요. 보낼까요?`)) return
      await createCampaign({
        kind,
        title: title.trim(),
        body: body.trim(),
        path,
        sendAt: when === 'now' ? now.toISOString() : kstSendAt(date, time),
      })
      setTitle('')
      setBody('')
      setMsg(
        when === 'later'
          ? '예약했어요.'
          : kind === 'promo' && !promoHourOk(now)
            ? '광고 알림은 아침 8시에 보내져요.'
            : '5분 안에 보내져요.',
      )
      await reload()
    } catch {
      setMsg('보내지 못했어요. push.sql을 실행했는지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (c: Campaign) => {
    try {
      await cancelCampaign(c.id)
      await reload()
    } catch {
      setMsg('취소하지 못했어요.')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-2.5">
          <label className="block text-[12.5px] text-sub">
            종류
            <select
              aria-label="종류"
              value={kind}
              onChange={(e) => changeKind(e.target.value as CampaignKind)}
              className={field}
            >
              <option value="notice">{CAMPAIGN_KIND_LABEL.notice}</option>
              <option value="promo">{CAMPAIGN_KIND_LABEL.promo}</option>
            </select>
          </label>
          <label className="block text-[12.5px] text-sub">
            제목
            <input aria-label="제목" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </label>
          <label className="block text-[12.5px] text-sub">
            내용
            <textarea
              aria-label="내용"
              maxLength={300}
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={field}
            />
          </label>
          <label className="block text-[12.5px] text-sub">
            열릴 화면
            <select aria-label="열릴 화면" value={path} onChange={(e) => setPath(e.target.value)} className={field}>
              {PATH_OPTIONS.map((o) => (
                <option key={o.path} value={o.path}>
                  {o.label}
                </option>
              ))}
              {posts.map((p) => (
                <option key={p.id} value={`/info/${p.id}`}>
                  글: {p.title}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-4 pt-1 text-[14px] text-ink">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="when" checked={when === 'now'} onChange={() => setWhen('now')} />
              지금 보내기
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="when" checked={when === 'later'} onChange={() => setWhen('later')} />
              예약
            </label>
          </div>
          {when === 'later' && (
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="예약 날짜" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
              <select aria-label="시각" value={time} onChange={(e) => setTime(e.target.value)} className={field}>
                <option value="">시각</option>
                {slots.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
          {kind === 'promo' && <p className="text-[12px] text-cap">광고 알림은 아침 8시부터 저녁 9시 전까지만 보내요.</p>}

          <p className="pt-1 text-[12.5px] font-medium text-sub">폰에 이렇게 보여요</p>
          <div className="rounded-card bg-bg px-4 py-3">
            <p className="text-[14px] font-bold text-ink">{preview.title}</p>
            <p className="mt-0.5 whitespace-pre-line text-[13px] text-sub">{preview.body}</p>
          </div>
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
        >
          보내기
        </button>
      </Card>

      {msg && <p className="text-center text-[13px] font-semibold text-brand">{msg}</p>}

      {list.length > 0 && (
        <section className="space-y-2">
          <p className="px-1 text-[13px] font-bold text-sub">보낸·예약한 알림</p>
          {list.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-card bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-ink">
                  {sendAtLabel(c.sendAt)} · {CAMPAIGN_KIND_LABEL[c.kind]} · {c.title}
                </p>
                <p className="text-[12px] text-cap">
                  {STATUS_LABEL[c.status]}
                  {c.status === 'sent' && ` ${c.sentCount}명 · 실패 ${c.failCount}`}
                </p>
              </div>
              {c.status === 'scheduled' && (
                <button
                  onClick={() => cancel(c)}
                  aria-label={`${c.title} 예약 취소`}
                  className="ml-2 shrink-0 text-[12.5px] font-semibold text-danger"
                >
                  취소
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest run src/pages/AdminPush.screen.test.tsx`
Expected: PASS

- [ ] **Step 9: AdminPosts에 탭 추가** — `src/pages/AdminPosts.tsx`

import 추가 `import AdminPush from './AdminPush'`. state 추가(다른 useState 옆):
```tsx
  const [tab, setTab] = useState<'posts' | 'push'>('posts')
```
`<h1 …>오늘의 경제 올리기</h1>`를 바꾸고 그 아래 탭을 둔다:
```tsx
          <h1 className="text-[22px] font-extrabold text-ink">
            {tab === 'posts' ? '오늘의 경제 올리기' : '알림 보내기'}
          </h1>
          {admin && (
            <div role="tablist" className="mt-3 flex gap-2">
              {(['posts', 'push'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${tab === t ? 'bg-ink text-white' : 'bg-white text-sub'}`}
                >
                  {t === 'posts' ? '오늘의 경제' : '알림 보내기'}
                </button>
              ))}
            </div>
          )}
```
`<div className="space-y-4">`를 감싸는 `{admin && (`를 `{admin && tab === 'posts' && (`로 바꾸고, 그 블록이 끝난 바로 뒤에:
```tsx
        {admin && tab === 'push' && <AdminPush />}
```

- [ ] **Step 10: 빌드 후 커밋**

Run: `npm run build`
Expected: 통과 (기존 `AdminPosts.screen.test.tsx`도 그대로 — 기본 탭이 오늘의 경제)

```bash
git add src/lib/pushAdmin.ts src/lib/pushAdmin.test.ts src/pages/AdminPush.tsx src/pages/AdminPush.screen.test.tsx src/pages/AdminPosts.tsx
git commit -m "관리자 > 알림 보내기: 공지·홍보 지금/예약, 홍보는 (광고)·수신 거부 미리보기와 21~08시 예약 막기, 대상 수 확인

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/lib/pushAdmin.ts src/lib/pushAdmin.test.ts src/pages/AdminPush.tsx src/pages/AdminPush.screen.test.tsx src/pages/AdminPosts.tsx
```

---

### Task 7: 개인정보처리방침 + 안드로이드 권한·아이콘·버전 1.2.0

**Files:**
- Modify: `src/pages/Legal.tsx`, `public/privacy.html`
- Create: `src/pages/Legal.privacy.test.tsx`
- Modify: `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle`, `scripts/android-release.sh`, `android/BUILD.md`
- Create: `android/app/src/main/res/drawable/ic_stat_moabuli.xml`

**Interfaces:**
- Consumes (Task 3·4): 채널 `moabuli`, 아이콘 이름 `ic_stat_moabuli`
- Produces: versionName `1.2.0` / versionCode `3`, 산출물 `play-store/build/moabuli-1.2.0.{aab,apk}`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/pages/Legal.privacy.test.tsx` (앱 안 방침과 정적 사본이 같이 고쳐졌는지)

```tsx
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Legal from './Legal'

const html = readFileSync(join(process.cwd(), 'public/privacy.html'), 'utf-8')

describe('개인정보처리방침 — 푸시 알림 (2026-11-04)', () => {
  it('앱 안 방침에 푸시 토큰·FCM 국외 이전·광고 알림 동의·철회가 있다', () => {
    render(
      <MemoryRouter initialEntries={['/legal/privacy']}>
        <Routes>
          <Route path="/legal/:doc" element={<Legal />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('시행일 2026-11-04')).toBeInTheDocument()
    const text = document.body.textContent ?? ''
    expect(text).toContain('푸시 토큰')
    expect(text).toContain('Firebase Cloud Messaging')
    expect(text).toContain('(광고)')
    expect(text).toContain('설정 > 알림')
  })

  it('정적 사본(public/privacy.html)도 같이 고쳤다', () => {
    expect(html).toContain('시행일 2026-11-04')
    expect(html).toContain('푸시 토큰')
    expect(html).toContain('Firebase Cloud Messaging')
    expect(html).toContain('(광고)')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/Legal.privacy.test.tsx`
Expected: FAIL — `시행일 2026-11-04`를 못 찾음

- [ ] **Step 3: `src/pages/Legal.tsx` 수정**

머리 주석에 한 줄 추가하고 시행일을 바꾼다:
```tsx
// 2026-11-04: 앱 푸시 알림 — 푸시 토큰·알림 설정 수집, Google(FCM) 국외 이전, 광고성 알림 동의·철회
// 개인정보처리방침을 고치면 public/privacy.html(구글 플레이 제출용 정적 사본)도 같이 고친다.
const UPDATED = '2026-11-04'
```

1항 `<p>`의 앱 음성 입력 문장 뒤(`…글자로 바뀐 내용만 담깁니다.` 다음)에:
```tsx
        <br />· 앱 알림(선택): 알림을 켠 경우 알림 수신용 기기 식별값(푸시 토큰)과 알림 설정(종류별
        켜기·끄기, 리마인더 시각, 광고성 알림 동의·철회 시각)
```

2항의 `[선택] 마케팅 정보 수신` `<p>` 바로 뒤에:
```tsx
      <p>
        <b>[선택] 앱 알림</b> — 앱에서 알림을 켠 이용자에게 기록 리마인더·정산일·오늘의 경제·공지
        알림을 보내드립니다. 설정 &gt; 알림에서 종류별로 끌 수 있습니다.
        <br />
        <b>[선택] 결영이네 소식·혜택(광고) 알림</b> — 따로 동의한 이용자에게만 보내며, 제목 앞에
        "(광고)"를 붙이고 수신 거부 방법(설정 &gt; 알림)을 함께 적습니다. 밤 9시부터 다음 날 아침
        8시까지는 보내지 않습니다. 설정 &gt; 알림에서 언제든 철회할 수 있고, 동의·철회 결과는 그
        자리에서 알려 드립니다. 동의한 날부터 2년마다 계속 받을지 다시 여쭙니다. 보유 기간: 푸시
        토큰은 로그아웃·회원 탈퇴 시까지, 알림 설정은 회원 탈퇴 시까지.
      </p>
```

4항 목록의 Anthropic 항목 끝(`…모델 학습에 이용되지 않음).`) 뒤에:
```tsx
        <br />· <b>Google LLC</b> (미국) — Firebase Cloud Messaging, 앱 푸시 알림 발송. 이전 방법·시점:
        알림을 보낼 때 정보통신망을 통한 전송. 이전 항목: 푸시 토큰, 알림 제목·내용. 보유·이용 기간:
        발송 처리 기간.
```

- [ ] **Step 4: `public/privacy.html`을 같은 내용으로 수정**

머리 주석 `2026-11-01: …` 아래에 `2026-11-04: 앱 푸시 알림(푸시 토큰·알림 설정, Google FCM 국외 이전, 광고성 알림 동의·철회) 추가, 시행일 갱신.` 한 줄.
`<p class="cap">시행일 2026-11-01 · …` → `시행일 2026-11-04`.
1항 `<p>`의 음성 입력 문장 뒤(`</p>` 앞)에:
```html
        <br />
        · 앱 알림(선택): 알림을 켠 경우 알림 수신용 기기 식별값(푸시 토큰)과 알림 설정(종류별 켜기·끄기,
        리마인더 시각, 광고성 알림 동의·철회 시각)
```
2항 마케팅 `<p>` 뒤에:
```html
      <p>
        <b>[선택] 앱 알림</b> — 앱에서 알림을 켠 이용자에게 기록 리마인더·정산일·오늘의 경제·공지 알림을
        보내드립니다. 설정 &gt; 알림에서 종류별로 끌 수 있습니다.<br />
        <b>[선택] 결영이네 소식·혜택(광고) 알림</b> — 따로 동의한 이용자에게만 보내며, 제목 앞에 "(광고)"를
        붙이고 수신 거부 방법(설정 &gt; 알림)을 함께 적습니다. 밤 9시부터 다음 날 아침 8시까지는 보내지
        않습니다. 설정 &gt; 알림에서 언제든 철회할 수 있고, 동의·철회 결과는 그 자리에서 알려 드립니다.
        동의한 날부터 2년마다 계속 받을지 다시 여쭙니다. 보유 기간: 푸시 토큰은 로그아웃·회원 탈퇴 시까지,
        알림 설정은 회원 탈퇴 시까지.
      </p>
```
4항 Anthropic 항목 끝 뒤(`</p>` 앞)에:
```html
        <br />
        · <b>Google LLC</b> (미국) — Firebase Cloud Messaging, 앱 푸시 알림 발송. 이전 방법·시점: 알림을 보낼
        때 정보통신망을 통한 전송. 이전 항목: 푸시 토큰, 알림 제목·내용. 보유·이용 기간: 발송 처리 기간.
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/pages/Legal.privacy.test.tsx`
Expected: PASS

- [ ] **Step 6: 알림 아이콘** — `android/app/src/main/res/drawable/ic_stat_moabuli.xml` (`public/favicon.svg`의 '부부 동전 코'를 흰색 한 가지로. 안드로이드가 색을 입힌다)

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- 알림 줄 아이콘 — 모아불리 '부부 동전 코'(public/favicon.svg)를 흰색 한 가지로 (2026-11-04) -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="100"
    android:viewportHeight="100">
    <path
        android:fillColor="#FFFFFFFF"
        android:fillType="evenOdd"
        android:pathData="M9.5,50a23.5,23.5 0,1 0,47 0a23.5,23.5 0,1 0,-47 0Z M14.5,50a18.5,18.5 0,1 0,37 0a18.5,18.5 0,1 0,-37 0Z M24.8,50a3.2,5.6 0,1 0,6.4 0a3.2,5.6 0,1 0,-6.4 0Z M34.8,50a3.2,5.6 0,1 0,6.4 0a3.2,5.6 0,1 0,-6.4 0Z" />
    <path
        android:fillColor="#FFFFFFFF"
        android:fillType="evenOdd"
        android:pathData="M43.5,50a23.5,23.5 0,1 0,47 0a23.5,23.5 0,1 0,-47 0Z M58.8,50a3.2,5.6 0,1 0,6.4 0a3.2,5.6 0,1 0,-6.4 0Z M68.8,50a3.2,5.6 0,1 0,6.4 0a3.2,5.6 0,1 0,-6.4 0Z" />
</vector>
```

- [ ] **Step 7: AndroidManifest** — `android/app/src/main/AndroidManifest.xml`

`<application …>` 바로 안(첫 자식, `<activity>` 앞)에:
```xml
        <!-- 푸시 알림 (2026-11-04): 알림 줄 아이콘·기본 채널(앱이 'moabuli' 채널을 만든다) -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_stat_moabuli" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="moabuli" />
        <!-- 알림을 켜기 전에는 토큰을 만들지 않는다 (register()를 부를 때 만든다) -->
        <meta-data
            android:name="firebase_messaging_auto_init_enabled"
            android:value="false" />
```
`<!-- 음성으로 소비 기록 -->` 권한 아래에:
```xml
    <!-- 푸시 알림 (Android 13+) -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <!-- Firebase가 끼워 넣을 수 있는 광고 ID 권한은 뺀다 (광고 ID를 쓰지 않는다) -->
    <uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove" />
```

- [ ] **Step 8: 버전** — `android/app/build.gradle`의 `defaultConfig`:
```gradle
        versionCode 3
        versionName "1.2.0"
```

- [ ] **Step 9: 릴리스 스크립트** — `scripts/android-release.sh`

`EXPECTED=…` 줄 아래에 추가:
```bash
VERSION="$(sed -nE 's/^[[:space:]]*versionName "([^"]+)".*/\1/p' "$ROOT/android/app/build.gradle")"
[ -n "$VERSION" ] || { echo "build.gradle에서 versionName을 못 찾았어요"; exit 1; }
# 푸시 알림(2026-11-04)은 google-services.json이 있어야 된다. MOABULI_NO_FIREBASE=1은 매니페스트 확인용 빌드(올리지 않는다)
NO_FIREBASE="${MOABULI_NO_FIREBASE:-}"
if [ ! -s "$ROOT/android/app/google-services.json" ] && [ "$NO_FIREBASE" != "1" ]; then
  echo "android/app/google-services.json이 없어요 — 푸시 알림이 안 되는 앱이 나와요 (Firebase 콘솔에서 받아 넣기)"
  exit 1
fi
```
`== 3/4` 검사의 `[ "$fail" = 0 ] || exit 1` 바로 앞에:
```bash
grep -q "android.permission.POST_NOTIFICATIONS" "$MANIFEST" || { echo "  [실패] POST_NOTIFICATIONS 권한이 없어요"; fail=1; }
```
`== 4/4`의 `mkdir -p "$OUT_DIR"`부터 끝까지를:
```bash
if [ "$NO_FIREBASE" = "1" ]; then
  echo "  확인용 빌드(MOABULI_NO_FIREBASE=1)라 복사하지 않아요 — Play Console에 올리면 안 돼요"
  exit 0
fi
mkdir -p "$OUT_DIR"
cp "$AAB" "$OUT_DIR/moabuli-$VERSION.aab"
cp "$APK" "$OUT_DIR/moabuli-$VERSION.apk"
echo "  복사 완료: $(cd "$OUT_DIR" && pwd)/moabuli-$VERSION.{aab,apk}"
```

- [ ] **Step 10: `android/BUILD.md` 수정** — 순서 목록 앞에 "0. `android/app/google-services.json`이 없으면 멈춰요(푸시 알림용, Firebase 콘솔에서 받아요). 매니페스트만 확인하려면 `MOABULI_NO_FIREBASE=1 npm run android:release` — 이 빌드는 복사하지 않고, 올리면 안 돼요." 추가. 3번 검사 설명 끝에 "`POST_NOTIFICATIONS` 권한이 없어도 실패해요" 추가. 결과물의 복사본 이름을 `moabuli-<versionName>.aab`, `.apk`로, "새 버전을 낼 때"에서 "복사 파일 이름은 …에서 바꿔요" 문장을 "복사 파일 이름은 versionName을 따라가요"로 바꾼다.

- [ ] **Step 11: 매니페스트 확인 빌드**

Run: `bash -n scripts/android-release.sh && MOABULI_NO_FIREBASE=1 npm run android:release`
(`google-services.json`이 이미 있으면 `npm run android:release`만.)
Expected: `BUILD SUCCESSFUL`, `금지 항목 없음`, `android:versionCode="3"`, `android:versionName="1.2.0"`, 서명 SHA-256 일치.
금지 항목(`AD_ID`·`ADSERVICES` 등)에 걸리면: `android/app/build/outputs/logs/manifest-merger-release-report.txt`에서 어느 라이브러리가 넣었는지 찾아 `AndroidManifest.xml`에 같은 이름으로 `tools:node="remove"` 항목을 더하고(권한이면 `<uses-permission … tools:node="remove" />`, `<property>`면 `<property android:name="…" tools:node="remove" />`를 `<application>` 안에) 다시 빌드한다.

- [ ] **Step 12: 빌드 후 커밋**

Run: `npm run build`
Expected: 통과

```bash
git add src/pages/Legal.tsx public/privacy.html src/pages/Legal.privacy.test.tsx android/app/src/main/AndroidManifest.xml android/app/build.gradle android/app/src/main/res/drawable/ic_stat_moabuli.xml scripts/android-release.sh android/BUILD.md
git commit -m "개인정보처리방침에 앱 알림(푸시 토큰·FCM 국외 이전·광고 알림 동의) 추가, 시행일 2026-11-04 / 안드로이드 1.2.0(vc3): 알림 권한·아이콘·기본 채널

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/pages/Legal.tsx public/privacy.html src/pages/Legal.privacy.test.tsx android/app/src/main/AndroidManifest.xml android/app/build.gradle android/app/src/main/res/drawable/ic_stat_moabuli.xml scripts/android-release.sh android/BUILD.md
```

---

### Task 8: 콘솔·배포·폰 확인 — **컨트롤러와 결영이 한다 (구현 서브에이전트에게 맡기지 않는다)**

**Files:** `android/app/google-services.json`(신규, 콘솔에서 받음). 나머지는 콘솔·Supabase·Play Console·폰.

시크릿 값은 어떤 단계에서도 대화·로그·커밋에 출력하지 않는다. 명령은 값을 변수·파일로만 넘긴다.

- [ ] **Step 1: Firebase (결영과 크롬에서)** — Firebase 콘솔 > 프로젝트 추가 > 기존 GCP 프로젝트 `striped-century-502904-r5` 선택(애널리틱스 끔). 안드로이드 앱 추가: 패키지 `moabuli.app`, 닉네임 "모아불리". `google-services.json` 받아 `android/app/google-services.json`에 둔다.

```bash
git add android/app/google-services.json
git commit -m "Firebase 앱 설정(google-services.json, 공개 설정값) — 푸시 알림용

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- android/app/google-services.json
```

- [ ] **Step 2: 서비스 계정 키 → Supabase 시크릿** — Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성. 파일은 레포 밖 `가계부/android-signing/firebase-push-sa.json`에 저장. 셸에서 값을 출력하지 않고 넣는다:

```bash
SA_FILE="/c/Users/recei/OneDrive/문서/Claude/Projects/가계부/android-signing/firebase-push-sa.json"
npx supabase secrets set --project-ref sygmpteafxlrhfbipkep FIREBASE_SERVICE_ACCOUNT="$(cat "$SA_FILE")" >/dev/null && echo "FIREBASE_SERVICE_ACCOUNT 설정됨"
S="$(openssl rand -hex 32)"
npx supabase secrets set --project-ref sygmpteafxlrhfbipkep PUSH_CRON_SECRET="$S" >/dev/null && echo "PUSH_CRON_SECRET 설정됨"
printf '%s' "$S" > "/c/Users/recei/OneDrive/문서/Claude/Projects/가계부/android-signing/push-cron-secret.txt"; unset S
```
(Supabase CLI 로그인이 안 돼 있으면 결영이 대시보드 > Edge Functions > Secrets에서 직접 넣는다. `android-signing/`은 레포 밖이다.)

- [ ] **Step 3: DB** — Supabase 대시보드 > SQL Editor에서 `supabase/push.sql` 전체 실행. 확인:
```sql
select table_name from information_schema.tables where table_schema = 'public' and table_name in ('push_tokens','notification_prefs','push_log','push_campaigns');
```
→ 4행.

- [ ] **Step 4: 함수 배포** (`_shared`를 같이 묶어야 해서 CLI로)

```bash
npx supabase functions deploy push-dispatch --no-verify-jwt --project-ref sygmpteafxlrhfbipkep
```
확인: 헤더 없이 부르면 403.
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://sygmpteafxlrhfbipkep.supabase.co/functions/v1/push-dispatch
```
→ `403`

- [ ] **Step 5: 크론** — 결영이 SQL Editor에서 `android-signing/push-cron-secret.txt`의 값을 넣어 `select vault.create_secret('<값>', 'push_cron_secret');` 한 번 실행(값을 대화에 붙여넣지 않는다). 그다음 `supabase/push-cron.sql` 전체 실행. 5분 뒤:
```sql
select status_code, content from net._http_response order by created desc limit 3;
```
→ `200`, `{"ok":true,…}`

- [ ] **Step 6: 웹 배포** — 결영 확인 후 `git push origin main` (Cloudflare Pages). 웹은 바뀌는 게 설정 > 알림 안내 한 줄뿐이고, 1.1.0 앱은 `pushSupported()` false라 그대로다.

- [ ] **Step 7: 앱 빌드** — `npm run android:release` → `play-store/build/moabuli-1.2.0.aab`. 내부 테스트 트랙에 올리고 결영 폰에 업데이트.

- [ ] **Step 8: 폰 확인 체크리스트 (결영과 함께, 결과 기록)**
  1. 홈 처음 안내가 한 번 뜬다 → [알림 받기] → OS 권한 창 → 허용. 광고 체크했으면 "○월 ○일 소식·혜택 알림 수신에 동의하셨어요".
  2. `select count(*) from push_tokens;` 가 1 이상.
  3. 관리자 > 알림 보내기 > 공지 [지금 보내기] → "○명에게 보내요" → 5분 안에 수신, 누르면 고른 화면이 열린다.
  4. 설정 > 알림에서 리마인더 시각을 2분 뒤 가장 가까운 30분 칸으로(또는 SQL로 `update notification_prefs set reminder_time = '<지금+몇 분, 30분 칸>'`) → 수신, 누르면 소비 기록 화면.
  5. 오늘 기록을 하나 남긴 뒤 같은 시험 → 안 온다.
  6. 홍보 예약에서 21:00 이후 시각이 목록에 없다. 미리보기에 "(광고)"·"수신 거부: 설정 > 알림".
  7. 광고 스위치 켜기·끄기 → "○○년 ○월 ○일 수신 동의(거부)가 처리됐어요".
  8. 로그아웃 → `push_tokens`에서 그 폰 토큰이 사라진다.
  9. 웹(크롬 moabuli.com) 설정 > 알림: "알림은 모아불리 앱에서 받을 수 있어요" 한 줄, 다른 화면 변화 없음.

- [ ] **Step 9: Play Console 데이터 보안** — "기기 또는 기타 ID"(목적: 앱 기능, 광고 또는 마케팅 — 알림) 추가. 1.1.0 때의 마이크(오디오) 항목과 함께 저장. 개인정보처리방침 URL은 그대로(`moabuli.com/privacy.html`, 시행일 2026-11-04 확인).

- [ ] **Step 10: 프로덕션 (결영 확인 후)** — 1.0.0 승인 뒤, 1.1.0 대신 1.2.0을 바로 낼지 결영이 고른다. 출시 노트 예:

```
<ko-KR>
기록할 시간, 정산하는 날, 오늘의 경제를 알림으로 알려드려요.
설정 > 알림에서 종류별로 켜고 끌 수 있어요.
</ko-KR>
```

---

## 설계 대조 (자체 점검)

| 설계 항목 | Task |
|---|---|
| 테이블 4개·RLS·운영자만 캠페인 | 1 |
| pg_cron 5분 + 비밀 헤더, Verify JWT 끔 | 1(SQL), 3(헤더 검사), 8(실행·배포) |
| 규칙: 리마인더·정산·3일 뒤·오늘의 경제·공지·홍보·재확인, 5분 창, 중복 방지, 부부·여러 폰 | 2, 3 |
| FCM v1·서비스 계정·무효 토큰 삭제·종류별 try·캠페인 fail_count | 3 |
| 앱 토큰 upsert·알림 탭 이동·google-services.json | 4, 8 |
| 처음 안내(7일, 광고 체크 기본 해제, 동의 안내) | 4 |
| 설정 > 알림(스위치·30분 시각·광고 처리 결과·OS 권한 꺼짐·웹 한 줄) | 5 |
| 관리자 알림 보내기(종류·제목·내용·화면·지금/예약·광고 미리보기·21~08 막기·○명·목록·취소) | 6 |
| 개인정보처리방침 두 곳·시행일 | 7 |
| POST_NOTIFICATIONS·아이콘·기본 채널 "모아불리 알림"·1.2.0(vc3) | 4(채널 생성), 7 |
| 시크릿은 Secrets에만 | 8 |
| 폰 내부 테스트·데이터 보안·프로덕션 | 8 |
