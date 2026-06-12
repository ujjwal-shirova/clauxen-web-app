#!/usr/bin/env node
/**
 * Drop all user databases except system; create clauxen_main.
 * Usage: node cockroachdb/scripts/reset-crdb-databases.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const TARGET_DB = process.env.COCKROACH_TARGET_DATABASE || "clauxen_main";

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
  const opts = { connectionString: url, connectionTimeoutMillis: 30_000 };
  if (process.env.COCKROACH_SSL_REJECT_UNAUTHORIZED === "0") {
    opts.ssl = { rejectUnauthorized: false };
  }
  return opts;
}

async function main() {
  loadEnvLocal(join(REPO_ROOT, "cockroachdb", ".env.local"));
  loadEnvLocal(join(REPO_ROOT, ".env.local"));
  const baseUrl = process.env.COCKROACH_DATABASE_URL;
  if (!baseUrl) throw new Error("COCKROACH_DATABASE_URL not set");

  const client = new Client(pgOpts(databaseUrlForPath(baseUrl, "system")));
  await client.connect();

  const { rows } = await client.query(
    `SELECT datname FROM pg_database WHERE datname NOT IN ('system', 'postgres')`,
  );

  if (process.env.COCKROACH_NO_DROP !== "1") {
    for (const { datname } of rows) {
      if (
        datname === TARGET_DB &&
        process.env.COCKROACH_REUSE_DATABASE === "1"
      ) {
        console.log(`Reusing database ${TARGET_DB}`);
        await client.end();
        return;
      }
      console.log(`Dropping database ${datname}...`);
      await client.query(
        `DROP DATABASE IF EXISTS "${datname.replace(/"/g, '""')}" CASCADE`,
      );
    }
  }

  const exists = rows.some((r) => r.datname === TARGET_DB);
  if (!exists) {
    console.log(`Creating database ${TARGET_DB}...`);
    await client.query(`CREATE DATABASE ${TARGET_DB}`);
  } else {
    console.log(`Database ${TARGET_DB} already exists`);
  }
  await client.end();
  console.log(`Ready: ${TARGET_DB}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
