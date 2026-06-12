# CockroachDB manual SQL uploads

**Canonical schema intent** remains in `supabase/migrations/`. The SQL files in this folder are **generated for CockroachDB Cloud** (SQL Console / `cockroach sql` uploads) and are overwritten by:

```bash
npm run crdb:prepare-upload-sql
```

That command reads every `supabase/migrations/*.sql`, applies CockroachDB-oriented transforms (strip Supabase-only extensions, realtime publication, PostgREST `NOTIFY`, etc.), and writes results here.

## Integer semantics (INT4 like PostgreSQL)

CockroachDB’s bare `INT` defaults to **64-bit** (`INT8`); PostgreSQL’s `INT` / `INTEGER` is **32-bit** (`INT4`). See [CockroachDB: INT](https://www.cockroachlabs.com/docs/stable/int).

Each generated migration begins with:

```sql
SET default_int_size = 4;
```

so unqualified `INT` / `INTEGER` in that session follow **INT4**-style sizing (Postgres-like). You can also run `00000000000000_cockroach_upload_pragmas.sql` first in a fresh session.

## Upload order

1. `cockroachdb/bootstrap/crdb_supabase_shim.sql` (roles, `auth.users`, `storage.*`, `auth.uid()` stub)
2. `00000000000000_cockroach_upload_pragmas.sql` (optional if each file already sets `default_int_size`)
3. Remaining `2026*.sql` files in **lexical (filename) order**

## Placeholders

- `20260508100000_supabase_extreme_performance_hardening.sql` — noop (Supabase-only extensions and tooling).
- `20260508103000_extension_schema_corrections.sql` — minimal `CREATE SCHEMA IF NOT EXISTS pgmq` only; `pg_net` / `pgmq` installs are omitted.

## Automated apply (optional)

To apply against a cluster from the CLI (reads `supabase/migrations/` live, not this folder):

```bash
npm run crdb:apply-migrations
```
