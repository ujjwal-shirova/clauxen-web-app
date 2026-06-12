#!/usr/bin/env node
/**
 * Fast schema-only migration: parallel chunked MOLT (drop-on-target-and-recreate per table).
 * - Inventories live public tables from Supabase (source of truth for shape).
 * - Splits into chunks; runs multiple MOLT fetch processes in parallel (schema + empty data).
 * - Streams logs; renders multi progress bars in the terminal.
 *
 * Usage:
 *   npm run crdb:schema-fast
 *   COCKROACH_SCHEMA_PARALLEL=6 COCKROACH_SCHEMA_TABLE_CONCURRENCY=12 npm run crdb:schema-fast
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { loadCrdbEnv, pgClientOpts, targetDbUrl } from "./load-env.mjs";
import {
  normalizeMoltSourceUrl,
  normalizeMoltTargetUrl,
} from "./normalize-molt-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const MOLT = join(REPO_ROOT, ".tools", "molt");
const TYPE_MAP_FILE = join(REPO_ROOT, "cockroachdb", "molt-type-map.json");
const TARGET_DB = process.env.COCKROACH_TARGET_DATABASE || "clauxen_main";
const METRICS_BASE = Number(process.env.COCKROACH_MOLT_METRICS_PORT) || 3040;

const EXCLUDE_TABLES = new Set(
  (process.env.COCKROACH_MOLT_EXCLUDE_TABLES || "embeddings")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

/** Cockroach recommends one MOLT process + high table-concurrency, not N parallel fetch processes. */
const PARALLEL = Math.max(
  1,
  Number(process.env.COCKROACH_SCHEMA_PARALLEL) || 1,
);
const CHUNK_SIZE = Number(process.env.COCKROACH_SCHEMA_CHUNK_SIZE) || 0;
const TABLE_CONCURRENCY =
  Number(process.env.COCKROACH_SCHEMA_TABLE_CONCURRENCY) ||
  Number(process.env.COCKROACH_MOLT_TABLE_CONCURRENCY) ||
  32;
const EXPORT_CONCURRENCY =
  Number(process.env.COCKROACH_SCHEMA_EXPORT_CONCURRENCY) ||
  Number(process.env.COCKROACH_MOLT_EXPORT_CONCURRENCY) ||
  12;

/** Escape table name for POSIX regex alternation. */
function regexEscape(name) {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function bar(done, total, width = 28) {
  if (total <= 0) return "░".repeat(width);
  const n = Math.min(width, Math.round((done / total) * width));
  return "█".repeat(n) + "░".repeat(width - n);
}

const MOLT_STEPS = [
  "fetch_transformation_validation",
  "fetch_privilege_check",
  "fetch_status_initialization",
  "fetch_config_setup",
  "fetch_table_verification",
  "fetch_schema_creation",
  "fetch_post_handling_verification",
];

class ProgressUI {
  constructor(totalTables, chunks) {
    this.totalTables = totalTables;
    this.chunks = chunks;
    this.doneTables = new Set();
    this.chunkDone = chunks.map(() => 0);
    this.chunkTotal = chunks.map((c) => c.length);
    this.chunkStatus = chunks.map(() => "pending");
    this.chunkStep = chunks.map(() => "starting");
    this.chunkLabel = chunks.map((_, i) => `Chunk ${i + 1}/${chunks.length}`);
    this.started = Date.now();
    this.timer = null;
  }

  setChunkStep(i, step) {
    this.chunkStep[i] = step;
  }

  markTable(table) {
    if (!this.doneTables.has(table)) {
      this.doneTables.add(table);
    }
  }

  setChunkStatus(i, status) {
    this.chunkStatus[i] = status;
  }

  bumpChunk(i) {
    this.chunkDone[i] = Math.min(this.chunkTotal[i], this.chunkDone[i] + 1);
  }

  render() {
    const elapsed = ((Date.now() - this.started) / 1000).toFixed(0);
    const lines = [];
    lines.push("");
    lines.push(
      `Overall  [${bar(this.doneTables.size, this.totalTables)}] ${this.doneTables.size}/${this.totalTables} tables  (${elapsed}s)`,
    );
    for (let i = 0; i < this.chunks.length; i++) {
      const st = this.chunkStatus[i];
      const extra =
        st === "running"
          ? `${this.chunkStep[i]} · ${this.chunkDone[i]}/${this.chunkTotal[i]} tables`
          : st === "done"
            ? "done"
            : st === "failed"
              ? "FAILED"
              : "waiting";
      lines.push(
        `${this.chunkLabel[i].padEnd(12)} [${bar(this.chunkDone[i], this.chunkTotal[i], 20)}] ${extra}`,
      );
    }
    lines.push("");
    // Move cursor up and overwrite (simple refresh)
    const prev = this._lastLines || 0;
    if (prev > 0) process.stdout.write(`\x1b[${prev}A`);
    process.stdout.write(lines.join("\n") + "\n");
    this._lastLines = lines.length;
  }

  start() {
    this.render();
    this.timer = setInterval(() => this.render(), 400);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.render();
  }
}

async function ensureDatabase() {
  const base = process.env.COCKROACH_DATABASE_URL;
  const client = new Client(pgClientOpts(targetDbUrl(base, "system")));
  await client.connect();

  if (process.env.COCKROACH_SCHEMA_FRESH === "1") {
    console.log(`Dropping database ${TARGET_DB} (COCKROACH_SCHEMA_FRESH=1)...`);
    await client.query(
      `DROP DATABASE IF EXISTS "${TARGET_DB.replace(/"/g, '""')}" CASCADE`,
    );
  }

  const { rows } = await client.query(
    `SELECT datname FROM pg_database WHERE datname = $1`,
    [TARGET_DB],
  );
  if (rows.length === 0) {
    console.log(`Creating database ${TARGET_DB}...`);
    await client.query(`CREATE DATABASE ${TARGET_DB}`);
  } else {
    console.log(`Database ${TARGET_DB} already exists`);
  }
  await client.end();
}

async function listSourceTables(sourceUrl) {
  const client = new Client(pgClientOpts(sourceUrl));
  await client.connect();
  const { rows } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  await client.end();
  return rows
    .map((r) => r.tablename)
    .filter((t) => !EXCLUDE_TABLES.has(t) && !t.startsWith("_molt"));
}

function inventoryFromMigrations() {
  const dir = join(REPO_ROOT, "supabase", "migrations");
  const names = new Set();
  const re =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?("?)([a-z0-9_-]+)\1/gi;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(dir, file), "utf8");
    let m;
    while ((m = re.exec(sql)) !== null) names.add(m[2]);
  }
  return [...names].sort();
}

async function applyShim() {
  const { spawnSync } = await import("node:child_process");
  console.log("Applying bootstrap shim (auth/storage stubs)...");
  const r = spawnSync(
    process.execPath,
    [join(__dirname, "apply-shim-crdb.mjs")],
    { stdio: "inherit", env: process.env, cwd: REPO_ROOT },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function parseMoltLine(line, chunkTables, ui, chunkIndex) {
  const trimmed = line.trim();
  if (!trimmed) return;

  for (const step of MOLT_STEPS) {
    if (trimmed.includes(step)) {
      ui.setChunkStep(chunkIndex, step.replace("fetch_", ""));
    }
  }
  if (trimmed.includes("creating new table")) {
    ui.setChunkStep(chunkIndex, "creating tables");
  }
  if (trimmed.includes("schema creation completed")) {
    ui.setChunkStep(chunkIndex, "schema done");
  }

  // Console writer / info logs often mention table names
  for (const table of chunkTables) {
    if (
      trimmed.includes(` ${table} `) ||
      trimmed.includes(`"${table}"`) ||
      trimmed.includes(`.${table}`) ||
      trimmed.includes(`'${table}'`) ||
      trimmed.endsWith(` ${table}`) ||
      trimmed.includes(`table ${table}`)
    ) {
      ui.markTable(table);
      ui.bumpChunk(chunkIndex);
    }
  }

  if (/completed|finished|success/i.test(trimmed)) {
    for (const table of chunkTables) {
      if (trimmed.toLowerCase().includes(table.toLowerCase())) {
        ui.markTable(table);
      }
    }
  }
}

function runMoltChunk({
  chunkIndex,
  tables,
  sourceUrl,
  targetUrl,
  ui,
  compileOnly,
}) {
  const filter = `^(${tables.map(regexEscape).join("|")})$`;
  const args = [
    "fetch",
    "--source",
    sourceUrl,
    "--target",
    targetUrl,
    "--mode",
    "data-load",
    "--schema-filter",
    "public",
    "--table-filter",
    filter,
    "--table-handling",
    "drop-on-target-and-recreate",
    "--table-concurrency",
    String(TABLE_CONCURRENCY),
    "--export-concurrency",
    String(EXPORT_CONCURRENCY),
    "--direct-copy",
    "--ignore-replication-check",
    "--non-interactive",
    "--use-console-writer",
    "--logging",
    process.env.COCKROACH_MOLT_LOGGING || "info",
    "--use-stats-based-sharding",
    "--type-map-file",
    TYPE_MAP_FILE,
    "--metrics-listen-addr",
    `127.0.0.1:${METRICS_BASE + chunkIndex * 2}`,
    "--pprof-listen-addr",
    `127.0.0.1:${METRICS_BASE + chunkIndex * 2 + 1}`,
  ];

  if (!existsSync(TYPE_MAP_FILE)) {
    throw new Error(`Missing type map: ${TYPE_MAP_FILE}`);
  }

  return new Promise((resolve, reject) => {
    ui.setChunkStatus(chunkIndex, "running");
    console.log(
      `\n▶ Chunk ${chunkIndex + 1}: ${tables.length} tables (${tables.slice(0, 3).join(", ")}${tables.length > 3 ? ", …" : ""})`,
    );
    console.log(
      `  filter: ${filter.slice(0, 120)}${filter.length > 120 ? "…" : ""}`,
    );

    const child = spawn(MOLT, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const onData = (buf) => {
      const text = buf.toString();
      process.stdout.write(text);
      for (const line of text.split("\n")) {
        parseMoltLine(line, tables, ui, chunkIndex);
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    child.on("close", (code) => {
      if (code === 0) {
        for (const t of tables) ui.markTable(t);
        ui.chunkDone[chunkIndex] = ui.chunkTotal[chunkIndex];
        ui.setChunkStatus(chunkIndex, "done");
        resolve();
      } else {
        ui.setChunkStatus(chunkIndex, "failed");
        reject(
          new Error(`MOLT chunk ${chunkIndex + 1} exited with code ${code}`),
        );
      }
    });

    child.on("error", reject);
  });
}

async function verifyTableCount(targetUrl) {
  const client = new Client(pgClientOpts(targetUrl));
  await client.connect();
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_molt%'`,
  );
  await client.end();
  return rows[0].n;
}

async function main() {
  const compileOnly = process.argv.includes("--compile-only");

  loadCrdbEnv(REPO_ROOT);

  const sourceUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;
  const targetBase = process.env.COCKROACH_DATABASE_URL;

  if (!sourceUrl) throw new Error("Set POSTGRES_URL in .env.vercel.local");
  if (!targetBase)
    throw new Error("Set COCKROACH_DATABASE_URL in cockroachdb/.env.local");
  if (!existsSync(MOLT) && !compileOnly) {
    throw new Error(`MOLT binary missing at ${MOLT}`);
  }

  const targetUrl = targetDbUrl(targetBase, TARGET_DB);

  const moltSource = normalizeMoltSourceUrl(sourceUrl);
  const moltTarget = normalizeMoltTargetUrl(targetUrl);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  CockroachDB schema via MOLT (recommended: 1 process)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Target DB:     ${TARGET_DB}`);
  console.log(
    `MOLT:          ${PARALLEL} process(es), table-concurrency=${TABLE_CONCURRENCY}`,
  );
  console.log(
    `Source:        ${moltSource.includes("pooler") ? "pooler (slow for catalog)" : "direct"} — set POSTGRES_URL_NON_POOLING to db.*.supabase.co:5432`,
  );
  console.log(`Excluded:      ${[...EXCLUDE_TABLES].join(", ") || "(none)"}`);
  if (PARALLEL > 1) {
    console.log(
      "⚠  COCKROACH_SCHEMA_PARALLEL>1 runs multiple MOLT on one DB (contention). Use 1 process + high table-concurrency.",
    );
  }
  console.log("");

  if (compileOnly) {
    console.log("--compile-only: inventory only (skipping MOLT execution)");
    process.exit(0);
  }

  await ensureDatabase();
  await applyShim();

  const existing = await verifyTableCount(targetUrl);
  const expectedWithoutEmbeddings = 88 - EXCLUDE_TABLES.size;
  if (
    process.env.COCKROACH_SCHEMA_FRESH !== "1" &&
    existing >= expectedWithoutEmbeddings - 1
  ) {
    console.log(
      `✓ Schema already present: ${existing} public tables on ${TARGET_DB}. Skip MOLT (use COCKROACH_SCHEMA_FRESH=1 to rebuild).`,
    );
    process.exit(0);
  }

  console.log("Reading live table list from Supabase...");
  const liveTables = await listSourceTables(sourceUrl);
  const migrationTables = inventoryFromMigrations();
  const migrationOnly = migrationTables.filter((t) => !liveTables.includes(t));
  const liveOnly = liveTables.filter((t) => !migrationTables.includes(t));

  console.log(`  Live public tables:      ${liveTables.length}`);
  console.log(`  From migration files:  ${migrationTables.length}`);
  if (migrationOnly.length) {
    console.log(`  In migrations only:    ${migrationOnly.join(", ")}`);
  }
  if (liveOnly.length) {
    console.log(`  Live only:             ${liveOnly.join(", ")}`);
  }

  const tables = liveTables;
  if (tables.length === 0) throw new Error("No tables to migrate");

  const size =
    CHUNK_SIZE > 0 ? CHUNK_SIZE : Math.ceil(tables.length / PARALLEL);
  const chunks = chunkArray(tables, size);

  console.log(
    `\nPlan: ${tables.length} tables → ${chunks.length} chunks (~${size} tables/chunk)\n`,
  );

  const ui = new ProgressUI(tables.length, chunks);
  ui.start();

  const sequential = process.env.COCKROACH_SCHEMA_SEQUENTIAL === "1";
  const t0 = Date.now();
  try {
    if (sequential) {
      for (let i = 0; i < chunks.length; i++) {
        await runMoltChunk({
          chunkIndex: i,
          tables: chunks[i],
          sourceUrl: moltSource,
          targetUrl: moltTarget,
          ui,
          compileOnly,
        });
      }
    } else {
      await Promise.all(
        chunks.map((chunkTables, i) =>
          runMoltChunk({
            chunkIndex: i,
            tables: chunkTables,
            sourceUrl: moltSource,
            targetUrl: moltTarget,
            ui,
            compileOnly,
          }),
        ),
      );
    }
  } finally {
    ui.stop();
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✓ Schema chunks finished in ${elapsed}s`);

  const n = await verifyTableCount(targetUrl);
  console.log(`✓ Target public tables: ${n} (expected ~${tables.length})`);
  if (n < tables.length) {
    console.warn(
      `⚠ Fewer tables than planned. Re-run or check MOLT logs for failures.`,
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
