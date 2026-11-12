const encoder = new TextEncoder();
const SESSION_COOKIE = "hickey_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const PASSWORD_ITERATIONS = 100000;

let schemaReadyPromise = null;

export async function ensureAuthSchema(env) {
  if (!env?.DB_STAGING) return;
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await env.DB_STAGING.prepare(
        "CREATE TABLE IF NOT EXISTS users (" +
        "id TEXT PRIMARY KEY, " +
        "name TEXT NOT NULL DEFAULT '', " +
        "email TEXT NOT NULL COLLATE NOCASE UNIQUE, " +
        "password_hash TEXT, " +
        "password_salt TEXT, " +
        "password_iterations INTEGER, " +
        "google_sub TEXT UNIQUE, " +
        "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
      ).run();
      try {
        await env.DB_STAGING.prepare("ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''").run();
      } catch {}
      try {
        await env.DB_STAGING.prepare("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''").run();
      } catch {}
      try {
        await env.DB_STAGING.prepare("ALTER TABLE users ADD COLUMN delivery_address TEXT NOT NULL DEFAULT ''").run();
      } catch {}

      
      await env.DB_STAGING.prepare(
        "CREATE TABLE IF NOT EXISTS sessions (" +
        "token_hash TEXT PRIMARY KEY, " +
        "user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, " +
        "expires_at TEXT NOT NULL, " +
        "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
      ).run();
      await env.DB_STAGING.prepare("CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)").run();
      await env.DB_STAGING.prepare("CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at)").run();
      await env.DB_STAGING.prepare(
        "CREATE TABLE IF NOT EXISTS cart_items (" +
        "user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, " +
        "product_id TEXT NOT NULL, " +
        "quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99), " +
        "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
        "PRIMARY KEY (user_id, product_id))"
      ).run();
      await env.DB_STAGING.prepare(
        "CREATE TABLE IF NOT EXISTS orders (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
        "order_ref TEXT NOT NULL UNIQUE, " +
        "items_json TEXT NOT NULL, " +
        "amount_rupees INTEGER NOT NULL, " +
        "delivery_address TEXT NOT NULL, " +
        "phone TEXT NOT NULL, " +
        "payment_method TEXT NOT NULL, " +
        "status TEXT NOT NULL, " +
        "razorpay_order_id TEXT UNIQUE, " +
        "razorpay_payment_id TEXT UNIQUE, " +
        "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
        "customer_name TEXT NOT NULL DEFAULT '', " +
        "customer_email TEXT NOT NULL DEFAULT '', " +
        "user_id TEXT, " +
        "email_sent INTEGER NOT NULL DEFAULT 0, " +
        "email_sent_at TEXT, " +
        "email_body TEXT)"
      ).run();
      try {
        await env.DB_STAGING.prepare("CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC)").run();
      } catch {}
      try {
        await env.DB_STAGING.prepare("CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)").run();
      } catch {}
      try {
        await env.DB_STAGING.prepare("ALTER TABLE orders ADD COLUMN customer_email TEXT NOT NULL DEFAULT ''").run();
      } catch {}
      try {
        await env.DB_STAGING.prepare("ALTER TABLE orders ADD COLUMN user_id TEXT").run();
      } catch {}
      try {
        await env.DB_STAGING.prepare("CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders (user_id, created_at DESC)").run();
      } catch {}
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
      } catch {}
    })().catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }
  return schemaReadyPromise;
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff"
  });
  for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, value);
  return new Response(JSON.stringify(data), { status, headers });
}

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validEmail(value) {
  return typeof value === "string" && value.length >= 5 && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function sameOriginRequest(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export function randomHex(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexBytes(value) {
  if (typeof value !== "string" || value.length % 2 || !/^[a-f0-9]+$/i.test(value)) {
    throw new Error("Invalid hex value.");
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const safeIterations = Math.min(100000, Math.max(10000, Number(iterations) || PASSWORD_ITERATIONS));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: hexBytes(saltHex),
    iterations: safeIterations,
    hash: "SHA-256"
  }, key, 256);
  return toHex(new Uint8Array(bits));
}

export function equalHex(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return difference === 0;
}

export async function sha256Hex(value) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

export function requestSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      const value = rest.join("=");
      return /^[a-f0-9]{64}$/i.test(value) ? value : "";
    }
  }
  return "";
}

export async function getAuthenticatedUser(request, env) {
  if (!env.DB_STAGING) return null;
  await ensureAuthSchema(env);
  const token = requestSessionToken(request);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const row = await env.DB_STAGING.prepare(
    "SELECT users.id, users.name, users.email, users.phone, users.delivery_address FROM sessions JOIN users ON users.id = sessions.user_id " +
    "WHERE sessions.token_hash = ? AND sessions.expires_at > ?"
  ).bind(tokenHash, now).first();
  if (!row) return null;
  const fallbackName = row.name && row.name.trim() ? row.name.trim() : row.email.split("@")[0];
  return { id: row.id, name: fallbackName, email: row.email , phone: row.phone || "", address: row.delivery_address || ""};
}

export async function issueSession(user, env) {
  await ensureAuthSchema(env);
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB_STAGING.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(tokenHash, user.id, expiresAt).run();
  return SESSION_COOKIE + "=" + token + "; Max-Age=" + SESSION_TTL_SECONDS +
    "; Path=/; HttpOnly; Secure; SameSite=Lax";
}

export function expiredSessionCookie() {
  return SESSION_COOKIE + "=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax";
}
