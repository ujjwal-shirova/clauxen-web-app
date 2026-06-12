#!/usr/bin/env python3
"""
Fast Supabase Postgres -> CockroachDB migration using parallel COPY.

Schema: expect tables on target (from MOLT drop-on-target-and-recreate or prior run).
Data: parallel COPY per table (much faster than row-by-row INSERT).

Usage:
  python3 -m venv cockroachdb/.venv
  cockroachdb/.venv/bin/pip install -r cockroachdb/requirements-migrate.txt
  cockroachdb/.venv/bin/python cockroachdb/scripts/migrate_parallel.py

Env: POSTGRES_URL* from .env.vercel.local, COCKROACH_DATABASE_URL from cockroachdb/.env.local
"""

from __future__ import annotations

import io
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse, urlunparse

try:
    import psycopg2
    from psycopg2 import sql
except ImportError:
    print("Install: cockroachdb/.venv/bin/pip install -r cockroachdb/requirements-migrate.txt", file=sys.stderr)
    raise

REPO_ROOT = Path(__file__).resolve().parents[2]
TARGET_DB = os.environ.get("COCKROACH_TARGET_DATABASE", "clauxen_main")
WORKERS = int(os.environ.get("MIGRATE_WORKERS", "12"))
SKIP_TABLES = re.compile(r"^(_molt_|pg_|sql_)")

EXCLUDE_TABLES = {
    "schema_migrations",
    "supabase_migrations",
    "embeddings",  # pgvector — create via native SQL on CRDB if needed
}


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def db_url(base: str, database: str) -> str:
    u = urlparse(base)
    return urlunparse((u.scheme, u.netloc, f"/{database}", u.params, u.query, u.fragment))


def connect(url: str):
    """Connect with SSL settings compatible with psycopg2 on macOS (no ~/.postgresql/root.crt)."""
    parsed = urlparse(url)
    params = dict(
        p.split("=", 1) for p in (parsed.query or "").split("&") if "=" in p
    )
    host = (parsed.hostname or "").lower()
    is_crdb_cloud = host.endswith(".cockroachlabs.cloud")
    reject_unauthorized = os.environ.get("COCKROACH_SSL_REJECT_UNAUTHORIZED") == "0"

    # Node pg uses the OS trust store for verify-full; psycopg2 often needs root.crt or require.
    if reject_unauthorized or is_crdb_cloud:
        params["sslmode"] = "require"
        params.pop("sslrootcert", None)

    query = "&".join(f"{k}={v}" for k, v in params.items())
    dsn = urlunparse(parsed._replace(query=query))
    return psycopg2.connect(dsn=dsn, connect_timeout=30)


def list_public_tables(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
            """
        )
        return [
            r[0]
            for r in cur.fetchall()
            if r[0] not in EXCLUDE_TABLES and not SKIP_TABLES.match(r[0])
        ]


def quote_table(table: str) -> str:
    if re.match(r"^[a-z_][a-z0-9_]*$", table):
        return f"public.{table}"
    return f'public."{table}"'


def copyable_columns(conn, table: str) -> list[str]:
    """Columns safe for COPY (skip generated columns)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.attname
            FROM pg_attribute a
            JOIN pg_class c ON a.attrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public' AND c.relname = %s
              AND a.attnum > 0 AND NOT a.attisdropped
              AND COALESCE(a.attgenerated, '') = ''
            ORDER BY a.attnum
            """,
            (table,),
        )
        return [r[0] for r in cur.fetchall()]


def table_exists(conn, table: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = %s",
            (table,),
        )
        return cur.fetchone() is not None


def migrate_table(
    source_url: str,
    target_url: str,
    table: str,
) -> tuple[str, int, float | str]:
    t0 = time.time()
    try:
        src = connect(source_url)
        tgt = connect(target_url)
        src.autocommit = True
        tgt.autocommit = True

        if not table_exists(tgt, table):
            tgt.close()
            src.close()
            return (table, 0, "skipped (missing on target)")

        cols = copyable_columns(src, table)
        if not cols:
            src.close()
            tgt.close()
            return (table, 0, "skipped (no columns)")

        qt = quote_table(table)
        cols_csv = ", ".join(f'"{c}"' if c != c.lower() else c for c in cols)
        copy_out = f"COPY (SELECT {cols_csv} FROM {qt}) TO STDOUT WITH (FORMAT csv, HEADER false)"
        copy_in = f"COPY {qt} ({cols_csv}) FROM STDIN WITH (FORMAT csv)"

        buf = io.StringIO()
        with src.cursor() as scur:
            scur.copy_expert(copy_out, buf)
        data = buf.getvalue()
        rows = 0 if not data.strip() else data.count("\n")

        with tgt.cursor() as tcur:
            tcur.execute(f"TRUNCATE TABLE {qt} CASCADE")
            if data.strip():
                tcur.copy_expert(copy_in, io.StringIO(data))

        src.close()
        tgt.close()
        return (table, rows, time.time() - t0)
    except Exception as e:
        return (table, 0, str(e))


def main() -> int:
    load_env_file(REPO_ROOT / "cockroachdb" / ".env.local")
    load_env_file(REPO_ROOT / ".env.local")
    load_env_file(REPO_ROOT / ".env.vercel.local")

    source_url = (
        os.environ.get("POSTGRES_URL_NON_POOLING")
        or os.environ.get("POSTGRES_URL")
        or os.environ.get("DATABASE_URL")
    )
    crdb_base = os.environ.get("COCKROACH_DATABASE_URL")
    if not source_url:
        print("Missing POSTGRES_URL in .env.vercel.local", file=sys.stderr)
        return 1
    if not crdb_base:
        print("Missing COCKROACH_DATABASE_URL", file=sys.stderr)
        return 1

    target_url = db_url(crdb_base, TARGET_DB)

    print(f"Source: Supabase Postgres")
    print(f"Target: {TARGET_DB} ({WORKERS} parallel workers)")
    print("Listing public tables on source...")

    with connect(source_url) as conn:
        tables = list_public_tables(conn)

    print(f"Migrating {len(tables)} tables via parallel COPY...")
    ok, fail = 0, 0
    t_start = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {
            pool.submit(migrate_table, source_url, target_url, t): t for t in tables
        }
        for fut in as_completed(futures):
            table, rows, meta = fut.result()
            if isinstance(meta, float):
                ok += 1
                print(f"  OK {table}: ~{rows} rows in {meta:.1f}s")
            else:
                fail += 1
                print(f"  FAIL {table}: {meta}")

    print(f"\nDone in {time.time() - t_start:.1f}s — {ok} ok, {fail} failed")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
