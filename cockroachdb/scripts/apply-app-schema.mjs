#!/usr/bin/env node
/**
 * Reset clauxen_main and apply the unified application schema.
 * Usage: node cockroachdb/scripts/apply-app-schema.mjs
 *
 * Env: COCKROACH_DATABASE_URL in root `.env.local`
 * Optional: COCKROACH_TARGET_DATABASE=clauxen_main
 *           COCKROACH_SSL_REJECT_UNAUTHORIZED=0
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const TARGET_DB = process.env.COCKROACH_TARGET_DATABASE || "clauxen_main";
const SCHEMA_FILE = join(REPO_ROOT, "cockroachdb", "schema", "clauxen_app.sql");

function loadEnvLocal(path) {
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

function databaseUrlForPath(baseUrl, dbPath) {
  const u = new URL(baseUrl);
  u.pathname = "/" + dbPath.replace(/^\//, "");
  return u.toString();
}

function pgOpts(url) {
  const opts = { connectionString: url, connectionTimeoutMillis: 120_000 };
  if (process.env.COCKROACH_SSL_REJECT_UNAUTHORIZED === "0") {
    opts.ssl = { rejectUnauthorized: false };
  } else {
    opts.ssl = { rejectUnauthorized: false };
  }
  return opts;
}

async function execSql(client, sql, label) {
  console.log(`  → ${label}`);
  await client.query(sql);
}

async function main() {
  loadEnvLocal(join(REPO_ROOT, ".env.local"));

  const baseUrl = process.env.COCKROACH_DATABASE_URL;
  if (!baseUrl) {
    throw new Error("COCKROACH_DATABASE_URL not set in .env.local");
  }

  if (!existsSync(SCHEMA_FILE)) {
    throw new Error(`Schema file missing: ${SCHEMA_FILE}`);
  }

  const schemaSql = readFileSync(SCHEMA_FILE, "utf8");

  // Step 1: reset database
  console.log("Step 1: Reset database...");
  const systemClient = new Client(pgOpts(databaseUrlForPath(baseUrl, "system")));
  await systemClient.connect();

  const { rows: dbs } = await systemClient.query(
    `SELECT datname FROM pg_database WHERE datname NOT IN ('system', 'postgres')`,
  );

  for (const { datname } of dbs) {
    if (datname === TARGET_DB && process.env.COCKROACH_REUSE_DATABASE === "1") {
      console.log(`  Reusing ${TARGET_DB} (drop skipped)`);
      continue;
    }
    console.log(`  Dropping ${datname}...`);
    await systemClient.query(
      `DROP DATABASE IF EXISTS "${datname.replace(/"/g, '""')}" CASCADE`,
    );
  }

  const exists = dbs.some((r) => r.datname === TARGET_DB);
  if (!exists || process.env.COCKROACH_REUSE_DATABASE !== "1") {
    console.log(`  Creating ${TARGET_DB}...`);
    await systemClient.query(`CREATE DATABASE ${TARGET_DB}`);
  }
  await systemClient.end();

  // Step 2: wipe user schemas and apply fresh schema
  console.log(`Step 2: Apply schema to ${TARGET_DB}...`);
  const dbClient = new Client(pgOpts(databaseUrlForPath(baseUrl, TARGET_DB)));
  await dbClient.connect();

  await execSql(
    dbClient,
    `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;`,
    "Reset public schema",
  );
  await execSql(
    dbClient,
    `DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA auth;`,
    "Reset auth schema",
  );
  await execSql(
    dbClient,
    `DROP SCHEMA IF EXISTS storage CASCADE; CREATE SCHEMA storage;`,
    "Reset storage schema",
  );

  console.log("  → Applying clauxen_app.sql...");
  await dbClient.query(schemaSql);

  const { rows: tables } = await dbClient.query(`
    SELECT table_schema, count(*)::int AS n
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'auth', 'storage')
      AND table_type = 'BASE TABLE'
    GROUP BY table_schema
    ORDER BY table_schema
  `);

  await dbClient.end();

  console.log("\n✓ Schema applied successfully");
  for (const row of tables) {
    console.log(`  ${row.table_schema}: ${row.n} tables`);
  }
  const total = tables.reduce((s, r) => s + r.n, 0);
  console.log(`  Total: ${total} tables`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
