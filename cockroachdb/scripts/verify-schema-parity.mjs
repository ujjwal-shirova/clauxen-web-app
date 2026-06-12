#!/usr/bin/env node
/**
 * Cross-verify Supabase public schema vs clauxen_main on CockroachDB.
 * Usage: node cockroachdb/scripts/verify-schema-parity.mjs
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { loadCrdbEnv, pgClientOpts, targetDbUrl } from "./load-env.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const TARGET_DB = process.env.COCKROACH_TARGET_DATABASE || "clauxen_main";
const SKIP_TABLES = new Set(
  (process.env.COCKROACH_VERIFY_SKIP || "embeddings")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const MOLT_PREFIX = "_molt_";

async function columnMap(url, db) {
  const c = new Client(pgClientOpts(db ? targetDbUrl(url, db) : url));
  await c.connect();
  const { rows } = await c.query(`
    SELECT table_name, column_name, ordinal_position, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  await c.end();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.table_name)) map.set(r.table_name, []);
    map.get(r.table_name).push(r);
  }
  return map;
}

function mainReport(src, tgt) {
  const srcTables = [...src.keys()].filter((t) => !t.startsWith(MOLT_PREFIX));
  const tgtApp = [...tgt.keys()].filter((t) => !t.startsWith(MOLT_PREFIX));
  const molt = [...tgt.keys()].filter((t) => t.startsWith(MOLT_PREFIX));

  const onlySrc = srcTables.filter((t) => !tgt.has(t) && !SKIP_TABLES.has(t));
  const onlyTgt = tgtApp.filter((t) => !src.has(t));
  const skipped = srcTables.filter((t) => SKIP_TABLES.has(t));

  const colMismatches = [];
  const typeNotes = [];
  let colOk = 0;

  for (const table of srcTables) {
    if (SKIP_TABLES.has(table) || !tgt.has(table)) continue;
    const sCols = src.get(table).map((c) => c.column_name);
    const tCols = tgt.get(table).map((c) => c.column_name);
    if (sCols.join("|") !== tCols.join("|")) {
      colMismatches.push(table);
      continue;
    }
    colOk++;
    for (const sc of src.get(table)) {
      const tc = tgt.get(table).find((c) => c.column_name === sc.column_name);
      if (!tc) continue;
      if (sc.udt_name !== tc.udt_name) {
        if (
          sc.udt_name === "citext" &&
          (tc.udt_name === "text" || tc.udt_name === "string")
        ) {
          typeNotes.push(
            `${table}.${sc.column_name}: citext → ${tc.udt_name} (expected)`,
          );
        } else {
          typeNotes.push(
            `${table}.${sc.column_name}: ${sc.udt_name} → ${tc.udt_name}`,
          );
        }
      }
    }
  }

  console.log("══════════════════════════════════════════════════");
  console.log("  Schema parity: Supabase ↔ CockroachDB");
  console.log("══════════════════════════════════════════════════\n");
  console.log(`Supabase public tables:     ${srcTables.length}`);
  console.log(`CRDB ${TARGET_DB} app tables:  ${tgtApp.length}`);
  console.log(
    `CRDB MOLT internal tables:  ${molt.length ? molt.join(", ") : "(none)"}`,
  );
  console.log(`Intentionally skipped:      ${skipped.join(", ") || "(none)"}`);
  console.log(
    `\nOnly on Supabase:           ${onlySrc.length ? onlySrc.join(", ") : "(none)"}`,
  );
  console.log(
    `Only on CRDB (unexpected):  ${onlyTgt.length ? onlyTgt.join(", ") : "(none)"}`,
  );
  console.log(
    `\nColumn names (shared):      ${colOk} OK, ${colMismatches.length} mismatches`,
  );
  if (colMismatches.length)
    console.log("  Mismatched:", colMismatches.join(", "));
  if (typeNotes.length) {
    console.log(`\nType mapping notes (${typeNotes.length}):`);
    typeNotes.slice(0, 20).forEach((n) => console.log("  ", n));
    if (typeNotes.length > 20)
      console.log(`  ... +${typeNotes.length - 20} more`);
  }

  const pass =
    onlySrc.length === 0 &&
    onlyTgt.length === 0 &&
    colMismatches.length === 0 &&
    colOk >= tgtApp.length;

  console.log(
    pass ? "\n✓ SCHEMA VERIFICATION PASSED" : "\n✗ SCHEMA VERIFICATION FAILED",
  );
  process.exit(pass ? 0 : 1);
}

loadCrdbEnv(REPO_ROOT);

const srcUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const tgtBase = process.env.COCKROACH_DATABASE_URL;
if (!srcUrl || !tgtBase) {
  console.error("Need POSTGRES_URL* and COCKROACH_DATABASE_URL in env files");
  process.exit(1);
}

const src = await columnMap(srcUrl);
const tgt = await columnMap(tgtBase, TARGET_DB);
mainReport(src, tgt);
