# Database abstraction — hỗ trợ PostgreSQL (production) + SQLite (dev fallback)
# 27 bảng: users, tokens, orders, bookings, applications, feedbacks,
#           categories, products, product_images, sizes, toppings, product_toppings,
#           vouchers, voucher_usages, order_items, order_status_history, payments,
#           reviews, review_images, points_history, loyalty_tiers, rewards,
#           reward_redemptions, branches, branch_tables, notifications, audit_logs
import glob
import json
import os
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from threading import Lock

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

# ---------- Fix common DATABASE_URL issues (Neon, Render, etc.) ----------
if DATABASE_URL:
    # Render sometimes adds quotes or breaks query params
    DATABASE_URL = DATABASE_URL.strip('"').strip("'")
    # Fix missing = in query params like "?sslmode require" → "?sslmode=require"
    DATABASE_URL = re.sub(r'([?&])(\w+) (\w+)', r'\1\2=\3', DATABASE_URL)
    # Remove unsupported params (psycopg2 doesn't support channel_binding, etc.)
    DATABASE_URL = re.sub(r'[?&]channel_binding=\w+', '', DATABASE_URL)
    DATABASE_URL = re.sub(r'\?&', '?', DATABASE_URL)
    # Ensure sslmode=require is present for Neon
    if 'sslmode=' not in DATABASE_URL:
        sep = '&' if '?' in DATABASE_URL else '?'
        DATABASE_URL += f'{sep}sslmode=require'
    logging.getLogger(__name__).info(f"DATABASE_URL: host={DATABASE_URL.split('@')[-1].split('/')[0] if '@' in DATABASE_URL else '?'}")

# ---------- PostgreSQL ----------

if DATABASE_URL:
    import psycopg2
    import psycopg2.extras
    import psycopg2.pool

    _pg_pool = None

    def _get_pg_pool():
        global _pg_pool
        if _pg_pool is None:
            _pg_pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=2, maxconn=20, dsn=DATABASE_URL
            )
        return _pg_pool

    @contextmanager
    def get_conn():
        pool = _get_pg_pool()
        conn = pool.getconn()
        try:
            conn.autocommit = False
            yield PgConn(conn)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            pool.putconn(conn)

    class PgConn:
        def __init__(self, raw):
            self._raw = raw

        def execute(self, sql, params=None):
            cur = self._raw.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            pg_sql = sql.replace("?", "%s")
            cur.execute(pg_sql, params or ())
            return PgCursor(cur)

        def executescript(self, sql):
            cur = self._raw.cursor()
            cur.execute(sql)
            cur.close()

        def commit(self):
            self._raw.commit()

        def close(self):
            self._raw.close()

    class PgCursor:
        def __init__(self, cur):
            self._cur = cur

        def fetchone(self):
            return self._cur.fetchone()

        def fetchall(self):
            return self._cur.fetchall()

        @property
        def lastrowid(self):
            row = self._cur.fetchone() if self._cur.description else None
            if row is None:
                self._cur.execute("SELECT lastval()")
                return self._cur.fetchone()["lastval"]
            return row.get("id") or row.get("code")

        @property
        def rowcount(self):
            return self._cur.rowcount

# ---------- SQLite (fallback) ----------

else:
    DB_PATH = Path(os.environ.get("COFFEE_DB")
                   or Path(__file__).resolve().parents[1] / "data" / "coffee.db")
    _lock = Lock()

    @contextmanager
    def get_conn():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 30000")
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


# ---------- Schema PostgreSQL (27 bang) ----------

SCHEMA_POSTGRESQL = """
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

-- ===== 2. PRODUCTS (migrate tu products.json) =====
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
  type       TEXT NOT NULL CHECK (type IN ('percent','fixed','freeship','gift')),
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

-- ===== 6. ORDERS (expanded) =====
CREATE TABLE IF NOT EXISTS orders (
  code          TEXT PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id),
  customer_name TEXT NOT NULL,
  phone         TEXT DEFAULT '',
  method        TEXT NOT NULL CHECK (method IN ('pickup','delivery')),
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
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','preparing','ready','shipping','done','cancel')),
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
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','paid','failed','refunded')),
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
  status      TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancel')),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===== 8. REVIEWS =====
CREATE TABLE IF NOT EXISTS reviews (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id),
  product_id   INTEGER REFERENCES products(id),
  order_code   TEXT,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title        TEXT DEFAULT '',
  message      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'visible'
               CHECK (status IN ('visible','hidden')),
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
  type        TEXT NOT NULL CHECK (type IN ('earn','spend','admin_adjust','expire')),
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
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','delivered','cancelled')),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===== 10. FEEDBACKS =====
CREATE TABLE IF NOT EXISTS feedbacks (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  contact    TEXT DEFAULT '',
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new'
             CHECK (status IN ('new','read','hidden')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===== 11. APPLICATIONS (tuyen dung) =====
CREATE TABLE IF NOT EXISTS applications (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  email      TEXT DEFAULT '',
  position   TEXT NOT NULL,
  note       TEXT DEFAULT '',
  reply      TEXT DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new'
             CHECK (status IN ('new','approved','rejected')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===== 12. NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  title      TEXT NOT NULL,
  body       TEXT DEFAULT '',
  type       TEXT NOT NULL DEFAULT 'info'
             CHECK (type IN ('info','order','promotion','system')),
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

CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
"""

SCHEMA_SQLITE = SCHEMA_POSTGRESQL.replace(
    "SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT"
).replace(
    "NOW()", "datetime('now')"
).replace(
    "NOW() + INTERVAL '30 days'", "datetime('now', '+30 days')"
).replace(
    "CHECK (status IN ('pending','paid','failed','refunded'))", ""
).replace(
    "CHECK (status IN ('pending','delivered','cancelled'))", ""
).replace(
    "CHECK (status IN ('new','preparing','ready','shipping','done','cancel'))", ""
).replace(
    "CHECK (status IN ('confirmed','cancel'))", ""
).replace(
    "CHECK (status IN ('visible','hidden'))", ""
).replace(
    "CHECK (status IN ('new','read','hidden'))", ""
).replace(
    "CHECK (status IN ('new','approved','rejected'))", ""
).replace(
    "CHECK (rating BETWEEN 1 AND 5)", ""
).replace(
    "CHECK (type IN ('percent','fixed','freeship','gift'))", ""
).replace(
    "CHECK (type IN ('earn','spend','admin_adjust','expire'))", ""
).replace(
    "CHECK (type IN ('info','order','promotion','system'))", ""
).replace(
    "CHECK (method IN ('pickup','delivery'))", ""
)

# ---------- Helpers ----------

IS_POSTGRESQL = bool(DATABASE_URL)


def now_sql(days: int = 0) -> str:
    if IS_POSTGRESQL:
        if days:
            return f"NOW() + INTERVAL '{days} days'"
        return "NOW()"
    if days:
        return f"datetime('now', '+{days} days')"
    return "datetime('now')"


def today_sql() -> str:
    return "CURRENT_DATE" if IS_POSTGRESQL else "date('now','localtime')"


def days_ago_sql(n: int) -> str:
    if IS_POSTGRESQL:
        return f"CURRENT_DATE - INTERVAL '{n} days'"
    return f"date('now','localtime','-{n} days')"


def date_col(col: str) -> str:
    return f"DATE({col})" if IS_POSTGRESQL else f"date({col})"


def get_exception_class():
    if IS_POSTGRESQL:
        import psycopg2
        return psycopg2.IntegrityError
    return sqlite3.IntegrityError


# ---------- Migration System ----------

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def _ensure_migrations_table(conn) -> None:
    """Create _schema_migrations tracking table."""
    if IS_POSTGRESQL:
        conn._raw.cursor().execute("""
            CREATE TABLE IF NOT EXISTS _schema_migrations (
                id         SERIAL PRIMARY KEY,
                version    TEXT NOT NULL UNIQUE,
                name       TEXT NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
    else:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS _schema_migrations (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                version    TEXT NOT NULL UNIQUE,
                name       TEXT NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT (datetime('now'))
            )
        """)


def _get_applied_migrations(conn) -> dict:
    """Return {version: name} of already applied migrations."""
    rows = conn.execute(
        "SELECT version, name FROM _schema_migrations ORDER BY version"
    ).fetchall()
    if IS_POSTGRESQL:
        return {r["version"]: r["name"] for r in rows}
    return {r[0]: r[1] for r in rows}


def _list_migration_files() -> list:
    """Return [(version, name, path), ...] sorted by version."""
    files = sorted(glob.glob(str(MIGRATIONS_DIR / "*.sql")))
    result = []
    for f in files:
        p = Path(f)
        m = re.match(r"(\d+)_(.+)\.sql$", p.name)
        if m:
            result.append((m.group(1), m.group(2).replace("_", " "), p))
    return result


def _apply_migration_sql(conn, sql_text: str) -> None:
    """Execute SQL statements."""
    import re as _re
    statements = []
    current = []
    for line in sql_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        current.append(line)
        if stripped.endswith(";"):
            stmt = "\n".join(current).strip()
            if stmt.rstrip(";").strip():
                statements.append(stmt)
            current = []
    if current:
        stmt = "\n".join(current).strip()
        if stmt.rstrip(";").strip():
            statements.append(stmt)

    for stmt in statements:
        if IS_POSTGRESQL:
            # Convert SQLite INSERT OR IGNORE → PostgreSQL ON CONFLICT DO NOTHING
            converted = _re.sub(
                r'INSERT\s+OR\s+IGNORE\s+INTO',
                'INSERT INTO',
                stmt,
                flags=_re.IGNORECASE,
            )
            if converted != stmt:
                converted = converted.rstrip(";").rstrip() + " ON CONFLICT DO NOTHING;"
            conn._raw.cursor().execute(converted)
        else:
            conn.execute(stmt)


def run_migrations() -> None:
    """Apply all pending migrations. Called at startup."""
    if not MIGRATIONS_DIR.exists():
        return

    with get_conn() as conn:
        _ensure_migrations_table(conn)
        applied = _get_applied_migrations(conn)
        files = _list_migration_files()

    pending = [(v, n, p) for v, n, p in files if v not in applied]
    if not pending:
        return

    print(f"[db] Applying {len(pending)} migration(s)...")
    with get_conn() as conn:
        for version, name, path in pending:
            sql = path.read_text("utf-8")
            print(f"  [{version}] {name} ... ", end="", flush=True)
            try:
                _apply_migration_sql(conn, sql)
                if IS_POSTGRESQL:
                    conn._raw.cursor().execute(
                        "INSERT INTO _schema_migrations (version, name) VALUES (%s, %s)",
                        (version, name),
                    )
                else:
                    conn.execute(
                        "INSERT INTO _schema_migrations (version, name) VALUES (?, ?)",
                        (version, name),
                    )
                print("OK")
            except Exception as e:
                print(f"FAILED: {e}")
                raise


# ---------- Bootstrap ----------

def _admin_password() -> str:
    pw = os.environ.get("ADMIN_PASSWORD", "").strip()
    if pw:
        return pw
    try:
        conf = json.loads(
            (Path(__file__).resolve().parents[2] / "config.json").read_text("utf-8")
        )
        if conf.get("adminPassword"):
            return str(conf["adminPassword"])
    except Exception:
        pass
    is_prod = os.environ.get("COFFEE_ENV", "").lower() in ("prod", "production")
    if is_prod:
        raise RuntimeError(
            "THIEU ADMIN_PASSWORD — dat env ADMIN_PASSWORD truoc khi chay production!"
        )
    print("[db] CANH BAO: admin dung mat khau mac dinh 'admin123' —"
          " dat ADMIN_PASSWORD (env) hoac adminPassword (config.json) de doi!")
    return "admin123"


def _seed_menu(conn, is_pg: bool) -> None:
    """Migrate products.json → DB nếu DB chưa có categories."""
    products_json = Path(__file__).resolve().parents[2] / "data" / "products.json"
    if not products_json.exists():
        return

    menu = json.loads(products_json.read_text("utf-8"))

    def _exec(sql, params=()):
        if is_pg:
            c = conn._raw.cursor()
            c.execute(sql.replace("?", "%s"), params)
            c.close()
        else:
            conn.execute(sql, params)

    def _fetchone(sql, params=()):
        if is_pg:
            c = conn._raw.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            c.execute(sql.replace("?", "%s"), params)
            return c.fetchone()
        return conn.execute(sql, params).fetchone()

    existing = _fetchone("SELECT COUNT(*) c FROM categories")
    count = existing["c"] if isinstance(existing, dict) else existing[0]
    if count and count > 0:
        return

    print("[db] Seed menu tu products.json -> DB ...")

    for cat in menu.get("categories", []):
        _exec("INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)",
              (cat["id"], cat["name"], cat.get("icon", "")))

    for s in menu.get("sizes", []):
        _exec("INSERT INTO sizes (id, name, extra) VALUES (?, ?, ?)",
              (s["id"], s["name"], s.get("extra", 0)))

    for t in menu.get("toppings", []):
        _exec("INSERT INTO toppings (id, name, price) VALUES (?, ?, ?)",
              (t["id"], t["name"], t.get("price", 0)))

    for p in menu.get("products", []):
        _exec(
            "INSERT INTO products (slug, name, category_id, base_price, discount_pct, "
            "rating, sold, tags, image, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (p["slug"], p["name"], p["category"], p["basePrice"],
             p.get("discountPct", 0), p.get("rating", 4.5), p.get("sold", 0),
             json.dumps(p.get("tags", []), ensure_ascii=False),
             p.get("image", ""), p.get("desc", "")),
        )

    for b in menu.get("branches", []):
        _exec(
            "INSERT INTO branches (id, name, address, lat, lng, open, phone) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (b["id"], b["name"], b.get("address", ""), b.get("lat", 0),
             b.get("lng", 0), b.get("open", ""), b.get("phone", "")),
        )

    for v in menu.get("vouchers", []):
        _exec(
            "INSERT INTO vouchers (code, title, description, type, value, min_order, until) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (v["code"], v["title"], v.get("desc", ""), v["type"],
             v.get("value", 0), v.get("minOrder", 0), v.get("until", "")),
        )

    for tier in [
        ("Bronze", 0, 0, "", "#cd7f32"),
        ("Silver", 500, 5, "", "#c0c0c0"),
        ("Gold", 2000, 10, "", "#ffd700"),
        ("Diamond", 5000, 15, "", "#b9f2ff"),
    ]:
        _exec(
            "INSERT INTO loyalty_tiers (name, min_points, discount, icon, color) "
            "VALUES (?, ?, ?, ?, ?)",
            tier,
        )

    for r in [
        ("Milk Foam", "Ly foam sữa mịn màng", 50, 20),
        ("Sticker Set", "Bộ sticker Coffee Home", 100, 50),
        ("Free Drink (M)", "Món miễn phí size M bất kỳ", 300, 10),
    ]:
        _exec(
            "INSERT INTO rewards (name, description, points_cost, stock) VALUES (?, ?, ?, ?)",
            r,
        )

    # Seed branch tables
    tables_data = [
        (1, "Bàn 1", 2), (1, "Bàn 2", 4), (1, "Bàn 3", 6),
        (2, "Bàn 1", 2), (2, "Bàn 2", 4),
    ]
    import secrets
    for branch_id, name, seats in tables_data:
        tok = secrets.token_hex(8)
        _exec("INSERT INTO branch_tables (branch_id, name, seats, token) VALUES (?, ?, ?, ?)",
              (branch_id, name, seats, tok))

    print("[db] Seed xong!")


def init_db() -> None:
    is_pg = bool(DATABASE_URL)

    # Run migrations (replaces raw CREATE TABLE IF NOT EXISTS)
    run_migrations()

    with get_conn() as conn:
        # Seed menu tu products.json
        _seed_menu(conn, is_pg)

        # Dọn token hết hạn
        if is_pg:
            cur = conn._raw.cursor()
            cur.execute(f"DELETE FROM tokens WHERE expires_at <= {now_sql()}")
            cur.close()
        else:
            conn.execute(f"DELETE FROM tokens WHERE expires_at <= {now_sql()}")

        # Tạo admin mặc định
        from .security import hash_password

        if is_pg:
            cur = conn._raw.cursor()
            cur.execute("SELECT 1 FROM users WHERE email = %s", ("admin@coffeehome.vn",))
            if not cur.fetchone():
                salt, digest = hash_password(_admin_password())
                cur.execute(
                    "INSERT INTO users (name, email, salt, pass_hash, points, is_admin) "
                    "VALUES (%s, %s, %s, %s, 0, 1)",
                    ("Quan tri vien", "admin@coffeehome.vn", salt, digest),
                )
            cur.close()
        else:
            row = conn.execute("SELECT 1 FROM users WHERE email = ?",
                               ("admin@coffeehome.vn",)).fetchone()
            if not row:
                salt, digest = hash_password(_admin_password())
                conn.execute(
                    "INSERT INTO users (name, email, salt, pass_hash, points, is_admin) "
                    "VALUES (?, ?, ?, ?, 0, 1)",
                    ("Quan tri vien", "admin@coffeehome.vn", salt, digest),
                )
