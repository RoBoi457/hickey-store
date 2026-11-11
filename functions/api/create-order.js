import { getAuthenticatedUser, sameOriginRequest } from "../_auth.js";

const catalog = {
  "kathor-clock": { name: "The Rohtak Clock", price: 5 },
  pda: { name: "PDA Tree", price: 5 },
  "submit-mode": { name: "Spiderman", price: 5 },
  "clock-it": { name: "Clock It", price: 5 },
  "coke-paglu": { name: "Diet Coke Paglu", price: 5 },
  cooks: { name: "Cooked", price: 5 },
  "proxy-pass": { name: "Claude Proxt mt laga", price: 5 },
  baddie: { name: "The Baddie Club", price: 5 },
  "kathor-land": { name: "Kathor Land", price: 5 },
  nonchalant: { name: "Non Chalant", price: 5 },
  "two-friends": { name: "Couple Design", price: 5 },
  "campus-cat-nap": { name: "CAT Whore", price: 5 },
  "clinger-cat-club": { name: "Gingerrrrr", price: 5 },
  "same-old-day": { name: "Same Old Day", price: 5 }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function onRequestPost({ request, env }) {
  if (!sameOriginRequest(request)) return json({ error: "Request origin could not be verified." }, 403);
  if (!env.DB) {
    return json({ error: "Order storage is not connected yet. Bind the Cloudflare D1 database before enabling checkout." }, 503);
  }
  let user;
  try { user = await getAuthenticatedUser(request, env); }
  catch { return json({ error: "Account storage is not ready. Apply migration 0004_customer_accounts.sql." }, 503); }
  if (!user) return json({ error: "Sign in before placing an order." }, 401);

  const razorpayKeyId = typeof env.RAZORPAY_KEY_ID === "string" ? env.RAZORPAY_KEY_ID.trim() : "";
  const razorpayKeySecret = typeof env.RAZORPAY_KEY_SECRET === "string" ? env.RAZORPAY_KEY_SECRET.trim() : "";
  if (!razorpayKeyId || !razorpayKeySecret) {
    return json({ error: "Razorpay is not configured. Add a Key ID and encrypted Key Secret for this Cloudflare environment." }, 503);
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

  const customerName = (typeof body.customerName === "string" && body.customerName.trim()) ? body.customerName.trim() : (typeof user.name === "string" ? user.name.trim() : "");
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
  const authorization = "Basic " + btoa(razorpayKeyId + ":" + razorpayKeySecret);
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
        notes: { order_ref: receipt, customer_email: user.email }
      })
    });
  } catch {
    return json({ error: "Razorpay is temporarily unavailable. Please try again." }, 502);
  }

  const razorpayOrder = await razorpayResponse.json().catch(() => null);
  if (!razorpayResponse.ok) {
    const gatewayError = razorpayOrder?.error;
    const gatewayCode = typeof gatewayError?.code === "string" ? gatewayError.code.slice(0, 80) : "";
    const description = typeof gatewayError?.description === "string"
      ? gatewayError.description.replaceAll("\r", " ").replaceAll("\n", " ").trim().slice(0, 180)
      : "";
    if (razorpayResponse.status === 401 || razorpayResponse.status === 403) {
      return json({
        error: "Razorpay rejected the API credentials. Ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET match and come from the same Razorpay account and mode.",
        gateway_status: razorpayResponse.status,
        gateway_code: gatewayCode || null
      }, 401);
    }
    return json({ error: description || "Razorpay could not create the payment order.", gateway_code: gatewayCode || null }, 500);
  }
  if (!razorpayOrder?.id || razorpayOrder.amount !== amount || razorpayOrder.currency !== "INR") {
    return json({ error: "Razorpay returned an invalid order. Please try again." }, 500);
  }

  try {
    await env.DB.prepare(
      "INSERT INTO orders (order_ref, items_json, amount_rupees, customer_name, customer_email, user_id, delivery_address, phone, payment_method, status, razorpay_order_id) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)"
    ).bind(
      receipt, JSON.stringify(savedItems), totalRupees, customerName, user.email, user.id,
      address, phone, razorpayOrder.id
    ).run();
  } catch {
    return json({ error: "The order could not be saved. Ensure migration 0004_customer_accounts.sql has been applied." }, 500);
  }

  return json({
    order_id: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    receipt,
    key_id: razorpayKeyId
  });
}
