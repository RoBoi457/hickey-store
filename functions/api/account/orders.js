import { getAuthenticatedUser, jsonResponse, normalizeEmail, sameOriginRequest, validEmail } from "../../_auth.js";

function parseItems(itemsJson) {
  try {
    const parsed = JSON.parse(itemsJson || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 20).map((item) => ({
      name: String(item?.name || item?.id || "Hickey item").slice(0, 120),
      quantity: Math.max(1, Math.min(99, Number(item?.quantity) || 1)),
      unitPrice: Math.max(0, Number(item?.unitPrice) || 0)
    }));
  } catch {
    return [];
  }
}

async function reconcilePendingOrders(user, env) {
  const pending = await env.DB_STAGING.prepare(
    "SELECT id, order_ref, amount_rupees, razorpay_order_id, created_at FROM orders " +
    "WHERE (user_id = ? OR LOWER(customer_email) = LOWER(?)) AND status = 'pending' ORDER BY created_at DESC LIMIT 10"
  ).bind(user.id, user.email).all();
  const rows = pending.results || [];
  if (!rows.length) return;

  const keyId = typeof env.RAZORPAY_TEST_KEY_ID === "string" ? env.RAZORPAY_TEST_KEY_ID.trim() : "";
  const keySecret = typeof env.RAZORPAY_TEST_KEY_SECRET === "string" ? env.RAZORPAY_TEST_KEY_SECRET.trim() : "";
  const auth = keyId && keySecret ? "Basic " + btoa(keyId + ":" + keySecret) : "";

  for (const row of rows) {
    if (auth && row.razorpay_order_id) {
      try {
        const res = await fetch("https://api.razorpay.com/v1/orders/" + encodeURIComponent(row.razorpay_order_id) + "/payments", {
          headers: { Authorization: auth, Accept: "application/json" }
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const payments = Array.isArray(data?.items) ? data.items : [];
          const expectedPaise = Number(row.amount_rupees) * 100;
          const captured = payments.find((p) => p?.status === "captured" && Number(p?.amount) === expectedPaise);
          if (captured) {
            await env.DB_STAGING.prepare(
              "UPDATE orders SET status = 'paid', payment_method = 'razorpay', razorpay_payment_id = ? WHERE id = ?"
            ).bind(String(captured.id || ""), row.id).run();
            continue;
          }
          const hasFailed = payments.length > 0 && payments.every((p) => p?.status === "failed");
          const createdMs = Date.parse(String(row.created_at || "").replace(" ", "T") + "Z");
          const ageMinutes = Number.isFinite(createdMs) ? (Date.now() - createdMs) / 60000 : 0;
          if (hasFailed || ageMinutes > 15) {
            await env.DB_STAGING.prepare("UPDATE orders SET status = 'failed' WHERE id = ? AND status = 'pending'").bind(row.id).run();
          }
        }
      } catch {}
    }
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.DB_STAGING) return jsonResponse({ error: "Order storage is not connected." }, 503);
  let user;
  try {
    user = await getAuthenticatedUser(request, env);
  } catch {
    return jsonResponse({ error: "Account storage is not ready." }, 503);
  }
  if (!user) return jsonResponse({ error: "Sign in to view your orders." }, 401);

  try {
    await reconcilePendingOrders(user, env);
    const [paidResult, failedResult] = await Promise.all([
      env.DB_STAGING.prepare(
        "SELECT order_ref, items_json, amount_rupees, status, created_at FROM orders " +
        "WHERE (user_id = ? OR LOWER(customer_email) = LOWER(?)) AND status = 'paid' ORDER BY created_at DESC LIMIT 50"
      ).bind(user.id, user.email).all(),
      env.DB_STAGING.prepare(
        "SELECT order_ref, items_json, amount_rupees, status, created_at FROM orders " +
        "WHERE (user_id = ? OR LOWER(customer_email) = LOWER(?)) AND status IN ('failed', 'cancelled', 'expired') ORDER BY created_at DESC LIMIT 5"
      ).bind(user.id, user.email).all()
    ]);
    const orders = (paidResult.results || []).map((row) => ({
      order_ref: row.order_ref,
      items: parseItems(row.items_json),
      amount_rupees: row.amount_rupees,
      status: "paid",
      created_at: row.created_at
    }));
    const failed_orders = (failedResult.results || []).map((row) => ({
      order_ref: row.order_ref,
      items: parseItems(row.items_json),
      amount_rupees: row.amount_rupees,
      status: "failed",
      created_at: row.created_at
    }));
    return jsonResponse({ orders, failed_orders });
  } catch {
    return jsonResponse({ error: "Could not load your orders." }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: "Request origin could not be verified." }, 403);
  if (!env.DB_STAGING) return jsonResponse({ error: "Account storage is not connected." }, 503);
  const user = await getAuthenticatedUser(request, env).catch(() => null);
  if (!user) return jsonResponse({ error: "Sign in required." }, 401);

  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid account details." }, 400); }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body?.email);
  const phone = typeof body?.phone === "string" ? body.phone.replace(/[^+\d]/g, "").trim() : "";
  const address = typeof body?.address === "string" ? body.address.trim() : "";

  if (name.length < 2 || name.length > 100) return jsonResponse({ error: "Enter your name (2–100 characters)." }, 400);
  if (!validEmail(email)) return jsonResponse({ error: "Enter a valid email ID." }, 400);
  if (phone && (phone.replace(/\D/g, "").length < 10 || phone.length > 16)) {
    return jsonResponse({ error: "Enter a valid 10-digit phone number." }, 400);
  }
  if (address && (address.length < 4 || address.length > 350)) {
    return jsonResponse({ error: "Enter a valid delivery address." }, 400);
  }

  try {
    const conflict = await env.DB_STAGING.prepare("SELECT id FROM users WHERE email = ? AND id != ?").bind(email, user.id).first();
    if (conflict) return jsonResponse({ error: "That email ID is already used by another account." }, 409);

    await env.DB_STAGING.prepare(
      "UPDATE users SET name = ?, email = ?, phone = ?, delivery_address = ? WHERE id = ?"
    ).bind(name, email, phone, address, user.id).run();

    await env.DB_STAGING.prepare(
      "UPDATE orders SET customer_name = ?, customer_email = ? WHERE user_id = ?"
    ).bind(name, email, user.id).run();
    if (phone && address) {
      await env.DB_STAGING.prepare(
        "UPDATE orders SET phone = ?, delivery_address = ? WHERE user_id = ?"
      ).bind(phone, address, user.id).run();
    }

    return jsonResponse({ user: { id: user.id, name, email, phone, address } });
  } catch {
    return jsonResponse({ error: "Could not save your account details." }, 500);
  }
}
