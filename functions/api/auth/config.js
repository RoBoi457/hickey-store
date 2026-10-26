import { jsonResponse } from "../../_auth.js";

export async function onRequestGet({ env }) {
  const googleClientId = typeof env.GOOGLE_CLIENT_ID === "string" ? env.GOOGLE_CLIENT_ID.trim() : "";
  return jsonResponse({ googleClientId });
}
