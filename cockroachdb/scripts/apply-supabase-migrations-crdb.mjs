#!/usr/bin/env node
/**
 * Apply supabase/migrations/*.sql to CockroachDB in filename order.
 * - Loads COCKROACH_DATABASE_URL from cockroachdb/.env.local (do not print secrets).
 * - Creates database "Clauxen-Database-Main", drops defaultdb, applies bootstrap shim,
 *   then runs each migration with light preprocessing (Supabase-only bits stripped).
 *
 * Usage: node cockroachdb/scripts/apply-supabase-migrations-crdb.mjs
 */

import {
  readFileSync,
  readdirSync,
  existsSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import {
  splitSqlStatements,
  preprocessMigration,
  isSchemaOnlyStatement,
  isIndexStatement,
  canBatchStatement,
} from "./crdb-sql-preprocess.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const ENV_LOCAL_CRDB = join(REPO_ROOT, "cockroachdb", ".env.local");
const ENV_LOCAL_ROOT = join(REPO_ROOT, ".env.local");
const SHIM = join(
  REPO_ROOT,
  "cockroachdb",
  "bootstrap",
  "crdb_supabase_shim.sql",
);
const MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");
const SCHEMA_ONLY = process.env.COCKROACH_SCHEMA_ONLY === "1";
const FAST = process.env.COCKROACH_FAST === "1";
const DEFER_INDEXES = FAST || process.env.COCKROACH_DEFER_INDEXES === "1";
const SKIP_RESET = process.env.COCKROACH_SKIP_RESET === "1";
const INDEXES_ONLY = process.env.COCKROACH_INDEXES_ONLY === "1";
const BATCH_SIZE = Number(process.env.COCKROACH_BATCH_SIZE) || 15;
const VERBOSE = process.env.COCKROACH_VERBOSE === "1";
const STATEMENT_TIMEOUT =
  process.env.COCKROACH_STATEMENT_TIMEOUT || (SCHEMA_ONLY ? "20s" : "10min");

/** Migrations that cannot run as-is on CockroachDB (see cockroachdb/migrations/manifest.json). */
const SKIP_FILES = new Set([
  "20260508100000_supabase_extreme_performance_hardening.sql",
]);

function loadEnvLocal(path) {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function databaseUrlForPath(baseUrl, dbPath) {
  const u = new URL(baseUrl);
  const seg = dbPath.replace(/^\//, "");
  u.pathname = "/" + seg;
  return u.toString();
}

function pgClientOptions(url) {
  const opts = {
    connectionString: url,
    connectionTimeoutMillis: 30_000,
    query_timeout: Number(process.env.COCKROACH_QUERY_TIMEOUT_MS) || 600_000,
  };
  if (process.env.COCKROACH_SSL_REJECT_UNAUTHORIZED === "0") {
    opts.ssl = { rejectUnauthorized: false };
  }
  return opts;
}

function rewriteDatabaseInEnvUrl(filePath, newDbName) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  const out = text.replace(
    /^(COCKROACH_DATABASE_URL=postgresql:\/\/[^/]+\/)[^/?\s#]+/gm,
    (_, prefix) => `${prefix}${newDbName}`,
  );
  if (out !== text) writeFileSync(filePath, out, "utf8");
}

function writeManifest(files, log) {
  const dir = join(REPO_ROOT, "cockroachdb", "migrations");
  mkdirSync(dir, { recursive: true });
  const manifest = {
    version: 3,
    generatedAt: new Date().toISOString(),
    description:
      "Last `npm run crdb:apply-migrations` run (reads supabase/migrations). For SQL Console bundles see `npm run crdb:prepare-upload-sql` and cockroachdb/migrations/README.md.",
    targetDatabase: "Clauxen-Database-Main",
    sourcesDirectoryRelativeToRepo: "supabase/migrations",
    uploadBundleDirectoryRelativeToRepo: "cockroachdb/migrations",
    prepareUploadScriptRelativeToRepo:
      "cockroachdb/scripts/prepare-crdb-upload-sql.mjs",
    bootstrapRelativeToRepo: "cockroachdb/bootstrap/crdb_supabase_shim.sql",
    runnerRelativeToRepo:
      "cockroachdb/scripts/apply-supabase-migrations-crdb.mjs",
    files: files.map((name) => ({
      name,
      skippedOnCockroachDb: SKIP_FILES.has(name),
    })),
    lastRunLog: log,
  };
  writeFileSync(
    join(dir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

async function run() {
  loadEnvLocal(ENV_LOCAL_CRDB);
  loadEnvLocal(ENV_LOCAL_ROOT);
  const baseUrl = process.env.COCKROACH_DATABASE_URL;
  if (!baseUrl) {
    throw new Error(
      "COCKROACH_DATABASE_URL not set. Add it to cockroachdb/.env.local and/or .env.local (see cockroachdb/.env.example).",
    );
  }

  const systemUrl = databaseUrlForPath(baseUrl, "system");
  const targetDb = "Clauxen-Database-Main";
  const targetUrl = databaseUrlForPath(baseUrl, targetDb);

  const admin = new Client(pgClientOptions(systemUrl));
  const modeLabel = [
    SCHEMA_ONLY && "schema-only",
    FAST && "fast",
    DEFER_INDEXES && "defer-indexes",
    INDEXES_ONLY && "indexes-only",
    SKIP_RESET && "skip-reset",
  ]
    .filter(Boolean)
    .join(", ");
  console.log(
    `Connecting to CockroachDB system database${modeLabel ? ` (${modeLabel})` : ""}...`,
  );
  await admin.connect();
  if (!SKIP_RESET && !INDEXES_ONLY) {
    console.log('Dropping existing "Clauxen-Database-Main" if present...');
    await admin.query(
      `DROP DATABASE IF EXISTS "Clauxen-Database-Main" CASCADE`,
    );
    console.log("Dropping defaultdb if present...");
    await admin.query(`DROP DATABASE IF EXISTS defaultdb CASCADE`);
    console.log('Creating "Clauxen-Database-Main"...');
    await admin.query(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`);
  } else {
    const exists = await admin.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb],
    );
    if (exists.rowCount === 0) {
      console.log('Creating "Clauxen-Database-Main"...');
      await admin.query(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`);
    } else {
      console.log('Using existing "Clauxen-Database-Main"...');
    }
  }
  await admin.end();

  const targetClient = new Client(pgClientOptions(targetUrl));
  console.log('Connecting to "Clauxen-Database-Main"...');
  await targetClient.connect();
  await targetClient.query(`SET statement_timeout = '${STATEMENT_TIMEOUT}'`);

  const deferredIndexes = [];

  async function flushBatch(queue, file, nRef) {
    if (!queue.length) return;
    const batch = queue.splice(0, queue.length);
    const sql =
      batch
        .map((s) => s.replace(/;\s*$/, "").trim())
        .filter(Boolean)
        .join(";\n") + ";";
    try {
      await targetClient.query(sql);
      nRef.count += batch.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      mkdirSync(join(REPO_ROOT, "cockroachdb", "migrations"), {
        recursive: true,
      });
      writeFileSync(
        join(REPO_ROOT, "cockroachdb", "migrations", "last-failed.sql"),
        `-- Source: ${file}\n-- Batched ${batch.length} statements\n-- Error: ${msg}\n\n${sql}\n`,
        "utf8",
      );
      throw new Error(
        `In ${file} after ${nRef.count} statements (batch of ${batch.length}):\n${msg}`,
      );
    }
  }

  async function applyStatement(stmt, file, nRef, batchQueue) {
    const head = stmt.slice(0, 120).replace(/\s+/g, " ");
    if (INDEXES_ONLY && !isIndexStatement(stmt)) return "skip";
    if (!INDEXES_ONLY && SCHEMA_ONLY && !isSchemaOnlyStatement(stmt))
      return "skip";
    if (DEFER_INDEXES && !INDEXES_ONLY && isIndexStatement(stmt)) {
      deferredIndexes.push({ stmt, file });
      return "defer";
    }
    if (VERBOSE) console.log(`  ${file}: ${head}`);
    if (!VERBOSE && !FAST) {
      writeFileSync(
        join(REPO_ROOT, "cockroachdb", "migrations", "current-statement.sql"),
        `-- Source: ${file}\n\n${stmt}\n`,
        "utf8",
      );
    }
    if (FAST && canBatchStatement(stmt)) {
      batchQueue.push(stmt);
      if (batchQueue.length >= BATCH_SIZE)
        await flushBatch(batchQueue, file, nRef);
      return "batched";
    }
    await flushBatch(batchQueue, file, nRef);
    await targetClient.query(stmt);
    nRef.count++;
    return "ok";
  }

  if (!INDEXES_ONLY) {
    const shimSql = readFileSync(SHIM, "utf8");
    console.log("Applying CockroachDB Supabase shim...");
    const shimQueue = [];
    const shimRef = { count: 0 };
    for (const stmt of splitSqlStatements(shimSql)) {
      await applyStatement(stmt, "shim", shimRef, shimQueue);
    }
    await flushBatch(shimQueue, "shim", shimRef);
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const log = [];
  for (const file of files) {
    if (SKIP_FILES.has(file)) {
      console.log(`SKIP ${file}`);
      log.push(
        `SKIP ${file} (CockroachDB compatibility — see cockroachdb/README.md)`,
      );
      continue;
    }
    console.log(`Applying ${file}...`);
    const path = join(MIGRATIONS_DIR, file);
    const raw = readFileSync(path, "utf8");
    const sql = preprocessMigration(raw, file);
    const parts = splitSqlStatements(sql);
    const nRef = { count: 0 };
    let skipped = 0;
    let deferred = 0;
    const batchQueue = [];
    for (const stmt of parts) {
      try {
        const r = await applyStatement(stmt, file, nRef, batchQueue);
        if (r === "skip") skipped++;
        if (r === "defer") deferred++;
      } catch (e) {
        throw e;
      }
    }
    await flushBatch(batchQueue, file, nRef);
    log.push(
      `OK ${file} (${nRef.count} statements${skipped ? `, ${skipped} skipped` : ""}${deferred ? `, ${deferred} indexes deferred` : ""})`,
    );
  }

  if (deferredIndexes.length) {
    console.log(
      `\nApplying ${deferredIndexes.length} deferred indexes (this phase is slower)...`,
    );
    let idx = 0;
    for (const { stmt, file } of deferredIndexes) {
      idx++;
      if (idx % 10 === 0)
        console.log(`  index ${idx}/${deferredIndexes.length}...`);
      try {
        await targetClient.query(stmt);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        writeFileSync(
          join(REPO_ROOT, "cockroachdb", "migrations", "last-failed.sql"),
          `-- Source: ${file}\n-- Deferred index ${idx}\n-- Error: ${msg}\n\n${stmt}\n`,
          "utf8",
        );
        throw new Error(`Deferred index ${idx} from ${file}: ${msg}`);
      }
    }
    log.push(`OK deferred indexes (${deferredIndexes.length})`);
  }

  await targetClient.end();

  rewriteDatabaseInEnvUrl(ENV_LOCAL_CRDB, targetDb);
  rewriteDatabaseInEnvUrl(ENV_LOCAL_ROOT, targetDb);

  writeManifest(files, log);

  for (const line of log) console.log(line);
  console.log(`\nTarget database: "${targetDb}"`);
}

run().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
