import { sendOrderEmail } from "../../_email.js";

const SUPPORT_EMAIL = "support.hickey@gmail.com";

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

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPendingFollowupEmail(customerName) {
  const name = customerName && customerName.trim() ? customerName.trim() : "there";
  const subject = "Your Hickey order is still waiting!";

  const text = `Hey ${name},

Looks like you left a little Hickey behind!

You recently started placing an order on Hickey, but it seems your payment didn't go through or wasn't completed.

No worries, it happens! Whether you got distracted or ran into a payment hiccup, your order is still waiting for you.

Still thinking about it? Your Hickey picks are just one step away!

Complete Your Order: https://gethickey.in/

If you've already completed the payment, you can safely ignore this email.

Need a hand? We're just an email away at support@gethickey.in.

Happy shopping!

Team Hickey
gethickey.in`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px 20px;color:#151d30;line-height:1.65;font-size:15px;">
  <p>Hey ${escapeHtml(name)},</p>
  <p>Looks like you left a little Hickey behind!</p>
  <p>You recently started placing an order on Hickey, but it seems your payment didn't go through or wasn't completed.</p>
  <p>No worries, it happens! Whether you got distracted or ran into a payment hiccup, your order is still waiting for you.</p>
  <p>Still thinking about it? Your Hickey picks are just one step away!</p>
  <p style="margin:24px 0;">
    <a href="https://gethickey.in/" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#151d30;color:#ffffff;font-weight:700;text-decoration:none;font-size:14px;">Complete Your Order</a>
  </p>
  <p style="color:#647084;font-size:13.5px;">If you've already completed the payment, you can safely ignore this email.</p>
  <p>Need a hand? We're just an email away at <a href="mailto:support@gethickey.in" style="color:#1a56db;text-decoration:underline;">support@gethickey.in</a>.</p>
  <p style="margin-top:22px;">Happy shopping!</p>
  <p style="margin:0;"><b>Team Hickey</b><br><a href="https://gethickey.in/" style="color:#1a56db;text-decoration:none;">gethickey.in</a></p>
</div>`;

  return { subject, text, html };
}

export async function onRequestPost({ request, env }) {
  if (!isAuthorized(request, env)) return json({ error: "Admin access required." }, 401);
  if (!env.DB) return json({ error: "Database not connected." }, 503);

  const resendKey = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  if (!resendKey) return json({ error: "RESEND_API_KEY is not configured." }, 503);
  const from = typeof env.RESEND_FROM_EMAIL === "string" && env.RESEND_FROM_EMAIL.trim()
    ? env.RESEND_FROM_EMAIL.trim()
    : "Team Hickey <support@gethickey.in>";

  let body = {};
  try { body = await request.json(); } catch (_) {}
  const isAuto = Boolean(body?.auto);

  try { await env.DB.prepare("ALTER TABLE orders ADD COLUMN pending_followup_sent INTEGER NOT NULL DEFAULT 0").run(); } catch (_) {}
  try { await env.DB.prepare("ALTER TABLE orders ADD COLUMN pending_followup_sent_at TEXT").run(); } catch (_) {}
  try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS pending_followup_runs (id INTEGER PRIMARY KEY CHECK (id = 1), last_run_at TEXT)").run(); } catch (_) {}

  if (isAuto) {
    const recent = await env.DB.prepare(
      "SELECT last_run_at FROM pending_followup_runs WHERE id = 1 AND datetime(last_run_at) > datetime('now', '-20 hours')"
    ).first();
    if (recent?.last_run_at) {
      return json({ ok: true, skipped: true, lastRunAt: recent.last_run_at, sentCount: 0, reconciledPaid: 0, errors: [] });
    }
  }

  const keyId = typeof env.RAZORPAY_KEY_ID === "string" ? env.RAZORPAY_KEY_ID.trim() : "";
  const keySecret = typeof env.RAZORPAY_KEY_SECRET === "string" ? env.RAZORPAY_KEY_SECRET.trim() : "";
  const rzpAuth = keyId && keySecret ? "Basic " + btoa(keyId + ":" + keySecret) : "";

  const targetOrderRef = typeof body?.orderRef === "string" ? body.orderRef.trim() : "";

  const pendingRes = targetOrderRef
    ? await env.DB.prepare(
        "SELECT id, order_ref, customer_name, customer_email, amount_rupees, razorpay_order_id, created_at " +
        "FROM orders WHERE order_ref = ? AND status = 'pending' AND customer_email LIKE '%@%'"
      ).bind(targetOrderRef).all()
    : await env.DB.prepare(
        "SELECT id, order_ref, customer_name, customer_email, amount_rupees, razorpay_order_id, created_at " +
        "FROM orders " +
        "WHERE status = 'pending' " +
        "AND COALESCE(pending_followup_sent, 0) = 0 " +
        "AND customer_email LIKE '%@%' " +
        "AND datetime(created_at) >= '2026-11-11 17:30:00' " +
        "AND datetime(created_at) <= datetime('now', '-1 day') " +
        "AND NOT EXISTS (" +
        "  SELECT 1 FROM orders p " +
        "  WHERE LOWER(p.customer_email) = LOWER(orders.customer_email) " +
        "  AND p.status = 'paid' " +
        "  AND datetime(p.created_at) >= datetime(orders.created_at)" +
        ") " +
        "ORDER BY created_at ASC LIMIT 200"
      ).all();

  let sentCount = 0;
  let reconciledPaid = 0;
  const errors = [];
  const seenEmails = new Set();

  for (const order of pendingRes.results || []) {
    const email = String(order.customer_email || "").trim().toLowerCase();
    if (!email || seenEmails.has(email)) continue;

    // Verify with Razorpay first so we never send a pending reminder if payment actually captured
    if (rzpAuth && order.razorpay_order_id) {
      try {
        const rzpRes = await fetch("https://api.razorpay.com/v1/orders/" + encodeURIComponent(order.razorpay_order_id) + "/payments", {
          headers: { Authorization: rzpAuth, Accept: "application/json" }
        });
        if (rzpRes.ok) {
          const rzpData = await rzpRes.json().catch(() => null);
          const payments = Array.isArray(rzpData?.items) ? rzpData.items : [];
          const expectedPaise = Number(order.amount_rupees) * 100;
          const captured = payments.find((p) => p?.status === "captured" && Number(p?.amount) === expectedPaise);
          if (captured) {
            await env.DB.prepare(
              "UPDATE orders SET status = 'paid', payment_method = 'razorpay', razorpay_payment_id = ? WHERE id = ?"
            ).bind(String(captured.id || ""), order.id).run();
            try {
              const emailResult = await sendOrderEmail(env, order);
              if (emailResult.sent) {
                await env.DB.prepare("UPDATE orders SET email_sent = 1, email_sent_at = ?, email_body = ? WHERE id = ?")
                  .bind(emailResult.sent_at || new Date().toISOString(), emailResult.body || "", order.id)
                  .run();
              }
            } catch (_) {}
            reconciledPaid += 1;
            seenEmails.add(email);
            continue;
          }
        }
      } catch (_) {}
    }

    const message = buildPendingFollowupEmail(order.customer_name);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email], reply_to: SUPPORT_EMAIL, ...message })
      });
      if (!res.ok) {
        errors.push(email + ": HTTP " + res.status);
        continue;
      }
      await env.DB.prepare(
        "UPDATE orders SET pending_followup_sent = 1, pending_followup_sent_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(order.id).run();
      sentCount += 1;
      seenEmails.add(email);
    } catch (err) {
      errors.push(email + ": " + (err?.message || "Send failed"));
    }
  }

  return json({ ok: true, sentCount, reconciledPaid, errors });
}
