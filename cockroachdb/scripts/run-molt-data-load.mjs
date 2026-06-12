#!/usr/bin/env node
/**
 * Run MOLT fetch (Postgres -> CockroachDB) after native schema is applied.
 * Requires: .tools/molt binary, POSTGRES_URL in .env.vercel.local, COCKROACH_DATABASE_URL.
 */

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const MOLT = join(REPO_ROOT, ".tools", "molt");
const TARGET_DB = process.env.COCKROACH_TARGET_DATABASE || "clauxen_main";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

function targetUrl(base, db) {
  const u = new URL(base);
  u.pathname = `/${db}`;
  return u.toString();
}

function main() {
  loadEnv(join(REPO_ROOT, "cockroachdb", ".env.local"));
  loadEnv(join(REPO_ROOT, ".env.local"));
  loadEnv(join(REPO_ROOT, ".env.vercel.local"));

  const source =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;
  const targetBase = process.env.COCKROACH_DATABASE_URL;
  if (!source) throw new Error("Set POSTGRES_URL in .env.vercel.local");
  if (!targetBase) throw new Error("Set COCKROACH_DATABASE_URL");
  if (!existsSync(MOLT)) throw new Error(`Install molt at ${MOLT}`);

  const target = targetUrl(targetBase, TARGET_DB);
  const args = [
    "fetch",
    "--source",
    source,
    "--target",
    target,
    "--mode",
    "data-load",
    "--schema-filter",
    "public",
    "--table-exclusion-filter",
    process.env.COCKROACH_MOLT_EXCLUDE_TABLES || "embeddings",
    "--table-handling",
    process.env.COCKROACH_MOLT_TABLE_HANDLING ||
      (process.env.COCKROACH_MOLT_SCHEMA_ONLY === "1"
        ? "drop-on-target-and-recreate"
        : "truncate-if-exists"),
    "--table-concurrency",
    process.env.COCKROACH_MOLT_TABLE_CONCURRENCY || "16",
    "--export-concurrency",
    process.env.COCKROACH_MOLT_EXPORT_CONCURRENCY || "16",
    "--use-stats-based-sharding",
    "--ignore-replication-check",
    "--direct-copy",
    "--non-interactive",
    "--logging",
    "info",
  ];

  console.log(`MOLT fetch: Supabase Postgres -> ${TARGET_DB} (direct-copy)`);
  const r = spawnSync(MOLT, args, { stdio: "inherit", env: process.env });
  process.exit(r.status ?? 1);
}

main();
