import { ensureAuthSchema } from "../../_auth.js";

const SUPPORT_EMAIL = "support.hickey@gmail.com";
const SUPPORT_CONTACTS = "Prabhu: +91 89564 42297 | Chaitanya: +91 87073 12125 | Rohan: +91 86608 50435 | Naman Navlani: +91 87707 94490 | Harjaap: +91 70153 38429 | support.hickey@gmail.com";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function isAuthorized(request, env) {
  const expected = typeof env.ADMIN_TOKEN === "string" ? env.ADMIN_TOKEN : "";
  const supplied = request.headers.get("Authorization") || "";
  const prefix = "Bearer ";
  if (expected.length < 32 || !supplied.startsWith(prefix)) return false;
  const actual = supplied.slice(prefix.length);
  let difference = expected.length ^ actual.length;
  for (let i = 0; i < Math.max(expected.length, actual.length); i += 1) {
    difference |= (expected.charCodeAt(i) || 0) ^ (actual.charCodeAt(i) || 0);
  }
  return difference === 0;
}

function buildNudgeEmail(hasCart) {
  const waiting = hasCart ? "Your hickey has been sitting here waiting for you. (We all saw that 🫣)" : "Your hickeys have been sitting here waiting for you. (We all saw that 🫣)";
  const conceal = hasCart ? "We've offered it a concealer. We've tried covering it. Nothing works." : "We've offered concealers. We've tried covering them. Nothing works.";
  const wantsYou = hasCart ? "Apparently, it only wants you." : "Apparently, they only want you.";
  const highlighted = hasCart ? "Your <b>hickey</b> has been sitting here waiting for you. (We all saw that 🫣)" : "Your <b>hickeys</b> have been sitting here waiting for you. (We all saw that 🫣)";
  const text = [
    "Hey!", "", waiting, "", conceal, "", wantsYou, "",
    "Come finish what you started and place your first order today. ❤️", "",
    "Get your hickey from here 👇🏻", "https://gethickey.in/", "",
    "Team Hickey", "", "Customer Support: " + SUPPORT_CONTACTS
  ].join("\n");
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px 20px;color:#151d30;line-height:1.65;font-size:15px;">
  <p>Hey!</p><p>${highlighted}</p><p>${conceal}</p><p>${wantsYou}</p>
  <p>Come finish what you started and place your first order today. ❤️</p>
  <p><b>Get your hickey from here 👇🏻</b><br><a href="https://gethickey.in/" style="color:#1a56db;text-decoration:underline;">https://gethickey.in/</a></p>
  <p><b>Team Hickey</b></p><hr style="border:none;border-top:1px solid #e8ecf2;margin:24px 0 14px;">
  <p style="font-size:12.5px;color:#767d8a;"><b>Customer Support:</b> ${SUPPORT_CONTACTS}</p>
</div>`;
  return { subject: "This is getting a little awkward...", text, html };
}

async function sendNudge(env, recipient, message) {
  const key = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  const from = typeof env.RESEND_FROM_EMAIL === "string" && env.RESEND_FROM_EMAIL.trim()
    ? env.RESEND_FROM_EMAIL.trim()
    : "Team Hickey <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [recipient], reply_to: SUPPORT_EMAIL, ...message })
  });
  if (!response.ok) throw new Error("Email provider returned HTTP " + response.status + ".");
}

export async function onRequestPost({ request, env }) {
  if (!isAuthorized(request, env)) return json({ error: "Admin access required." }, 401);
  if (!env.DB) return json({ error: "The account database is not connected." }, 503);
  try {
    await ensureAuthSchema(env);
    try { await env.DB.prepare("ALTER TABLE users ADD COLUMN last_nudged_at TEXT").run(); } catch (_) {}
    const users = await env.DB.prepare(
      "SELECT u.id, u.email, EXISTS(SELECT 1 FROM cart_items c WHERE c.user_id = u.id) AS has_cart " +
      "FROM users u WHERE u.email LIKE '%@%' " +
      "AND (u.last_nudged_at IS NULL OR datetime(u.last_nudged_at) <= datetime('now', '-6 days')) " +
      "AND NOT EXISTS (SELECT 1 FROM orders o WHERE (o.user_id = u.id OR LOWER(o.customer_email) = LOWER(u.email)) AND o.status = 'paid') " +
      "ORDER BY u.created_at ASC LIMIT 500"
    ).all();
    let cartNudges = 0;
    let browseNudges = 0;
    const errors = [];
    for (const user of users.results || []) {
      try {
        await sendNudge(env, user.email, buildNudgeEmail(Boolean(user.has_cart)));
        await env.DB.prepare("UPDATE users SET last_nudged_at = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();
        if (user.has_cart) cartNudges += 1;
        else browseNudges += 1;
      } catch (error) {
        if (errors.length < 20) errors.push(user.email + ": " + (error?.message || "Could not send email."));
      }
    }
    return json({ ok: true, sentCount: cartNudges + browseNudges, cartNudges, browseNudges, errors });
  } catch (error) {
    return json({ error: error?.message || "Could not send customer nudges." }, 500);
  }
}