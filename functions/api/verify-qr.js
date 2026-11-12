function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.DB_STAGING) {
    return json({ verified: false, error: "Payment verification is not configured." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ verified: false, error: "Invalid QR payment check." }, 400);
  }
  const qrCodeId = body?.qrCodeId;
  if (typeof qrCodeId !== "string" || !/^qr_[A-Za-z0-9]+$/.test(qrCodeId)) {
    return json({ verified: false, error: "This payment QR is invalid." }, 400);
  }

  const authorization = "Basic " + btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
  try {
    const [qrResponse, paymentsResponse] = await Promise.all([
      fetch("https://api.razorpay.com/v1/payments/qr_codes/" + encodeURIComponent(qrCodeId), { headers: { Authorization: authorization } }),
      fetch("https://api.razorpay.com/v1/payments/qr_codes/" + encodeURIComponent(qrCodeId) + "/payments?count=100", { headers: { Authorization: authorization } })
    ]);
    const [qr, paymentList] = await Promise.all([qrResponse.json(), paymentsResponse.json()]);
    if (!qrResponse.ok || !paymentsResponse.ok || qr?.type !== "upi_qr") {
      return json({ verified: false, error: "We couldn't read this payment QR." }, 502);
    }

    const orderRef = qr.notes?.order_ref;
    if (typeof orderRef !== "string" || !orderRef.startsWith("HK-")) {
      return json({ verified: false, error: "This QR is not attached to a Hickey order." }, 400);
    }
    const storedOrder = await env.DB_STAGING.prepare("SELECT order_ref, amount_rupees, status FROM orders WHERE order_ref = ? AND payment_method = 'upi'")
      .bind(orderRef)
      .first();
    if (!storedOrder || storedOrder.amount_rupees * 100 !== qr.payment_amount) {
      return json({ verified: false, error: "The QR amount does not match the Hickey order." }, 400);
    }
    if (storedOrder.status === "paid") {
      return json({ verified: true, orderRef: storedOrder.order_ref });
    }
    if (storedOrder.status !== "pending") {
      return json({ verified: false, error: "This order is no longer awaiting payment." }, 409);
    }

    const capturedPayment = paymentList.items?.find((payment) =>
      payment.status === "captured" && payment.captured === true && payment.method === "upi" &&
      payment.amount === qr.payment_amount && payment.amount_refunded === 0
    );
    if (!capturedPayment) return json({ verified: false, pending: true });

    await env.DB_STAGING.prepare("UPDATE orders SET status = 'paid', razorpay_payment_id = ? WHERE order_ref = ? AND status = 'pending'")
      .bind(capturedPayment.id, storedOrder.order_ref)
      .run();
    const confirmed = await env.DB_STAGING.prepare("SELECT order_ref, status FROM orders WHERE order_ref = ?")
      .bind(storedOrder.order_ref)
      .first();
    if (confirmed?.status !== "paid") return json({ verified: false, error: "We couldn't save the payment confirmation. Please contact Hickey." }, 500);
    return json({ verified: true, orderRef: confirmed.order_ref });
  } catch {
    return json({ verified: false, error: "Payment status is temporarily unavailable. We’ll keep checking." }, 502);
  }
}
