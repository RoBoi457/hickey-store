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
  if (!env.DB_STAGING) return json({ error: "Database not connected." }, 503);

  try {
    await env.DB_STAGING.prepare(
      "CREATE TABLE IF NOT EXISTS customer_messages (" +
      "id TEXT PRIMARY KEY, " +
      "user_id TEXT, " +
      "name TEXT NOT NULL DEFAULT '', " +
      "email TEXT NOT NULL DEFAULT '', " +
      "type TEXT NOT NULL DEFAULT 'suggestion', " +
      "message TEXT NOT NULL, " +
      "quantity TEXT DEFAULT '', " +
      "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    ).run();

    try {
      await env.DB_STAGING.prepare("DELETE FROM customer_messages WHERE datetime(created_at) < '2026-11-11 17:30:00'").run();
    } catch (_) {}

    const result = await env.DB_STAGING.prepare(
      "SELECT id, user_id, name, email, type, message, quantity, created_at FROM customer_messages " +
      "WHERE datetime(created_at) >= '2026-11-11 17:30:00' " +
      "ORDER BY created_at DESC LIMIT 200"
    ).all();

    return json({ messages: result.results || [] });
  } catch (err) {
    return json({ error: "Could not load messages." }, 500);
  }
}
