export const INITIAL_STOCK = 10;
export const LOW_STOCK_THRESHOLD = 5;
export const INVENTORY_CUTOFF_UTC = "2026-11-11 17:30:00";

const MANUALLY_SOLD_OUT = new Set(["kathor-clock", "cooks", "proxy-pass"]);

export const CATALOG = {
  "kathor-clock": { name: "The Rohtak Clock", price: 69 },
  pda: { name: "PDA Tree", price: 69 },
  "submit-mode": { name: "Spiderman", price: 69 },
  "clock-it": { name: "Clock It", price: 69 },
  "coke-paglu": { name: "Diet Coke Paglu", price: 69 },
  cooks: { name: "Cooked", price: 69 },
  "proxy-pass": { name: "Claudey Proxy Mat Laga", price: 69 },
  baddie: { name: "The Baddie Club", price: 69 },
  "kathor-land": { name: "Kathor Land", price: 69 },
  nonchalant: { name: "Non Chalant", price: 69 },
  "two-friends": { name: "Couple Design", price: 99 },
  "campus-cat-nap": { name: "CAT Whore", price: 69 },
  "clinger-cat-club": { name: "Gingerrrrr", price: 69 },
  "same-old-day": { name: "CAT checklist", price: 69 }
};

export async function computeInventory(db) {
  const soldById = Object.fromEntries(Object.keys(CATALOG).map((id) => [id, 0]));

  if (db) {
    try {
      const result = await db.prepare(
        "SELECT items_json FROM orders WHERE status = 'paid' AND datetime(created_at) >= ?"
      ).bind(INVENTORY_CUTOFF_UTC).all();

      for (const row of result.results || []) {
        let items;
        try {
          items = JSON.parse(row.items_json || "[]");
        } catch {
          items = [];
        }
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          if (item && Object.prototype.hasOwnProperty.call(soldById, item.id)) {
            const qty = Number(item.quantity);
            if (Number.isFinite(qty) && qty > 0) {
              soldById[item.id] += Math.floor(qty);
            }
          }
        }
      }
    } catch (_) {}
  }

  const items = Object.entries(CATALOG).map(([id, meta]) => {
    const sold = soldById[id] || 0;
    const isManualSoldOut = MANUALLY_SOLD_OUT.has(id);
    const remaining = isManualSoldOut ? 0 : Math.max(0, INITIAL_STOCK - sold);
    return {
      id,
      name: meta.name,
      price: meta.price,
      initial: INITIAL_STOCK,
      sold,
      remaining,
      lowStock: remaining > 0 && remaining <= LOW_STOCK_THRESHOLD,
      soldOut: remaining === 0
    };
  });

  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  return { items, byId };
}
