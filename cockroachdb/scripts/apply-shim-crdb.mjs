#!/usr/bin/env node
/** Apply pragmas + bootstrap shim only (seconds). */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { splitSqlStatements } from "./crdb-sql-preprocess.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
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
    process.env[m[1]] = val;
  }
}

async function main() {
  loadEnv(join(REPO_ROOT, "cockroachdb", ".env.local"));
  loadEnv(join(REPO_ROOT, ".env.local"));
  const base = process.env.COCKROACH_DATABASE_URL;
  if (!base) throw new Error("COCKROACH_DATABASE_URL not set");

  const u = new URL(base);
  u.pathname = `/${TARGET_DB}`;
  const client = new Client({
    connectionString: u.toString(),
    connectionTimeoutMillis: 30_000,
    ssl:
      process.env.COCKROACH_SSL_REJECT_UNAUTHORIZED === "0"
        ? { rejectUnauthorized: false }
        : undefined,
  });
  await client.connect();
  await client.query("SET default_int_size = 4");
  await client.query("SET statement_timeout = '5min'");

  for (const file of ["001_pragmas.sql", "002_bootstrap_shim.sql"]) {
    const path = join(REPO_ROOT, "cockroachdb", "migrations-native", file);
    console.log(`Applying ${file}...`);
    for (const stmt of splitSqlStatements(readFileSync(path, "utf8"))) {
      await client.query(stmt);
    }
  }
  await client.end();
  console.log(`Shim ready on ${TARGET_DB}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
