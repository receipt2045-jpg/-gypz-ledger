// 텔레그램 → 모아불리 '오늘의 경제' — Supabase Edge Function (2026-10-05)
//
// 뉴스 봇이 보낸 글을 결영님이 텔레그램에서 검토한 뒤,
//   · 그 메시지에 "올려"라고 답장하거나
//   · 고친 글을 통째로 봇에게 보내면
// 정보 탭에 바로 올리고, 카톡방에 붙여넣을 글을 답장으로 돌려준다.
//
// 막는 것 두 겹:
//   1) 텔레그램이 붙여 보내는 비밀 단어(X-Telegram-Bot-Api-Secret-Token)가 맞는지
//   2) 보낸 사람이 결영님 대화방(TELEGRAM_ALLOWED_CHAT_ID)인지
//
// 설정(Secrets): TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ALLOWED_CHAT_ID
// 배포할 때 'Verify JWT'는 끈다 — 텔레그램은 로그인 토큰을 보내지 않는다.
import { createClient } from "npm:@supabase/supabase-js";

const BOT = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const ALLOWED = (Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID") ?? "").trim();

const POST_WORDS = /^(올려|올려줘|ㅇㅋ|ok|오케이|업로드)\s*$/i;

// ── 붙여넣은 글 나누기 — src/lib/posts.ts의 parsePasted와 같은 규칙 ──
type Kind = "news" | "market";
const pad = (n: number) => String(n).padStart(2, "0");

function seoulToday(): Date {
  // 서버는 UTC — 한국 날짜로 맞춘다
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function parsePasted(text: string) {
  const today = seoulToday();
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const skip = () => {
    while (lines.length && !lines[0].trim()) lines.shift();
  };
  skip();
  let postDate =
    `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
  const m = lines[0]?.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m && /^\s*\[/.test(lines[0])) {
    const mm = Number(m[1]);
    const dd = Number(m[2]);
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

function kakaoText(original: string) {
  return `${original.trim()}\n\n📱 지난 글은 모아불리에서 모아 봐요\nhttps://moabuli.com/info`;
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

  // 텔레그램은 200을 못 받으면 같은 메시지를 계속 다시 보낸다 — 실패해도 200으로 끝낸다
  try {
    const update = await req.json();
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

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
    const source = POST_WORDS.test(text) ? (msg.reply_to_message?.text ?? "") : text;
    if (!source || source.length < 20) {
      await reply(
        chatId,
        '올릴 글을 못 찾았어요. 뉴스 메시지에 "올려"라고 답장하거나, 고친 글을 통째로 보내 주세요.',
      );
      return new Response("ok");
    }

    const post = parsePasted(source);
    if (!post.body) {
      await reply(chatId, "본문이 비어 있어요. 제목 아래에 내용이 있는지 확인해 주세요.");
      return new Response("ok");
    }
    const { error } = await db.from("posts").insert(post);
    if (error) {
      await reply(chatId, `앱에 못 올렸어요: ${error.message}`);
      return new Response("ok");
    }

    const [, mm, dd] = post.post_date.split("-");
    await reply(
      chatId,
      `✅ 앱에 올렸어요 · ${Number(mm)}월 ${Number(dd)}일 ${post.title}\n잘못 올렸으면 "지워"라고 보내 주세요.\n\n아래 글을 길게 눌러 복사해서 카톡방에 붙여넣으세요 👇`,
      msg.message_id,
    );
    await reply(chatId, kakaoText(source));
  } catch (err) {
    console.error(err);
  }
  return new Response("ok");
});
