import {
  getAuthenticatedUser, hashPassword, issueSession, jsonResponse,
  normalizeEmail, PASSWORD_ITERATIONS, randomHex, sameOriginRequest, validEmail
} from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: "Request origin could not be verified." }, 403);
  if (!env.DB) return jsonResponse({ error: "Account storage is not connected. Apply the account migration to D1." }, 503);

  let body;
  try {
    if (Number(request.headers.get("Content-Length") || 0) > 12000) return jsonResponse({ error: "Request is too large." }, 413);
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Enter a valid email and password." }, 400);
  }

  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!validEmail(email)) return jsonResponse({ error: "Enter a valid email address." }, 400);
  if (password.length < 12 || password.length > 128) {
    return jsonResponse({ error: "Use a password between 12 and 128 characters." }, 400);
  }

  try {
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) return jsonResponse({ error: "That email already has an account. Try signing in." }, 409);

    const id = crypto.randomUUID();
    const salt = randomHex(16);
    const passwordHash = await hashPassword(password, salt, PASSWORD_ITERATIONS);
    await env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, password_salt, password_iterations) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, email, passwordHash, salt, PASSWORD_ITERATIONS).run();

    const user = { id, email };
    const cookie = await issueSession(user, env);
    return jsonResponse({ user }, 201, { "Set-Cookie": cookie });
  } catch {
    return jsonResponse({ error: "We couldn't create the account. Apply migration 0004_customer_accounts.sql and try again." }, 500);
  }
}
