import { sendOrderEmail } from "../_email.js";
import { getAuthenticatedUser, sameOriginRequest } from "../_auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function onRequestPost({ request, env }) {
  if (!sameOriginRequest(request)) return json({ verified: false, error: "Request origin could not be verified." }, 403);
  if (!env.DB_STAGING) return json({ verified: false, error: "Order storage is not connected." }, 503);
  let user;
  try { user = await getAuthenticatedUser(request, env); }
  catch { return json({ verified: false, error: "Account storage is not ready. Apply migration 0004_customer_accounts.sql." }, 503); }
  if (!user) return json({ verified: false, error: "Sign in to confirm this payment." }, 401);

  const razorpayKeyId = typeof env.RAZORPAY_TEST_KEY_ID === "string" ? env.RAZORPAY_TEST_KEY_ID.trim() : "";
  const razorpayKeySecret = typeof env.RAZORPAY_TEST_KEY_SECRET === "string" ? env.RAZORPAY_TEST_KEY_SECRET.trim() : "";
  if (!razorpayKeyId || !razorpayKeySecret) {
    return json({ verified: false, error: "Razorpay keys are not configured." }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ verified: false, error: "Invalid payment response." }, 400);
  }

  const orderId = body?.razorpay_order_id;
  const paymentId = body?.razorpay_payment_id;
  const signature = body?.razorpay_signature;
  if (![orderId, paymentId, signature].every((value) => typeof value === "string" && value.length > 0)) {
    return json({ verified: false, error: "The payment response is incomplete." }, 400);
  }

  try {
    const storedOrder = await env.DB_STAGING.prepare("SELECT order_ref, amount_rupees, status, razorpay_order_id, razorpay_payment_id, user_id FROM orders WHERE razorpay_order_id = ?")
      .bind(orderId)
      .first();
    if (!storedOrder) return json({ verified: false, error: "This payment does not match a Hickey order." }, 400);
    if (storedOrder.user_id !== user.id) return json({ verified: false, error: "This order belongs to a different account." }, 403);
    if (storedOrder.status === "paid") {
      if (storedOrder.razorpay_payment_id === paymentId) {
        return json({ verified: true, orderRef: storedOrder.order_ref, orderId, paymentId });
      }
      return json({ verified: false, error: "This order has already been paid using a different payment." }, 409);
    }
    if (storedOrder.status !== "pending") {
      return json({ verified: false, error: "This order is no longer awaiting payment." }, 409);
    }

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(razorpayKeySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const message = storedOrder.razorpay_order_id + "|" + paymentId;
    const expected = toHex(new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message))));
    if (!sameHex(expected, signature.toLowerCase())) {
      return json({ verified: false, error: "Razorpay could not verify this payment." }, 400);
    }

    const authorization = "Basic " + btoa(razorpayKeyId + ":" + razorpayKeySecret);
    const [orderResponse, paymentResponse] = await Promise.all([
      fetch("https://api.razorpay.com/v1/orders/" + encodeURIComponent(orderId), { headers: { Authorization: authorization } }),
      fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(paymentId), { headers: { Authorization: authorization } })
    ]);
    const [order, payment] = await Promise.all([
      orderResponse.json().catch(() => null),
      paymentResponse.json().catch(() => null)
    ]);

    const isPaid = orderResponse.ok && paymentResponse.ok &&
      order.id === storedOrder.razorpay_order_id &&
      order.receipt === storedOrder.order_ref &&
      order.status === "paid" &&
      order.amount_paid === order.amount &&
      order.amount === storedOrder.amount_rupees * 100 &&
      payment.status === "captured" &&
      payment.captured === true &&
      payment.order_id === order.id &&
      payment.amount === order.amount;
    if (!isPaid) {
      return json({ verified: false, error: "Razorpay has not confirmed a captured payment for this order yet." }, 402);
    }

    try {
      await env.DB_STAGING.prepare("ALTER TABLE orders ADD COLUMN email_sent INTEGER NOT NULL DEFAULT 0").run();
      await env.DB_STAGING.prepare("ALTER TABLE orders ADD COLUMN email_sent_at TEXT").run();
      await env.DB_STAGING.prepare("ALTER TABLE orders ADD COLUMN email_body TEXT").run();
    } catch (_) {}

    await env.DB_STAGING.prepare("UPDATE orders SET status = 'paid', payment_method = ?, razorpay_payment_id = ? WHERE razorpay_order_id = ? AND status = 'pending'")
      .bind(payment.method || "unknown", payment.id, order.id)
      .run();
    const confirmed = await env.DB_STAGING.prepare("SELECT id, order_ref, status, customer_name, customer_email, razorpay_payment_id FROM orders WHERE razorpay_order_id = ?")
      .bind(order.id)
      .first();

    // Trigger automated order confirmation email dispatch:
    try {
      const emailResult = await sendOrderEmail(env, confirmed);
      if (emailResult.sent) {
        await env.DB_STAGING.prepare("UPDATE orders SET email_sent = 1, email_sent_at = ?, email_body = ? WHERE id = ?")
          .bind(emailResult.sent_at || new Date().toISOString(), emailResult.body || "", confirmed.id)
          .run();
      }
    } catch (_) {}
    if (confirmed?.status !== "paid" || confirmed.razorpay_payment_id !== payment.id) {
      return json({ verified: false, error: "We couldn't save the payment confirmation. Please contact Hickey before retrying." }, 500);
    }

    return json({ verified: true, orderRef: confirmed.order_ref, orderId: order.id, paymentId: payment.id, method: payment.method || "unknown" });
  } catch {
    return json({ verified: false, error: "We couldn't confirm payment status. Please contact Hickey before retrying." }, 502);
  }
}
