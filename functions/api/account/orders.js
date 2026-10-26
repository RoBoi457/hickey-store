import { getAuthenticatedUser, jsonResponse } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return jsonResponse({ error: "Account storage is not connected. Apply the account migration to D1." }, 503);
  try {
    const user = await getAuthenticatedUser(request, env);
    if (!user) return jsonResponse({ error: "Sign in to view your order history." }, 401);
    const result = await env.DB.prepare(
      "SELECT order_ref, created_at, items_json, amount_rupees, status " +
      "FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100"
    ).bind(user.id).all();
    const orders = (result.results || []).map((order) => {
      let items = [];
      try {
        const parsed = JSON.parse(order.items_json || "[]");
        if (Array.isArray(parsed)) items = parsed.map((item) => ({
          name: String(item.name || item.id || "Item"),
          quantity: Number(item.quantity) || 1
        }));
      } catch {}
      return {
        order_ref: order.order_ref,
        created_at: order.created_at,
        items,
        amount_rupees: order.amount_rupees,
        status: order.status
      };
    });
    return jsonResponse({ orders });
  } catch {
    return jsonResponse({ error: "Order history is not ready. Apply migration 0004_customer_accounts.sql." }, 503);
  }
}
