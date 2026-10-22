CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT NOT NULL UNIQUE,
  items_json TEXT NOT NULL,
  amount_rupees INTEGER NOT NULL,
  delivery_address TEXT NOT NULL,
  phone TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method = 'upi'),
  status TEXT NOT NULL,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
