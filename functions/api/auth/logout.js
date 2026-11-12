import {
  expiredSessionCookie, jsonResponse, requestSessionToken, sameOriginRequest, sha256Hex
} from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: "Request origin could not be verified." }, 403);
  try {
    const token = requestSessionToken(request);
    if (token && env.DB_STAGING) {
      await env.DB_STAGING.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    }
  } catch {
    // Expiring the browser cookie still logs the account out of this device.
  }
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": expiredSessionCookie() });
}
