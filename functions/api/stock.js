import { computeInventory, INITIAL_STOCK, LOW_STOCK_THRESHOLD } from "../_inventory.js";

export async function onRequestGet({ env }) {
  const { items, byId } = await computeInventory(env?.DB);
  return new Response(
    JSON.stringify({
      initialStock: INITIAL_STOCK,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      stock: byId,
      items
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}
