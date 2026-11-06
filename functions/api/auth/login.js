import {
  ensureAuthSchema, hashPassword, issueSession, jsonResponse,
  normalizeEmail, PASSWORD_ITERATIONS, sameOriginRequest, equalHex
} from "../../_auth.js";

const DUMMY_SALT = "1a2b3c4d5e6f708192a3b4c5d6e7f809";

export async function onRequestPost({ request, env }) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: "Request origin could not be verified." }, 403);
  if (!env.DB) return jsonResponse({ error: "Account storage is not connected in Cloudflare D1." }, 503);

  let body;
  try {
    if (Number(request.headers.get("Content-Length") || 0) > 12000) return jsonResponse({ error: "Request is too large." }, 413);
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Enter your email or username and password." }, 400);
  }

  const identifier = normalizeEmail(body?.email || body?.identifier || "");
  const password = typeof body?.password === "string" ? body.password : "";
  if (identifier.length < 2 || identifier.length > 254 || password.length < 1 || password.length > 128) {
    return jsonResponse({ error: "Email/username or password is incorrect." }, 401);
  }

  try {
    await ensureAuthSchema(env);
    const account = await env.DB.prepare(
      "SELECT id, name, email, password_hash, password_salt, password_iterations FROM users " +
      "WHERE email = ? OR LOWER(TRIM(name)) = ? LIMIT 1"
    ).bind(identifier, identifier).first();
    const salt = account?.password_salt || DUMMY_SALT;
    const iterations = Number.isInteger(account?.password_iterations) &&
      account.password_iterations >= 10000 && account.password_iterations <= 100000
      ? account.password_iterations : PASSWORD_ITERATIONS;
    const candidate = await hashPassword(password, salt, iterations);
    if (!account?.password_hash || !equalHex(candidate, account.password_hash)) {
      return jsonResponse({ error: "Email/username or password is incorrect." }, 401);
    }

    const name = account.name && account.name.trim() ? account.name.trim() : account.email.split("@")[0];
    const user = { id: account.id, name, email: account.email };
    const cookie = await issueSession(user, env);
    return jsonResponse({ user }, 200, { "Set-Cookie": cookie });
  } catch {
    return jsonResponse({ error: "We couldn't sign you in right now. Please try again." }, 500);
  }
}
