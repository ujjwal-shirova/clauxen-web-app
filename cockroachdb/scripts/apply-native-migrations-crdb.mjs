#!/usr/bin/env node
/**
 * Apply cockroachdb/migrations-native/*.sql to clauxen_main (CockroachDB-native DDL).
 * Usage: node cockroachdb/scripts/apply-native-migrations-crdb.mjs
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
  isIndexStatement,
  canBatchStatement,
} from "./crdb-sql-preprocess.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const NATIVE_DIR = join(REPO_ROOT, "cockroachdb", "migrations-native");
const TARGET_DB = process.env.COCKROACH_TARGET_DATABASE || "clauxen_main";
const DEFER_INDEXES = process.env.COCKROACH_DEFER_INDEXES !== "0";
const SKIP_POLICIES = process.env.COCKROACH_SKIP_POLICIES === "1";

function shouldSkipStatement(stmt) {
  if (!SKIP_POLICIES) return false;
  const n = stmt
    .replace(/^\s*--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return (
    n.startsWith("create policy") ||
    n.startsWith("drop policy") ||
    n.includes("enable row level security")
  );
}
const BATCH_SIZE = Number(process.env.COCKROACH_BATCH_SIZE) || 15;
const STATEMENT_TIMEOUT = process.env.COCKROACH_STATEMENT_TIMEOUT || "15min";

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
    process.env[m[1]] = val;
  }
}

function databaseUrlForPath(baseUrl, dbPath) {
  const u = new URL(baseUrl);
  u.pathname = "/" + dbPath.replace(/^\//, "");
  return u.toString();
}

function pgOpts(url) {
  return {
    connectionString: url,
    connectionTimeoutMillis: 30_000,
    query_timeout: Number(process.env.COCKROACH_QUERY_TIMEOUT_MS) || 900_000,
    ssl:
      process.env.COCKROACH_SSL_REJECT_UNAUTHORIZED === "0"
        ? { rejectUnauthorized: false }
        : undefined,
  };
}

function rewriteEnvDb(filePath, dbName) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  const out = text.replace(
    /^(COCKROACH_DATABASE_URL=postgresql:\/\/[^/]+\/)[^/?\s#]+/gm,
    (_, prefix) => `${prefix}${dbName}`,
  );
  if (out !== text) writeFileSync(filePath, out, "utf8");
}

async function main() {
  loadEnvLocal(join(REPO_ROOT, "cockroachdb", ".env.local"));
  loadEnvLocal(join(REPO_ROOT, ".env.local"));
  const baseUrl = process.env.COCKROACH_DATABASE_URL;
  if (!baseUrl) throw new Error("COCKROACH_DATABASE_URL not set");

  const targetUrl = databaseUrlForPath(baseUrl, TARGET_DB);
  const client = new Client(pgOpts(targetUrl));
  console.log(`Connecting to ${TARGET_DB}...`);
  await client.connect();
  await client.query(`SET statement_timeout = '${STATEMENT_TIMEOUT}'`);

  const files = readdirSync(NATIVE_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const deferredIndexes = [];
  const batchQueue = [];

  async function flushBatch(file) {
    if (!batchQueue.length) return;
    const sql =
      batchQueue
        .map((s) => s.replace(/;\s*$/, "").trim())
        .filter(Boolean)
        .join(";\n") + ";";
    batchQueue.length = 0;
    await client.query(sql);
  }

  for (const file of files) {
    console.log(`Applying ${file}...`);
    const sql = readFileSync(join(NATIVE_DIR, file), "utf8");
    const parts = splitSqlStatements(sql);
    for (const stmt of parts) {
      if (shouldSkipStatement(stmt)) continue;
      if (DEFER_INDEXES && isIndexStatement(stmt)) {
        deferredIndexes.push({ stmt, file });
        continue;
      }
      if (canBatchStatement(stmt)) {
        batchQueue.push(stmt);
        if (batchQueue.length >= BATCH_SIZE) await flushBatch(file);
      } else {
        await flushBatch(file);
        await client.query(stmt);
      }
    }
    await flushBatch(file);
  }

  if (deferredIndexes.length) {
    console.log(`Applying ${deferredIndexes.length} deferred indexes...`);
    for (const { stmt, file } of deferredIndexes) {
      try {
        await client.query(stmt);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        writeFileSync(
          join(
            REPO_ROOT,
            "cockroachdb",
            "migrations-native",
            "last-failed.sql",
          ),
          `-- ${file}\n${msg}\n\n${stmt}\n`,
          "utf8",
        );
        throw new Error(`${file}: ${msg}`);
      }
    }
  }

  await client.end();
  rewriteEnvDb(join(REPO_ROOT, "cockroachdb", ".env.local"), TARGET_DB);
  rewriteEnvDb(join(REPO_ROOT, ".env.local"), TARGET_DB);
  console.log(`Done. Database: ${TARGET_DB}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
