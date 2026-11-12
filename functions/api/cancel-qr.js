function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.DB_STAGING) {
    return json({ cancelled: false, error: "Payment services are not configured." }, 503);
  }
  let body;
  try { body = await request.json(); } catch { return json({ cancelled: false, error: "Invalid payment QR." }, 400); }
  const qrCodeId = body?.qrCodeId;
  if (typeof qrCodeId !== "string" || !/^qr_[A-Za-z0-9]+$/.test(qrCodeId)) {
    return json({ cancelled: false, error: "This payment QR is invalid." }, 400);
  }

  const authorization = "Basic " + btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
  try {
    const qrResponse = await fetch("https://api.razorpay.com/v1/payments/qr_codes/" + encodeURIComponent(qrCodeId), { headers: { Authorization: authorization } });
    const qr = await qrResponse.json();
    const orderRef = qr.notes?.order_ref;
    if (!qrResponse.ok || qr?.type !== "upi_qr" || typeof orderRef !== "string") return json({ cancelled: false, error: "We couldn't identify this payment QR." }, 400);
    const storedOrder = await env.DB_STAGING.prepare("SELECT order_ref, status FROM orders WHERE order_ref = ? AND payment_method = 'upi'")
      .bind(orderRef)
      .first();
    if (!storedOrder) return json({ cancelled: false, error: "This QR is not attached to a Hickey order." }, 404);
    if (storedOrder.status === "paid") return json({ cancelled: false, paid: true, orderRef });
    if (storedOrder.status !== "pending") return json({ cancelled: true });

    const paymentsResponse = await fetch("https://api.razorpay.com/v1/payments/qr_codes/" + encodeURIComponent(qrCodeId) + "/payments?count=100", { headers: { Authorization: authorization } });
    const payments = await paymentsResponse.json();
    const capturedPayment = payments.items?.find((payment) =>
      payment.status === "captured" && payment.captured === true && payment.method === "upi" &&
      payment.amount === qr.payment_amount && payment.amount_refunded === 0
    );
    if (capturedPayment) {
      await env.DB_STAGING.prepare("UPDATE orders SET status = 'paid', razorpay_payment_id = ? WHERE order_ref = ? AND status = 'pending'")
        .bind(capturedPayment.id, orderRef)
        .run();
      return json({ cancelled: false, paid: true, orderRef });
    }

    if (!paymentsResponse.ok) return json({ cancelled: false, error: "We couldn't safely close this QR. Please try again." }, 502);
    if (qr.status === "active") {
      const closeResponse = await fetch("https://api.razorpay.com/v1/payments/qr_codes/" + encodeURIComponent(qrCodeId) + "/close", {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/json" }
      });
      if (!closeResponse.ok) return json({ cancelled: false, error: "Razorpay couldn't close this QR. Please try again." }, 502);
    }
    await env.DB_STAGING.prepare("UPDATE orders SET status = 'cancelled' WHERE order_ref = ? AND status = 'pending'")
      .bind(orderRef)
      .run();
    return json({ cancelled: true });
  } catch {
    return json({ cancelled: false, error: "Payment service is temporarily unavailable." }, 502);
  }
}
