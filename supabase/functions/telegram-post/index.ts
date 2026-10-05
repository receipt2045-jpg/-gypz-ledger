// 텔레그램 → 모아불리 '오늘의 경제' — Supabase Edge Function (2026-10-05, 2026-10-06 중계 자동 올리기)
//
// 두 군데서 글이 들어온다.
//   ① 중계(구글 Apps Script '텔레그램 중계')가 [텔레그램] 메일을 부부방에 넘길 때 같이 보낸다
//      → 아침 7시 30분 루틴 글이 검토 전에 먼저 앱에 올라가 있다. (본문 { relay: true, text })
//   ② 부부방에서 뉴스 메시지에 "올려"라고 답장하거나, 고친 글을 통째로 보낸다 (텔레그램 webhook)
// 같은 날짜·같은 제목 글이 이미 있으면 새로 만들지 않고 고친 글로 바꾼다.
//
// 막는 것: 텔레그램·중계 둘 다 비밀 단어(X-Telegram-Bot-Api-Secret-Token)가 맞아야 하고,
//         텔레그램은 허락된 대화방(TELEGRAM_ALLOWED_CHAT_ID)이어야 한다.
//
// 설정(Secrets): TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ALLOWED_CHAT_ID
// 배포할 때 'Verify JWT'는 끈다 — 텔레그램·중계는 로그인 토큰을 보내지 않는다.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js";

const BOT = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const ALLOWED = (Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID") ?? "").trim();

const POST_WORDS = /^(올려|올려줘|ㅇㅋ|ok|오케이|업로드)\s*$/i;

// ── 붙여넣은 글 나누기 — src/lib/posts.ts의 stripCommand·parsePasted와 같은 규칙 ──
type Kind = "news" | "market";
const pad = (n: number) => String(n).padStart(2, "0");

function seoulToday(): Date {
  // 서버는 UTC — 한국 날짜로 맞춘다
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

// 글 맨 앞·맨 끝의 짧은 부탁 한 줄("이렇게 바꿔서 올려")은 글이 아니다
const COMMAND_LINE = /^.{0,15}올려(줘|주세요)?[.!~ ]*$/;
function stripCommand(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim()) { end = i; break; }
  if (end >= 0 && COMMAND_LINE.test(lines[end].trim())) lines.splice(end, 1);
  const start = lines.findIndex((l) => l.trim());
  if (start >= 0 && COMMAND_LINE.test(lines[start].trim())) lines.splice(start, 1);
  return lines.join("\n").trim();
}

// 날짜 줄: "[결영이네] 10월 2일" 또는 "10월 2일"
const DATE_LINE = /^\s*(\[[^\]]*\]\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*$/;

function parsePasted(text: string) {
  const today = seoulToday();
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const skip = () => {
    while (lines.length && !lines[0].trim()) lines.shift();
  };
  skip();
  let postDate =
    `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
  const m = lines[0]?.match(DATE_LINE);
  if (m) {
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const year = mm > today.getUTCMonth() + 2 ? today.getUTCFullYear() - 1 : today.getUTCFullYear();
    postDate = `${year}-${pad(mm)}-${pad(dd)}`;
    lines.shift();
    skip();
  }
  const title = (lines.shift() ?? "").trim() || "오늘의 경제";
  skip();
  const body = lines.join("\n").trim();
  const kind: Kind = /증시|마감/.test(title) ? "market" : "news";
  return { kind, title, body, post_date: postDate };
}

/** 같은 날짜·같은 제목이 있으면 고친 글로 바꾸고, 없으면 새로 올린다 */
async function savePost(db: SupabaseClient, source: string) {
  const post = parsePasted(source);
  if (!post.body) return { ok: false as const, reason: "본문이 비어 있어요." };
  const { data: existing } = await db
    .from("posts")
    .select("id")
    .eq("post_date", post.post_date)
    .eq("title", post.title)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = existing
    ? await db.from("posts").update({ kind: post.kind, body: post.body }).eq("id", existing.id)
    : await db.from("posts").insert(post);
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const, replaced: !!existing, post };
}

function kakaoText(original: string) {
  return `${original.trim()}\n\n📱 지난 글은 모아불리에서 모아 봐요\nhttps://moabuli.com/news`;
}

async function reply(chatId: number, text: string, replyTo?: number) {
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(replyTo ? { reply_parameters: { message_id: replyTo } } : {}),
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  if (!SECRET || req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 텔레그램은 200을 못 받으면 같은 메시지를 계속 다시 보낸다 — 실패해도 200으로 끝낸다
  try {
    const update = await req.json();

    // ① 중계가 부부방에 넘기면서 같이 보낸 글 — 검토 전에 먼저 올려 둔다
    if (update.relay) {
      const source = stripCommand(String(update.text ?? ""));
      if (source.length < 20) return Response.json({ ok: false, reason: "글이 너무 짧아요." });
      const r = await savePost(db, source);
      return Response.json(r.ok ? { ok: true, replaced: r.replaced, title: r.post.title } : r);
    }

    // ② 텔레그램 부부방
    const msg = update.message ?? update.edited_message;
    if (!msg) return new Response("ok");
    const chatId: number = msg.chat.id;
    const text: string = (msg.text ?? msg.caption ?? "").trim();

    // 처음 설정할 때 — 내 대화방 번호를 알려준다
    if (text === "/id" || text === "/start") {
      await reply(chatId, `이 대화방 번호: ${chatId}\nSupabase의 TELEGRAM_ALLOWED_CHAT_ID에 넣어 주세요.`);
      return new Response("ok");
    }
    if (!ALLOWED || String(chatId) !== ALLOWED) return new Response("ok");

    // 방금 올린 글 지우기
    if (/^\/?(지워|삭제|undo)$/i.test(text)) {
      const { data } = await db
        .from("posts")
        .select("id,title")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) {
        await reply(chatId, "지울 글이 없어요.");
      } else {
        await db.from("posts").delete().eq("id", data.id);
        await reply(chatId, `🗑 지웠어요: ${data.title}`);
      }
      return new Response("ok");
    }

    // 답장으로 "올려" → 답장한 원래 글을 올린다. 아니면 보낸 글 자체를 올린다
    const source = stripCommand(POST_WORDS.test(text) ? (msg.reply_to_message?.text ?? "") : text);
    if (!source || source.length < 20) {
      await reply(
        chatId,
        '올릴 글을 못 찾았어요. 뉴스 메시지에 "올려"라고 답장하거나, 고친 글을 통째로 보내 주세요.',
      );
      return new Response("ok");
    }

    const r = await savePost(db, source);
    if (!r.ok) {
      await reply(chatId, `앱에 못 올렸어요: ${r.reason}`);
      return new Response("ok");
    }

    const [, mm, dd] = r.post.post_date.split("-");
    const head = r.replaced ? "✏️ 고친 글로 바꿨어요" : "✅ 앱에 올렸어요";
    await reply(
      chatId,
      `${head} · ${Number(mm)}월 ${Number(dd)}일 ${r.post.title}\n잘못 올렸으면 "지워"라고 보내 주세요.\n\n아래 글을 길게 눌러 복사해서 카톡방에 붙여넣으세요 👇`,
      msg.message_id,
    );
    await reply(chatId, kakaoText(source));
  } catch (err) {
    console.error(err);
  }
  return new Response("ok");
});
