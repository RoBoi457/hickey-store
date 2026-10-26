import { getAuthenticatedUser, jsonResponse, sameOriginRequest } from "../_auth.js";

const validProductIds = new Set([
  "kathor-clock", "pda", "submit-mode", "clock-it", "coke-paglu", "cooks",
  "proxy-pass", "baddie", "kathor-land", "nonchalant", "two-friends",
  "campus-cat-nap", "clinger-cat-club"
]);

export async function onRequestGet({ request, env }) {
  if (!env.DB) return jsonResponse({ error: "Account storage is not connected. Apply the account migration to D1." }, 503);
  try {
    const user = await getAuthenticatedUser(request, env);
    if (!user) return jsonResponse({ error: "Sign in to view your basket." }, 401);
    const result = await env.DB.prepare(
      "SELECT product_id, quantity FROM cart_items WHERE user_id = ? ORDER BY product_id"
    ).bind(user.id).all();
    const items = Object.create(null);
    for (const row of result.results || []) items[row.product_id] = row.quantity;
    return jsonResponse({ items });
  } catch {
    return jsonResponse({ error: "Your basket storage is not ready. Apply migration 0004_customer_accounts.sql." }, 503);
  }
}

export async function onRequestPut({ request, env }) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: "Request origin could not be verified." }, 403);
  if (!env.DB) return jsonResponse({ error: "Account storage is not connected. Apply the account migration to D1." }, 503);
  let body;
  try {
    if (Number(request.headers.get("Content-Length") || 0) > 12000) return jsonResponse({ error: "Request is too large." }, 413);
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid basket data." }, 400);
  }
  if (!body || typeof body.items !== "object" || Array.isArray(body.items) || body.items === null) {
    return jsonResponse({ error: "Invalid basket data." }, 400);
  }

  const entries = Object.entries(body.items);
  if (entries.length > 20) return jsonResponse({ error: "Your basket has too many products." }, 400);
  const validItems = [];
  for (const [productId, quantity] of entries) {
    if (!validProductIds.has(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return jsonResponse({ error: "One of the basket items is invalid." }, 400);
    }
    validItems.push([productId, quantity]);
  }

  try {
    const user = await getAuthenticatedUser(request, env);
    if (!user) return jsonResponse({ error: "Sign in to save your basket." }, 401);
    const statements = [
      env.DB.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(user.id),
      ...validItems.map(([productId, quantity]) => env.DB.prepare(
        "INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?) " +
        "ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = excluded.quantity, updated_at = CURRENT_TIMESTAMP"
      ).bind(user.id, productId, quantity))
    ];
    await env.DB.batch(statements);
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "Your basket could not be saved. Apply migration 0004_customer_accounts.sql and try again." }, 503);
  }
}
