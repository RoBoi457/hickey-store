import { ensureAuthSchema } from "../../_auth.js";

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
  const max = Math.max(expected.length, actual.length);
  for (let i = 0; i < max; i += 1) {
    difference |= (expected.charCodeAt(i) || 0) ^ (actual.charCodeAt(i) || 0);
  }
  return difference === 0;
}

export async function onRequestGet({ request, env }) {
  if (!isAuthorized(request, env)) return json({ error: "Admin access required." }, 401);
  if (!env.DB) return json({ error: "The account database is not connected." }, 503);
  try {
    await ensureAuthSchema(env);
    const result = await env.DB.prepare(
      "SELECT users.id, users.email, users.created_at, users.last_nudged_at, users.last_nudge_type, " +
      "(SELECT COUNT(*) FROM orders WHERE orders.user_id = users.id) AS order_count " +
      "FROM users ORDER BY users.created_at DESC LIMIT 5000"
    ).all();
    return json({ customers: result.results || [] });
  } catch {
    return json({ error: "Customer accounts are not ready. Apply migration 0004_customer_accounts.sql." }, 503);
  }
}
