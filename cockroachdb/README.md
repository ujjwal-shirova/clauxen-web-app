# CockroachDB (Clauxen)

## Unified application schema (recommended)

The app uses a **focused schema** in `cockroachdb/schema/clauxen_app.sql` (~40 tables):
auth, settings, projects, chats, RAG, billing, workspaces, and R2-backed file metadata.

**Apply (drops and recreates `clauxen_main`):**

```bash
# Requires COCKROACH_DATABASE_URL in root `.env.local`
npm run crdb:apply-app
```

**Local dev (no Cloud RU):**

```bash
docker compose up -d cockroach
export COCKROACH_DATABASE_URL='postgresql://root@127.0.0.1:26257/clauxen_main?sslmode=disable'
npm run crdb:apply-app
```

**Object storage:** files go to Cloudflare R2 buckets:

| Env var | Default bucket | Use |
|---|---|---|
| `R2_IMAGES_BUCKET` | `clauxen-images` | Images |
| `R2_DOCUMENTS_BUCKET` | `clauxen-documents` | Project/library docs (RAG) |
| `R2_ARTIFACTS_BUCKET` | `clauxen-artifacts` | Chat-generated files |
| `R2_SKILLS_BUCKET` | `clauxen-skills` | Connector skill packages |
| `R2_CHAT_ARCHIVES_BUCKET` | `clauxen-chat-archives` | Chat JSON archives |

Set `R2_S3_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` in root `.env.local`. On Vercel, R2 is required (no local disk). See `docs/vercel-deployment.md`.

---

Project-local notes and **non-committed** env for the CockroachDB Cloud cluster.

## Connection string vs `ccloud` CLI

- **Connection string** (`COCKROACH_DATABASE_URL`): enough for application drivers, `psql`, and `cockroach sql` against the cluster. You do **not** need the `ccloud` CLI just to run SQL or migrations.
- **`ccloud` CLI**: optional; used for **org/project/cluster** administration (create clusters, manage users, etc.). Use it if you want that workflow; it is not a substitute for a SQL URL.

## Local env

All secrets live in **one file**: root `.env.local` (gitignored).

Set `COCKROACH_DATABASE_URL` there. Next.js and `npm run crdb:*` scripts read this file automatically.

Do not create `.env`, `.env.example`, or `cockroachdb/.env.local`.

## Next.js / app wiring

Next.js loads env from the repository root `.env.local` only.

## `sslmode=verify-full`

Verify-full checks the server hostname against the certificate. If a client fails to connect, confirm you use the host from the Cloud console and that your client loads the correct CA bundle (CockroachDB documents cluster connection TLS for each client).

## Security

If a database password was ever pasted into chat, a ticket, or a PR, **rotate it** in CockroachDB Cloud and update `.env.local`.

## Apply Supabase SQL migrations to CockroachDB

Supabase migrations under `supabase/migrations/` target **Postgres + Supabase** (extensions, `auth.users`, `storage.*`, `supabase_realtime`, `pg_cron`, etc.). CockroachDB is **not** a drop-in host for every statement.

This repo includes a **best-effort** runner that:

1. Loads `COCKROACH_DATABASE_URL` from `cockroachdb/.env.local`, then **overrides** from the repo root `.env.local` if present.
2. Connects to `system`, drops `defaultdb` and any existing `"Clauxen-Database-Main"`, then creates **`"Clauxen-Database-Main"`** (quoted identifier; hyphens preserved).
3. Applies `cockroachdb/bootstrap/crdb_supabase_shim.sql` (stub `auth.users`, `auth.uid()`, `storage.*`, `storage.foldername`, Supabase-like roles).
4. Runs each `supabase/migrations/*.sql` in filename order with preprocessing (see `cockroachdb/scripts/apply-supabase-migrations-crdb.mjs`). A **mirror index** lives in `cockroachdb/migrations/manifest.json` (refreshed after each successful run).

**Skipped on CRDB** (see `cockroachdb/migrations/manifest.json` — follow-up port if you need these features):

- `20260507203000_performance_advisor_rls_cleanup.sql` — dynamic rewrite via `pg_policies` (not portable).
- `20260508100000_supabase_extreme_performance_hardening.sql` — pg_stat_statements views, pg_prewarm, HNSW `set_config`, extension-heavy RPC replacements.
- `20260508102000_platform_extension_identity_expansion.sql` — many Postgres extensions, FTS, PGMQ, pgaudit wiring.
- `20260508104000_oauth_fk_covering_indexes.sql` — depends on OAuth tables from the skipped migration.
- `20260508111000_model_training_priority_governance_expansion.sql` — alters tables from the skipped migration.

Run after fixing SQL user credentials:

```bash
npm run crdb:apply-migrations
```

On success, the script rewrites the database segment in `COCKROACH_DATABASE_URL` inside `cockroachdb/.env.local` and root `.env.local` (if those files define that variable) to **`Clauxen-Database-Main`** without printing the URL.

If you see **`password authentication failed`**, open CockroachDB Cloud → SQL Users, reset the password for your SQL user, and paste the new connection string into `cockroachdb/.env.local` (and root `.env.local` if you keep a copy there).

Optional for local TLS issues only:

```bash
export COCKROACH_SSL_REJECT_UNAUTHORIZED=0
npm run crdb:apply-migrations
```

## Fast schema (tables only) — recommended path

Use **one** MOLT `fetch` against `clauxen_main`, not four parallel processes and not `npm run crdb:apply-migrations` (remote DDL for hours).

```bash
# Tables only; skips if 87+ public tables already exist
npm run crdb:schema-fast

# Rebuild from scratch (DROP DATABASE is slow on Cloud — often 60–90s)
COCKROACH_SCHEMA_FRESH=1 npm run crdb:schema-fast
```

Tuning (defaults: 1 MOLT process, `table-concurrency=32`):

```bash
COCKROACH_SCHEMA_TABLE_CONCURRENCY=32 npm run crdb:schema-fast
```

**Why migrations felt “stuck” at 0/88**

- MOLT runs an 11-step pipeline. Steps 1–5 (privilege check, table verification) hit **Supabase over the network** (~2s per connect; pooler adds latency). Auth succeeded (`privilege check completed successfully`); the progress bar only counted `creating new table` lines, so it stayed at 0/88 for ~15–20s per chunk.
- **Four parallel MOLT processes** on one `clauxen_main` database contend on catalog writes and look hung; Cockroach’s design is **one fetch + `--table-concurrency`**.
- `COCKROACH_SCHEMA_FRESH=1` runs `DROP DATABASE … CASCADE` first (very slow on Cloud).

**Source connection:** point `POSTGRES_URL_NON_POOLING` at Supabase **direct** host `db.<project>.supabase.co:5432`, not `*.pooler.supabase.com`, for catalog introspection.

**Excluded:** `embeddings` (pgvector) — add later with Cockroach `VECTOR` or keep on Supabase.

**Data load (after schema):** `MIGRATE_WORKERS=12 npm run crdb:migrate:python`
