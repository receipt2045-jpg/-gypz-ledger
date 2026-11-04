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
