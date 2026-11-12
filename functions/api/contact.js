import { ensureAuthSchema, getAuthenticatedUser, jsonResponse, normalizeEmail, sameOriginRequest } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: "Request origin could not be verified." }, 403);
  if (!env.DB_STAGING) return jsonResponse({ error: "Feedback storage is not connected." }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Please enter your message." }, 400);
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length < 3 || message.length > 3000) {
    return jsonResponse({ error: "Please enter a message between 3 and 3000 characters." }, 400);
  }

  const user = await getAuthenticatedUser(request, env).catch(() => null);
  const name = (typeof body?.name === "string" && body.name.trim())
    ? body.name.trim().slice(0, 100)
    : (user?.name || "");
  const email = (typeof body?.email === "string" && body.email.trim())
    ? normalizeEmail(body.email).slice(0, 254)
    : (user?.email || "");
  const type = typeof body?.type === "string" ? body.type.slice(0, 40) : "suggestion";
  const quantity = typeof body?.quantity === "string" ? body.quantity.trim().slice(0, 50) : "";

  try {
    await ensureAuthSchema(env);
    const id = "msg_" + crypto.randomUUID();
    await env.DB_STAGING.prepare(
      "INSERT INTO customer_messages (id, user_id, name, email, type, message, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, user?.id || null, name, email, type, message, quantity).run();

    return jsonResponse({ ok: true, message: "Thank you! Your note has been received directly by our team." });
  } catch (err) {
    return jsonResponse({ error: "Could not save your message right now. Please try again." }, 500);
  }
}
