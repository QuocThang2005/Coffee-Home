#!/usr/bin/env python3
"""
Coffee Home Migration System
============================
Lightweight SQL migration runner for PostgreSQL + SQLite.

Usage:
    python migrate.py status          -- Show migration status
    python migrate.py apply           -- Run pending migrations
    python migrate.py apply 003       -- Run up to migration 003
    python migrate.py create "Add rating column"  -- Create new migration file
"""
import os
import sys
import re
import glob
from pathlib import Path
from datetime import datetime

# Add parent dir to path so we can import db module
sys.path.insert(0, str(Path(__file__).resolve().parent))
os.environ.setdefault("DATABASE_URL", "")

from app.db import get_conn, IS_POSTGRESQL

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def _ensure_migrations_table(conn) -> None:
    """Create _schema_migrations table if not exists."""
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


def _get_applied(conn) -> dict:
    """Return {version: name} of already applied migrations."""
    rows = conn.execute("SELECT version, name FROM _schema_migrations ORDER BY version").fetchall()
    if IS_POSTGRESQL:
        return {r["version"]: r["name"] for r in rows}
    return {r[0]: r[1] for r in rows}


def _list_migration_files() -> list[tuple[str, str, Path]]:
    """Return [(version, name, path), ...] sorted by version."""
    files = sorted(glob.glob(str(MIGRATIONS_DIR / "*.sql")))
    result = []
    for f in files:
        p = Path(f)
        m = re.match(r"(\d+)_(.+)\.sql$", p.name)
        if m:
            result.append((m.group(1), m.group(2).replace("_", " "), p))
    return result


def _apply_sql(conn, sql_text: str) -> None:
    """Execute SQL, handling both PostgreSQL and SQLite."""
    # Remove comments and split by semicolons
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
            conn._raw.cursor().execute(stmt)
        else:
            conn.execute(stmt)


def cmd_status():
    """Show migration status."""
    with get_conn() as conn:
        _ensure_migrations_table(conn)
        applied = _get_applied(conn)
        files = _list_migration_files()

    if not files:
        print("No migration files found.")
        return

    print(f"\n{'Version':<10} {'Name':<40} {'Status'}")
    print("-" * 70)
    for version, name, _ in files:
        status = "APPLIED" if version in applied else "PENDING"
        marker = "  " if version in applied else ">>"
        print(f"{marker} {version:<8} {name:<40} {status}")
    print(f"\nTotal: {len(files)} migrations, {len(applied)} applied")


def cmd_apply(target_version=None):
    """Run pending migrations, optionally up to a specific version."""
    with get_conn() as conn:
        _ensure_migrations_table(conn)
        applied = _get_applied(conn)
        files = _list_migration_files()

    pending = [(v, n, p) for v, n, p in files if v not in applied]
    if target_version:
        pending = [(v, n, p) for v, n, p in pending if v <= target_version]

    if not pending:
        print("All migrations already applied.")
        return

    print(f"Applying {len(pending)} migration(s)...")
    with get_conn() as conn:
        for version, name, path in pending:
            sql = path.read_text("utf-8")
            print(f"  [{version}] {name} ... ", end="", flush=True)
            try:
                _apply_sql(conn, sql)
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

    print("Done!")


def cmd_create(description: str):
    """Create a new migration file."""
    files = _list_migration_files()
    if files:
        last_version = int(files[-1][0])
    else:
        last_version = 0
    new_version = f"{last_version + 1:03d}"
    slug = re.sub(r"[^a-z0-9]+", "_", description.lower()).strip("_")[:50]
    filename = f"{new_version}_{slug}.sql"
    path = MIGRATIONS_DIR / filename

    template = f"""-- Migration {new_version}: {description}
-- Created: {datetime.now().strftime('%Y-%m-%d %H:%M')}
-- Description: {description}

-- Write your SQL here:
-- Example: ALTER TABLE products ADD COLUMN new_col TEXT DEFAULT '';

"""
    path.write_text(template, encoding="utf-8")
    print(f"Created: {path}")
    print(f"Edit the file, then run: python migrate.py apply")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "status":
        cmd_status()
    elif cmd == "apply":
        target = sys.argv[2] if len(sys.argv) > 2 else None
        cmd_apply(target)
    elif cmd == "create":
        if len(sys.argv) < 3:
            print("Usage: python migrate.py create \"description\"")
            sys.exit(1)
        cmd_create(sys.argv[2])
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)
