// 푸시 알림 보내기 — Supabase Edge Function (2026-11-04, 설계: docs/superpowers/specs/2026-11-04-push-notifications-design.md)
//
// pg_cron이 5분마다 부른다(supabase/push-cron.sql). 무엇을 보낼지는 _shared/pushRules.ts가 정하고,
// 여기서는 DB에서 재료를 모으고 → push_log에 먼저 적고(유일 키) 들어간 것만 보낸다 → 무효 토큰을 지운다.
// 그래서 두 번 돌아도 한 번만 간다. FCM 일시 오류는 다시 보내지 않는다(중복보다 누락이 낫다).
// 한 사람·한 종류가 실패해도 나머지는 계속 보낸다. 예외가 난 캠페인은 마감하지 않고 다음 실행이 이어 보낸다.
//
// 설정(Secrets): FIREBASE_SERVICE_ACCOUNT(서비스 계정 JSON 전체), PUSH_CRON_SECRET
// 배포할 때 'Verify JWT'는 끈다 — pg_cron은 로그인 토큰 대신 x-push-secret 헤더를 보낸다.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createFcmSender, runPool, sendToUser, type ServiceAccount } from "../_shared/fcm.ts";
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
const PAGE = 1000; // PostgREST 한 번에 돌려주는 최대 줄 수
const IN_CHUNK = 100; // .in() 목록 길이(주소가 길어지지 않게)
const SEND_CONCURRENCY = 10;

// deno-lint-ignore no-explicit-any
type Rows = any[];
// deno-lint-ignore no-explicit-any
type Q = PromiseLike<{ data: any[] | null; error: unknown }>;

/** 1000줄 한계를 넘어 끝까지 읽는다. make는 범위만 바꿔 같은(정렬된) 질의를 만든다 */
async function fetchAll(what: string, make: (from: number, to: number) => Q): Promise<Rows> {
  const out: Rows = [];
  for (let from = 0; ; from += PAGE) {
    const r = await make(from, from + PAGE - 1);
    if (r.error) throw new Error(`${what}: ${JSON.stringify(r.error)}`);
    const data = r.data ?? [];
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

/** 값 목록을 IN_CHUNK씩 나눠 각각 끝까지 읽는다 */
async function fetchAllIn(what: string, ids: string[], make: (chunk: string[], from: number, to: number) => Q): Promise<Rows> {
  const out: Rows = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    out.push(...(await fetchAll(what, (from, to) => make(chunk, from, to))));
  }
  return out;
}

/** 비밀값을 시간 차 없이 비교한다(SHA-256 다이제스트를 XOR) */
async function secretMatches(given: string | null): Promise<boolean> {
  if (!SECRET || given === null) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(SECRET)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (!(await secretMatches(req.headers.get("x-push-secret")))) {
    return new Response("unauthorized", { status: 401 });
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "");
  } catch {
    console.error("[push-dispatch] FIREBASE_SERVICE_ACCOUNT를 못 읽었어요");
    return Response.json({ ok: false, reason: "no service account" }, { status: 500 });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();
  const today = kstParts(now);

  try {
    // 1) 토큰이 있는 사람만 대상
    const tokensByUser = new Map<string, string[]>();
    for (const t of await fetchAll("push_tokens", (f, to) =>
      db.from("push_tokens").select("token, user_id").order("token").range(f, to))) {
      tokensByUser.set(t.user_id, [...(tokensByUser.get(t.user_id) ?? []), t.token]);
    }
    const userIds = [...tokensByUser.keys()];

    const campaigns: DueCampaign[] = (
      await fetchAll("push_campaigns", (f, to) =>
        db
          .from("push_campaigns")
          .select("id, kind, title, body, path, send_at")
          .eq("status", "scheduled")
          .lte("send_at", now.toISOString())
          .order("id")
          .range(f, to))
    ).map((c) => ({ id: c.id, kind: c.kind, title: c.title, body: c.body, path: c.path, sendAt: c.send_at }));

    // 2) 설정·집·오늘 기록·정산·보낸 기록
    const prefs: PushPrefs[] = [];
    const members: Record<string, PushMember> = {};
    const confessedToday = new Set<string>();
    const closedLedgers = new Set<string>();
    const sentLog = new Set<string>();

    if (userIds.length) {
      for (const p of await fetchAllIn("notification_prefs", userIds, (ids, f, to) =>
        db.from("notification_prefs").select("*").in("user_id", ids).order("user_id").range(f, to))) {
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

      const memberRows = await fetchAllIn("household_members", userIds, (ids, f, to) =>
        db.from("household_members").select("user_id, household_id, member_no").in("user_id", ids).order("user_id").range(f, to));
      const hids = [...new Set(memberRows.map((m) => m.household_id as string))];
      const startDay = new Map<string, number>();
      if (hids.length) {
        for (const h of await fetchAllIn("households", hids, (ids, f, to) =>
          db.from("households").select("id, month_start_day").in("id", ids).order("id").range(f, to))) {
          startDay.set(h.id, h.month_start_day ?? 1);
        }
        // 오늘(한국) 00:00 ~ 내일 00:00 사이에 그 사람 번호로 남은 기록
        const dayStart = new Date(kstInstant(today.date, "00:00")).toISOString();
        const dayEnd = new Date(kstInstant(shiftDate(today.date, 1), "00:00")).toISOString();
        for (const c of await fetchAllIn("confessions", hids, (ids, f, to) =>
          db
            .from("confessions")
            .select("household_id, member_no")
            .in("household_id", ids)
            .gte("created_at", dayStart)
            .lt("created_at", dayEnd)
            .order("id")
            .range(f, to))) {
          confessedToday.add(`${c.household_id}:${c.member_no}`);
        }
        // 정산 대상 달은 앞 달(오늘 정산일) 또는 앞앞 달(3일 전이 지난달 말 정산일)
        for (const l of await fetchAllIn("ledgers", hids, (ids, f, to) =>
          db
            .from("ledgers")
            .select("household_id, ym")
            .in("household_id", ids)
            .in("ym", [shiftYm(today.ym, -1), shiftYm(today.ym, -2)])
            .eq("closed", true)
            .order("household_id")
            .order("ym")
            .range(f, to))) {
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

      // 규칙이 sentLog에서 보는 것만 읽는다(전부 읽으면 사람이 늘수록 무겁다).
      //  - 오늘 보낸 것(reminder·settle·settle_again·news)과, settle_again이 되짚는 3일 전 settle → 최근 4일
      //  - 이번 달 promo_reconfirm (refKey = reconfirm:YYYY-MM, 4일보다 오래됐을 수 있다)
      //  - 지금 보낼 차례인 캠페인(refKey = campaign:id, 며칠 미뤄졌을 수 있다)
      // 위 셋에 들지 않는 기록은 규칙이 보지 않는다. 같은 키가 두 번 가는 건 push_log 유일 키가 막는다.
      const addLog = (rows: Rows) => {
        for (const l of rows) sentLog.add(logKey(l.user_id, l.kind, l.ref_key));
      };
      const logCols = "user_id, kind, ref_key";
      addLog(
        await fetchAll("push_log recent", (f, to) =>
          db
            .from("push_log")
            .select(logCols)
            .gte("sent_at", new Date(now.getTime() - 4 * DAY).toISOString())
            .order("user_id")
            .order("kind")
            .order("ref_key")
            .range(f, to)),
      );
      addLog(
        await fetchAll("push_log reconfirm", (f, to) =>
          db
            .from("push_log")
            .select(logCols)
            .eq("kind", "promo_reconfirm")
            .eq("ref_key", `reconfirm:${today.ym}`)
            .order("user_id")
            .range(f, to)),
      );
      addLog(
        await fetchAllIn("push_log campaigns", campaigns.map((c) => `campaign:${c.id}`), (keys, f, to) =>
          db
            .from("push_log")
            .select(logCols)
            .in("kind", ["notice", "promo"])
            .in("ref_key", keys)
            .order("user_id")
            .order("kind")
            .order("ref_key")
            .range(f, to)),
      );
    }

    const todayPosts: TodayPost[] = (
      await fetchAll("posts", (f, to) =>
        db
          .from("posts")
          .select("id, kind, title, created_at")
          .eq("post_date", today.date)
          .in("kind", ["news", "market"])
          .order("id")
          .range(f, to))
    ).map((p) => ({ id: p.id, kind: p.kind, title: p.title, createdAt: p.created_at }));

    // 3) 규칙 → 보내기
    const plan = planPushes({ now, prefs, members, confessedToday, closedLedgers, todayPosts, campaigns, sentLog });
    const sender = createFcmSender(sa);

    // push_log를 쓰기 전에 OAuth 토큰부터 받아 본다. 안 되면 아무것도 적지 않는다(다음 실행이 그대로 다시 시도)
    if (plan.sends.length) {
      try {
        await sender.ready();
      } catch (err) {
        console.error("[push-dispatch] OAuth 토큰을 못 받았어요:", err instanceof Error ? err.message : "unknown");
        return Response.json({ ok: false, reason: "oauth" }, { status: 500 });
      }
    }

    const byKind = new Map<PushKind, PlannedPush[]>();
    for (const p of plan.sends) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p]);

    const stats = new Map<string, { sent: number; fail: number }>();
    const failedCampaigns = new Set<string>(); // 예외가 난 캠페인은 마감하지 않는다
    const summary: Record<string, { sent: number; errors: number; invalid: number; failed: number }> = {};

    const sendOne = async (p: PlannedPush) => {
      const logged = (
        await db
          .from("push_log")
          .upsert(
            { user_id: p.userId, kind: p.kind, ref_key: p.refKey },
            { onConflict: "user_id,kind,ref_key", ignoreDuplicates: true },
          )
          .select("user_id")
      );
      if (logged.error) throw new Error(`push_log insert: ${JSON.stringify(logged.error)}`);
      if (!(logged.data ?? []).length) return; // 다른 실행이 이미 보냈다

      const sum = (summary[p.kind] ??= { sent: 0, errors: 0, invalid: 0, failed: 0 });
      const r = await sendToUser(sender, tokensByUser.get(p.userId) ?? [], p);
      sum.errors += r.errors;
      sum.invalid += r.invalid.length;
      if (r.invalid.length) {
        const del = await db.from("push_tokens").delete().in("token", r.invalid);
        if (del.error) console.error("[push-dispatch] 무효 토큰 삭제 실패", JSON.stringify(del.error));
      }
      const ok = r.ok > 0;
      if (ok) sum.sent++;
      else sum.failed++;
      if (p.campaignId) {
        const s = stats.get(p.campaignId) ?? { sent: 0, fail: 0 };
        if (ok) s.sent++;
        else s.fail++;
        stats.set(p.campaignId, s);
      }
      if (p.kind === "promo_reconfirm" && ok) {
        // 이게 안 되면 다음 달에 같은 재확인이 또 간다 → 반드시 남기고 로그로 알린다
        const up = await db.from("notification_prefs").update({ promo_reconfirm_sent_at: now.toISOString() }).eq("user_id", p.userId);
        if (up.error) console.error("[push-dispatch] promo_reconfirm_sent_at 갱신 실패", JSON.stringify(up.error));
      }
    };

    // 종류별로 차례로, 한 종류 안에서는 SEND_CONCURRENCY명씩 동시에. 한 사람이 실패해도 나머지는 계속 간다
    for (const [kind, list] of byKind) {
      await runPool(list, SEND_CONCURRENCY, sendOne, (p, err) => {
        console.error(`[push-dispatch] ${kind}`, err instanceof Error ? err.message : "unknown");
        if (p.campaignId) failedCampaigns.add(p.campaignId);
      });
    }

    // 4) 캠페인 마감 (받을 사람이 0명이어도). 예외가 난 캠페인은 scheduled로 둔다 → 다음 실행이 이어 보낸다
    let closed = 0;
    for (const id of plan.campaignsDone) {
      if (failedCampaigns.has(id)) continue;
      const s = stats.get(id) ?? { sent: 0, fail: 0 };
      const up = await db
        .from("push_campaigns")
        .update({ status: "sent", sent_count: s.sent, fail_count: s.fail })
        .eq("id", id)
        .eq("status", "scheduled");
      if (up.error) console.error("[push-dispatch] 캠페인 마감 실패", JSON.stringify(up.error));
      else closed++;
    }

    return Response.json({ ok: true, sent: summary, campaigns: closed, campaignsDeferred: failedCampaigns.size });
  } catch (err) {
    console.error("[push-dispatch]", err instanceof Error ? err.message : "unknown");
    return Response.json({ ok: false }, { status: 500 });
  }
});
