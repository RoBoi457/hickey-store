import {
  ensureAuthSchema, hashPassword, issueSession, jsonResponse,
  normalizeEmail, PASSWORD_ITERATIONS, randomHex, sameOriginRequest, validEmail
} from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: "Request origin could not be verified." }, 403);
  if (!env.DB_STAGING) return jsonResponse({ error: "Account storage is not connected in Cloudflare D1." }, 503);

  let body;
  try {
    if (Number(request.headers.get("Content-Length") || 0) > 12000) return jsonResponse({ error: "Request is too large." }, 413);
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Enter your name, email, and password." }, 400);
  }

  const rawName = typeof body?.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!validEmail(email)) return jsonResponse({ error: "Enter a valid email address." }, 400);
  const name = rawName.length >= 2 ? rawName.slice(0, 100) : email.split("@")[0];
  if (password.length < 6 || password.length > 128) {
    return jsonResponse({ error: "Use a password between 6 and 128 characters." }, 400);
  }

  try {
    await ensureAuthSchema(env);
    const existing = await env.DB_STAGING.prepare("SELECT id, password_hash FROM users WHERE email = ?").bind(email).first();
    if (existing) {
      return jsonResponse({ error: "That email already has an account. Try signing in instead." }, 409);
    }

    const id = crypto.randomUUID();
    const salt = randomHex(16);
    const passwordHash = await hashPassword(password, salt, PASSWORD_ITERATIONS);
    await env.DB_STAGING.prepare(
      "INSERT INTO users (id, name, email, password_hash, password_salt, password_iterations) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, name, email, passwordHash, salt, PASSWORD_ITERATIONS).run();

    const user = { id, name, email };
    const cookie = await issueSession(user, env);
    return jsonResponse({ user }, 201, { "Set-Cookie": cookie });
  } catch (err) {
    return jsonResponse({ error: "We couldn't create the account right now. Please try again." }, 500);
  }
}
