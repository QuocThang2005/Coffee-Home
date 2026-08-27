-- Migration 001: Initial schema (27 tables)
-- Created: 2026-08-26
-- Description: Create all tables for Coffee Home

-- ===== 1. AUTH & USERS =====
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  phone      TEXT DEFAULT '',
  salt       TEXT NOT NULL,
  pass_hash  TEXT NOT NULL,
  points     INTEGER NOT NULL DEFAULT 0,
  is_admin   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tokens (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- ===== 2. PRODUCTS =====
CREATE TABLE IF NOT EXISTS categories (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  icon  TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  category_id  TEXT NOT NULL REFERENCES categories(id),
  base_price   REAL NOT NULL DEFAULT 0,
  discount_pct INTEGER NOT NULL DEFAULT 0,
  rating       REAL NOT NULL DEFAULT 4.5,
  sold         INTEGER NOT NULL DEFAULT 0,
  tags         TEXT DEFAULT '[]',
  image        TEXT DEFAULT '',
  description  TEXT DEFAULT '',
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_images (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ===== 3. SIZES & TOPPINGS =====
CREATE TABLE IF NOT EXISTS sizes (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  extra REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS toppings (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_toppings (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  topping_id TEXT NOT NULL REFERENCES toppings(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, topping_id)
);

-- ===== 4. BRANCHES & TABLES =====
CREATE TABLE IF NOT EXISTS branches (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  address TEXT DEFAULT '',
  lat     REAL DEFAULT 0,
  lng     REAL DEFAULT 0,
  open    TEXT DEFAULT '',
  phone   TEXT DEFAULT '',
  active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS branch_tables (
  id         SERIAL PRIMARY KEY,
  branch_id  INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  seats      INTEGER NOT NULL DEFAULT 2,
  token      TEXT NOT NULL UNIQUE,
  active     INTEGER NOT NULL DEFAULT 1
);

-- ===== 5. VOUCHERS =====
CREATE TABLE IF NOT EXISTS vouchers (
  code       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  description TEXT DEFAULT '',
  type       TEXT NOT NULL,
  value      REAL NOT NULL DEFAULT 0,
  min_order  REAL NOT NULL DEFAULT 0,
  until      TEXT DEFAULT '',
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voucher_usages (
  id           SERIAL PRIMARY KEY,
  voucher_code TEXT NOT NULL REFERENCES vouchers(code),
  user_id      INTEGER REFERENCES users(id),
  order_code   TEXT,
  used_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===== 6. ORDERS =====
CREATE TABLE IF NOT EXISTS orders (
  code          TEXT PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id),
  customer_name TEXT NOT NULL,
  phone         TEXT DEFAULT '',
  method        TEXT NOT NULL,
  branch_id     INTEGER DEFAULT NULL,
  branch_name   TEXT DEFAULT '',
  address       TEXT DEFAULT '',
  items_json    TEXT NOT NULL,
  subtotal      REAL NOT NULL,
  ship_fee      REAL NOT NULL DEFAULT 0,
  discount      REAL NOT NULL DEFAULT 0,
  total         REAL NOT NULL,
  voucher_code  TEXT DEFAULT '',
  note          TEXT DEFAULT '',
  reply         TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'new',
  table_id      TEXT DEFAULT '',
  payment_method TEXT DEFAULT '',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id           SERIAL PRIMARY KEY,
  order_code   TEXT NOT NULL REFERENCES orders(code) ON DELETE CASCADE,
  product_id   INTEGER,
  product_name TEXT NOT NULL,
  slug         TEXT DEFAULT '',
  qty          INTEGER NOT NULL DEFAULT 1,
  unit_price   REAL NOT NULL DEFAULT 0,
  size         TEXT DEFAULT 'M',
  ice          TEXT DEFAULT '',
  sugar        TEXT DEFAULT '',
  toppings_json TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id         SERIAL PRIMARY KEY,
  order_code TEXT NOT NULL REFERENCES orders(code) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  note       TEXT DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id             SERIAL PRIMARY KEY,
  order_code     TEXT NOT NULL REFERENCES orders(code) ON DELETE CASCADE,
  method         TEXT NOT NULL DEFAULT 'cod',
  amount         REAL NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT DEFAULT '',
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===== 7. BOOKINGS =====
CREATE TABLE IF NOT EXISTS bookings (
  code        TEXT PRIMARY KEY,
  branch_id   TEXT NOT NULL,
  branch_name TEXT DEFAULT '',
  date        TEXT NOT NULL,
  time        TEXT NOT NULL,
  guests      INTEGER NOT NULL,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT DEFAULT '',
  note        TEXT DEFAULT '',
  reply       TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'confirmed',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===== 8. REVIEWS =====
CREATE TABLE IF NOT EXISTS reviews (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id),
  product_id   INTEGER REFERENCES products(id),
  order_code   TEXT,
  rating       INTEGER NOT NULL,
  title        TEXT DEFAULT '',
  message      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'visible',
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_images (
  id         SERIAL PRIMARY KEY,
  review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ===== 9. LOYALTY / POINTS =====
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  min_points  INTEGER NOT NULL DEFAULT 0,
  discount    REAL NOT NULL DEFAULT 0,
  icon        TEXT DEFAULT '',
  color       TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS points_history (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  points      INTEGER NOT NULL,
  type        TEXT NOT NULL,
  description TEXT DEFAULT '',
  ref_code    TEXT DEFAULT '',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rewards (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  points_cost  INTEGER NOT NULL,
  image        TEXT DEFAULT '',
  stock        INTEGER NOT NULL DEFAULT -1,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  reward_id    INTEGER NOT NULL REFERENCES rewards(id),
  points_spent INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===== 10. FEEDBACKS =====
CREATE TABLE IF NOT EXISTS feedbacks (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  contact    TEXT DEFAULT '',
  rating     INTEGER NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===== 11. APPLICATIONS =====
CREATE TABLE IF NOT EXISTS applications (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  email      TEXT DEFAULT '',
  position   TEXT NOT NULL,
  note       TEXT DEFAULT '',
  reply      TEXT DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===== 12. NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  title      TEXT NOT NULL,
  body       TEXT DEFAULT '',
  type       TEXT NOT NULL DEFAULT 'info',
  read       INTEGER NOT NULL DEFAULT 0,
  ref_code   TEXT DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===== 13. AUDIT LOGS =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT DEFAULT '',
  details    TEXT DEFAULT '',
  ip         TEXT DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
