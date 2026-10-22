const catalog = {
  "kathor-clock": { name: "Rohtak Standard Time", price: 299 },
  pda: { name: "P.D.A. (Please Don’t Ask)", price: 299 },
  "submit-mode": { name: "Just Put It In", price: 299 },
  "clock-it": { name: "Clock It!", price: 299 },
  "coke-paglu": { name: "Diet Coke Paglu Club", price: 299 },
  cooks: { name: "Cooks Club", price: 299 },
  "proxy-pass": { name: "Proxy Mat Laga!", price: 299 },
  baddie: { name: "Baddie Business", price: 299 },
  "kathor-land": { name: "Kathor Land", price: 299 },
  nonchalant: { name: "Nonchalant Energy", price: 299 },
  "two-friends": { name: "Underwater Besties", price: 499 },
  "campus-cat-nap": { name: "Cat-Whore Campus Nap", price: 299 },
  "clinger-cat-club": { name: "Clinger Cat Club", price: 299 }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return json({ error: "Razorpay is not configured yet. Add the Test Mode key ID and encrypted key secret in Cloudflare." }, 503);
  }
  if (!env.DB) {
    return json({ error: "Order storage is not connected yet. Bind the Cloudflare D1 database before enabling checkout." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid order details." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Invalid order details." }, 400);
  }

  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.replace(/[^+\d]/g, "") : "";
  if (customerName.length < 2 || customerName.length > 100 || address.length < 8 || address.length > 350 ||
      phone.replace(/\D/g, "").length < 10 || phone.length > 16) {
    return json({ error: "Please enter your name, a valid delivery address, and phone number." }, 400);
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 20) {
    return json({ error: "Your basket is empty or has too many line items." }, 400);
  }

  const savedItems = [];
  let totalRupees = 0;
  for (const item of body.items) {
    const product = catalog[item?.id];
    const quantity = Number(item?.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return json({ error: "One of the items in your basket is invalid." }, 400);
    }
    totalRupees += product.price * quantity;
    savedItems.push({ id: item.id, name: product.name, quantity, unitPrice: product.price });
  }

  const amount = totalRupees * 100;
  if (!Number.isSafeInteger(amount) || amount < 100) {
    return json({ error: "The order total must be at least ₹1.00." }, 400);
  }

  const receipt = "HK-" + crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  const authorization = "Basic " + btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
  let razorpayResponse;
  try {
    razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt,
        partial_payment: false,
        notes: { order_ref: receipt }
      })
    });
  } catch {
    return json({ error: "Razorpay is temporarily unavailable. Please try again." }, 502);
  }

  const razorpayOrder = await razorpayResponse.json().catch(() => null);
  if (!razorpayResponse.ok) {
    const description = razorpayOrder?.error?.description;
    if (razorpayResponse.status === 401 || razorpayResponse.status === 403) {
      return json({ error: "Razorpay rejected the API keys. Check that the Test Mode key ID and secret are a matching pair in Cloudflare." }, 401);
    }
    return json({ error: description || "Razorpay could not create the payment order." }, 502);
  }
  if (!razorpayOrder?.id || razorpayOrder.amount !== amount || razorpayOrder.currency !== "INR") {
    return json({ error: "Razorpay returned an invalid order. Please try again." }, 502);
  }

  try {
    await env.DB.prepare("INSERT INTO orders (order_ref, items_json, amount_rupees, customer_name, delivery_address, phone, payment_method, status, razorpay_order_id) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)")
      .bind(receipt, JSON.stringify(savedItems), totalRupees, customerName, address, phone, razorpayOrder.id)
      .run();
  } catch {
    return json({ error: "The order could not be saved. Please try again." }, 500);
  }

  return json({
    order_id: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    receipt,
    key_id: env.RAZORPAY_KEY_ID
  });
}
