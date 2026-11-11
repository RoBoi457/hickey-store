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

function parseFilters(url) {
  const status = url.searchParams.get("status") || "";
  const search = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const validDate = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (status && !["pending", "paid", "cancelled", "expired"].includes(status)) {
    throw new Error("Invalid status filter.");
  }
  if (!validDate(from) || !validDate(to)) throw new Error("Dates must use YYYY-MM-DD.");
  return { status, search, from, to };
}

function whereClause(filters) {
  const clauses = ["datetime(created_at) >= '2026-11-11 17:30:00'"];
  const bindings = [];
  if (filters.status) { clauses.push("status = ?"); bindings.push(filters.status); }
  if (filters.from) { clauses.push("date(created_at) >= date(?)"); bindings.push(filters.from); }
  if (filters.to) { clauses.push("date(created_at) <= date(?)"); bindings.push(filters.to); }
  if (filters.search) {
    const term = "%" + filters.search + "%";
    clauses.push("(order_ref LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR phone LIKE ? OR delivery_address LIKE ?)");
    bindings.push(term, term, term, term, term);
  }
  return { sql: clauses.length ? " WHERE " + clauses.join(" AND ") : "", bindings };
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[\\s]*[=+@\\-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

function itemSummary(itemsJson) {
  try {
    const items = JSON.parse(itemsJson || "[]");
    return Array.isArray(items)
      ? items.map((item) => [item.name || item.id || "Item", "×" + (Number(item.quantity) || 1)].join(" ")).join("; ")
      : "";
  } catch (err) {
    return "";
  }
}

export async function onRequestGet({ request, env }) {
  if (!isAuthorized(request, env)) return json({ error: "Admin access required." }, 401);
  if (!env.DB) return json({ error: "The orders database is not connected." }, 503);

  let filters;
  try { filters = parseFilters(new URL(request.url)); }
  catch (error) { return json({ error: error.message }, 400); }

  const url = new URL(request.url);
  const { sql: where, bindings } = whereClause(filters);
  const format = url.searchParams.get("format");
  try {
    try { await env.DB.prepare("ALTER TABLE orders ADD COLUMN customer_email TEXT NOT NULL DEFAULT ''").run(); } catch (_) {}
    try { await env.DB.prepare("ALTER TABLE orders ADD COLUMN email_sent INTEGER NOT NULL DEFAULT 0").run(); } catch (_) {}
    try { await env.DB.prepare("ALTER TABLE orders ADD COLUMN email_sent_at TEXT").run(); } catch (_) {}
    try { await env.DB.prepare("ALTER TABLE orders ADD COLUMN email_body TEXT").run(); } catch (_) {}
    try {
      await env.DB.prepare("DELETE FROM orders WHERE datetime(created_at) < '2026-11-11 17:30:00'").run();
    } catch (_) {}

    if (format === "csv") {
      const result = await env.DB.prepare(
        "SELECT order_ref, created_at, customer_name, customer_email, phone, delivery_address, items_json, amount_rupees, status, razorpay_payment_id, email_sent, email_sent_at, email_body FROM orders" +
        where + " ORDER BY created_at DESC LIMIT 5000"
      ).bind(...bindings).all();
      const headers = ["Order reference", "Created at", "Customer", "Email ID", "Email confirmation sent", "Phone", "Delivery address", "Items", "Amount INR", "Status", "Razorpay payment ID"];
      const rows = (result.results || []).map((order) => [
        order.order_ref, order.created_at, order.customer_name, order.customer_email,
        order.email_sent ? "Yes (" + (order.email_sent_at || "") + ")" : "No",
        order.phone, order.delivery_address, itemSummary(order.items_json), order.amount_rupees, order.status, order.razorpay_payment_id
      ]);
      const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
      return new Response("\uFEFF" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="hickey-orders.csv"',
          "Cache-Control": "no-store, private",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
    const pageSize = 100;
    const offset = (page - 1) * pageSize;
    const [countResult, listResult, summary, daily] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS total FROM orders" + where).bind(...bindings).first(),
      env.DB.prepare(
        "SELECT order_ref, created_at, customer_name, customer_email, phone, delivery_address, items_json, amount_rupees, status, razorpay_payment_id, email_sent, email_sent_at, email_body FROM orders" +
        where + " ORDER BY created_at DESC LIMIT ? OFFSET ?"
      ).bind(...bindings, pageSize, offset).all(),
      env.DB.prepare(
        "SELECT COUNT(*) AS total, " +
        "SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count, " +
        "SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count, " +
        "SUM(CASE WHEN status = 'paid' THEN amount_rupees ELSE 0 END) AS paid_rupees " +
        "FROM orders WHERE datetime(created_at) >= '2026-11-11 17:30:00'"
      ).first(),
      env.DB.prepare(
        "SELECT date(created_at) AS day, SUM(CASE WHEN status = 'paid' THEN amount_rupees ELSE 0 END) AS revenue, " +
        "SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_orders " +
        "FROM orders WHERE datetime(created_at) >= '2026-11-11 17:30:00' GROUP BY date(created_at) ORDER BY day"
      ).all()
    ]);
    const orders = (listResult.results || []).map((order) => ({
      ...order,
      items: itemSummary(order.items_json)
    }));
    return json({
      orders,
      page,
      pageSize,
      totalFiltered: countResult?.total || 0,
      summary: {
        total: summary?.total || 0,
        paid: summary?.paid_count || 0,
        pending: summary?.pending_count || 0,
        revenueRupees: summary?.paid_rupees || 0
      },
      daily: daily.results || []
    });
  } catch (err) {
    return json({ error: (err && err.message) ? err.message : "Could not load orders." }, 500);
  }
}
