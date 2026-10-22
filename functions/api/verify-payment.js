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
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return json({ verified: false, error: "Razorpay keys are not configured." }, 503);
  }
  if (!env.DB) {
    return json({ verified: false, error: "Order storage is not connected." }, 503);
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

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.RAZORPAY_KEY_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = toHex(new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(orderId + "|" + paymentId))));
  if (!sameHex(expected, signature.toLowerCase())) {
    return json({ verified: false, error: "Razorpay could not verify this payment." }, 400);
  }

  const authorization = "Basic " + btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
  try {
    const [orderResponse, paymentResponse] = await Promise.all([
      fetch("https://api.razorpay.com/v1/orders/" + encodeURIComponent(orderId), { headers: { Authorization: authorization } }),
      fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(paymentId), { headers: { Authorization: authorization } })
    ]);
    const [order, payment] = await Promise.all([orderResponse.json(), paymentResponse.json()]);
    const isPaid = orderResponse.ok && paymentResponse.ok && order.status === "paid" && order.amount_paid === order.amount &&
      payment.status === "captured" && payment.order_id === order.id && payment.amount === order.amount;
    if (!isPaid) return json({ verified: false, error: "The payment is not captured yet." }, 402);
    const storedOrder = await env.DB.prepare("SELECT order_ref, amount_rupees, status FROM orders WHERE razorpay_order_id = ?")
      .bind(order.id)
      .first();
    if (!storedOrder || storedOrder.amount_rupees * 100 !== order.amount) {
      return json({ verified: false, error: "This payment does not match a Hickey order." }, 400);
    }
    await env.DB.prepare("UPDATE orders SET status = 'paid', razorpay_payment_id = ? WHERE razorpay_order_id = ? AND status = 'pending'")
      .bind(payment.id, order.id)
      .run();
    return json({ verified: true, orderRef: storedOrder.order_ref, orderId: order.id, paymentId: payment.id });
  } catch {
    return json({ verified: false, error: "We couldn't confirm payment status. Please contact Hickey before retrying." }, 502);
  }
}
