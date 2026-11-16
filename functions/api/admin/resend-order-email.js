import { sendOrderEmail } from "../../_email.js";

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
  const max = Math.max(expected.length, actual.length);
  for (let i = 0; i < max; i += 1) {
    difference |= (expected.charCodeAt(i) || 0) ^ (actual.charCodeAt(i) || 0);
  }
  return difference === 0;
}

export async function onRequestPost({ request, env }) {
  if (!isAuthorized(request, env)) return json({ error: "Admin access required." }, 401);
  if (!env.DB) return json({ error: "Database not connected." }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const orderRef = typeof body?.orderRef === "string" ? body.orderRef.trim() : "";
  if (!orderRef) return json({ error: "Order reference is required." }, 400);

  const order = await env.DB.prepare(
    "SELECT id, order_ref, status, customer_name, customer_email, email_sent FROM orders WHERE order_ref = ?"
  ).bind(orderRef).first();

  if (!order) return json({ error: "Order not found." }, 404);
  if (order.status !== "paid") return json({ error: "Confirmation email can only be sent for paid orders." }, 400);

  const emailResult = await sendOrderEmail(env, order);
  if (!emailResult.sent) {
    return json({ error: emailResult.error || "Could not send email." }, 502);
  }

  await env.DB.prepare("UPDATE orders SET email_sent = 1, email_sent_at = ?, email_body = ? WHERE id = ?")
    .bind(emailResult.sent_at || new Date().toISOString(), emailResult.body || "", order.id)
    .run();

  return json({ ok: true, orderRef: order.order_ref, sentAt: emailResult.sent_at });
}
