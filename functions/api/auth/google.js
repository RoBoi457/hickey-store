import {
  issueSession, jsonResponse, normalizeEmail, sameOriginRequest, validEmail
} from "../../_auth.js";

const encoder = new TextEncoder();
let cachedGoogleKeys = null;
let cachedGoogleKeysUntil = 0;

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function googleSigningKeys() {
  if (cachedGoogleKeys && Date.now() < cachedGoogleKeysUntil) return cachedGoogleKeys;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Google signing keys are unavailable.");
  const body = await response.json();
  if (!Array.isArray(body.keys)) throw new Error("Google signing keys are invalid.");
  const cacheControl = response.headers.get("Cache-Control") || "";
  const match = cacheControl.match(/max-age=(\d+)/i);
  const maxAge = match ? Math.min(21600, Number(match[1])) : 3600;
  cachedGoogleKeys = body.keys;
  cachedGoogleKeysUntil = Date.now() + maxAge * 1000;
  return cachedGoogleKeys;
}

async function verifyGoogleCredential(credential, nonce, clientId) {
  if (typeof credential !== "string" || credential.length > 12000) throw new Error("Invalid Google credential.");
  const parts = credential.split(".");
  if (parts.length !== 3) throw new Error("Invalid Google credential.");
  const header = decodeJsonPart(parts[0]);
  const claims = decodeJsonPart(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Invalid Google credential.");
  const keyData = (await googleSigningKeys()).find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!keyData) throw new Error("Google signing key was not found.");
  const key = await crypto.subtle.importKey(
    "jwk", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const signatureValid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    decodeBase64Url(parts[2]),
    encoder.encode(parts[0] + "." + parts[1])
  );
  if (!signatureValid) throw new Error("Google credential signature is invalid.");

  const now = Math.floor(Date.now() / 1000);
  const audienceMatches = claims.aud === clientId || (Array.isArray(claims.aud) && claims.aud.includes(clientId));
  const issuerValid = claims.iss === "accounts.google.com" || claims.iss === "https://accounts.google.com";
  const verifiedEmail = claims.email_verified === true || claims.email_verified === "true";
  if (!issuerValid || !audienceMatches || (claims.azp && claims.azp !== clientId) ||
      !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= now ||
      !Number.isFinite(Number(claims.iat)) || Number(claims.iat) > now + 60 ||
      now - Number(claims.iat) > 600 || claims.nonce !== nonce ||
      !verifiedEmail || typeof claims.sub !== "string" || claims.sub.length > 255) {
    throw new Error("Google could not verify this sign-in.");
  }
  const email = normalizeEmail(claims.email);
  if (!validEmail(email)) throw new Error("Google did not return a valid email address.");
  return { email, googleSub: claims.sub };
}

async function findOrCreateGoogleUser(env, identity) {
  const byGoogle = await env.DB.prepare(
    "SELECT id, email FROM users WHERE google_sub = ?"
  ).bind(identity.googleSub).first();
  if (byGoogle) {
    if (byGoogle.email !== identity.email) {
      const conflict = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND id != ?")
        .bind(identity.email, byGoogle.id).first();
      if (conflict) throw new Error("That Google email is linked to a different account.");
      await env.DB.prepare("UPDATE users SET email = ? WHERE id = ?").bind(identity.email, byGoogle.id).run();
    }
    return { id: byGoogle.id, email: identity.email };
  }

  const byEmail = await env.DB.prepare("SELECT id, email, google_sub FROM users WHERE email = ?")
    .bind(identity.email).first();
  if (byEmail) {
    if (byEmail.google_sub && byEmail.google_sub !== identity.googleSub) {
      throw new Error("That email is linked to a different Google account.");
    }
    await env.DB.prepare("UPDATE users SET google_sub = ? WHERE id = ?")
      .bind(identity.googleSub, byEmail.id).run();
    return { id: byEmail.id, email: byEmail.email };
  }

  const user = { id: crypto.randomUUID(), email: identity.email };
  await env.DB.prepare("INSERT INTO users (id, email, google_sub) VALUES (?, ?, ?)")
    .bind(user.id, user.email, identity.googleSub).run();
  return user;
}

export async function onRequestPost({ request, env }) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: "Request origin could not be verified." }, 403);
  if (!env.DB) return jsonResponse({ error: "Account storage is not connected. Apply the account migration to D1." }, 503);
  const clientId = typeof env.GOOGLE_CLIENT_ID === "string" ? env.GOOGLE_CLIENT_ID.trim() : "";
  if (!clientId) return jsonResponse({ error: "Google sign-in is not configured yet." }, 503);

  let body;
  try {
    if (Number(request.headers.get("Content-Length") || 0) > 16000) return jsonResponse({ error: "Request is too large." }, 413);
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Google sign-in could not be completed." }, 400);
  }
  if (typeof body?.nonce !== "string" || body.nonce.length < 20 || body.nonce.length > 128) {
    return jsonResponse({ error: "Google sign-in expired. Please try again." }, 400);
  }

  try {
    const identity = await verifyGoogleCredential(body.credential, body.nonce, clientId);
    const user = await findOrCreateGoogleUser(env, identity);
    const cookie = await issueSession(user, env);
    return jsonResponse({ user }, 200, { "Set-Cookie": cookie });
  } catch (error) {
    const message = error instanceof Error && /linked to a different/.test(error.message)
      ? error.message
      : "Google sign-in could not be verified. Please try again.";
    return jsonResponse({ error: message }, 401);
  }
}
