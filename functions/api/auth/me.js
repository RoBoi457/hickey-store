import { getAuthenticatedUser, jsonResponse } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB_STAGING) return jsonResponse({ error: "Account storage is not connected. Apply the account migration to D1." }, 503);
  try {
    const user = await getAuthenticatedUser(request, env);
    return jsonResponse({ user });
  } catch {
    return jsonResponse({ error: "Account storage is not ready. Apply migration 0004_customer_accounts.sql." }, 503);
  }
}
