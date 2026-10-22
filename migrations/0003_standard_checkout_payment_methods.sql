-- Allow Standard Checkout payment methods and keep the verified method on each order.
-- Preserve the order data and indexes while removing the UPI-only CHECK constraint.
CREATE TABLE orders_standard_checkout (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT NOT NULL UNIQUE,
  items_json TEXT NOT NULL,
  amount_rupees INTEGER NOT NULL,
  delivery_address TEXT NOT NULL,
  phone TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  customer_name TEXT NOT NULL DEFAULT ''
);

INSERT INTO orders_standard_checkout (
  id, order_ref, items_json, amount_rupees, delivery_address, phone,
  payment_method, status, razorpay_order_id, razorpay_payment_id, created_at, customer_name
)
SELECT
  id, order_ref, items_json, amount_rupees, delivery_address, phone,
  payment_method, status, razorpay_order_id, razorpay_payment_id, created_at, customer_name
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_standard_checkout RENAME TO orders;

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
