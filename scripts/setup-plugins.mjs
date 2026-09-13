#!/usr/bin/env node
/**
 * Plugins + MCP setup diagnostics.
 *
 * Usage: npm run plugins:setup
 *
 * Checks, in order: catalog file, Postgres tables, gateway reachability and
 * auth, and derived capability mode. Prints exact fix commands; exits 1 only
 * when Add cannot work at all (no database).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const failures = [];
const warnings = [];

function loadDotEnvLocal() {
  const file = path.join(root, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function ok(label, detail = "") {
  console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
}
function warn(label, fix = "") {
  warnings.push(label);
  console.log(`  warn ${label}${fix ? `\n       fix: ${fix}` : ""}`);
}
function fail(label, fix = "") {
  failures.push(label);
  console.log(`  FAIL ${label}${fix ? `\n       fix: ${fix}` : ""}`);
}

async function checkCatalog() {
  console.log("catalog");
  const file = path.join(root, "scripts/chatgpt-plugins/plugins.json");
  if (!existsSync(file)) {
    fail("plugins.json missing", "restore scripts/chatgpt-plugins/plugins.json from git");
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    fail("plugins.json is not valid JSON", "restore scripts/chatgpt-plugins/plugins.json from git");
    return;
  }
  const plugins = Array.isArray(parsed.plugins) ? parsed.plugins : [];
  const withMcp = plugins.filter(
    (plugin) => typeof plugin?.mcpUrl === "string" && plugin.mcpUrl.length > 0,
  );
  if (plugins.length === 0 || withMcp.length === 0) {
    fail("catalog has no verified MCP plugins", "restore scripts/chatgpt-plugins/plugins.json from git");
    return;
  }
  ok(`${withMcp.length} verified MCP plugins`, `${plugins.length - withMcp.length} without mcpUrl ignored`);
  const icons = path.join(root, "public/assets/plugins");
  ok("bundled icons", existsSync(icons) ? "public/assets/plugins present" : "missing (remote artwork still works)");
}

async function checkDatabase() {
  console.log("database");
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) {
    fail("DATABASE_URL missing", "set DATABASE_URL (Supabase pooler :6543) in .env.local or Vercel env");
    return null;
  }
  let pg;
  try {
    pg = (await import("pg")).default;
  } catch {
    warn("pg module not installed; skipping table checks", "run npm ci, then re-run");
    return null;
  }
  const pool = new pg.Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 10_000,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  try {
    const required = [
      "public.connector_catalog",
      "public.connector_installations",
      "public.connector_tools",
      "public.connector_action_approvals",
      "private.connector_oauth_configs",
      "private.connector_oauth_transactions",
      "private.connector_credentials",
      "public.plugin_collections",
      "private.plugin_mcp_api_keys",
    ];
    const rows = await pool.query(
      `select schemaname || '.' || tablename as name
       from pg_tables
       where schemaname || '.' || tablename = any($1)`,
      [required],
    );
    const present = new Set(rows.rows.map((row) => row.name));
    const missing = required.filter((name) => !present.has(name));
    if (missing.length > 0) {
      fail(
        `missing tables: ${missing.join(", ")}`,
        "run supabase db push (repo supabase/migrations has them all)",
      );
    } else {
      ok("all 9 plugin tables present");
    }
    return pool;
  } catch (error) {
    fail(
      `database unreachable (${error instanceof Error ? error.message : String(error)})`,
      "check DATABASE_URL host/credentials and Supabase status",
    );
    return null;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function checkGateway() {
  console.log("connector gateway (Cloudflare Worker)");
  const base = (process.env.CONNECTOR_GATEWAY_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.CONNECTOR_GATEWAY_INTERNAL_TOKEN || "").trim();
  if (!base) {
    warn("CONNECTOR_GATEWAY_URL missing; local-only mode (no-auth + API-key plugins)", "set CONNECTOR_GATEWAY_URL to enable OAuth plugins");
    return { mode: "local" };
  }
  try {
    const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(15_000) });
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    ok("worker reachable", base);
  } catch (error) {
    warn(
      `worker unreachable (${error instanceof Error ? error.message : String(error)})`,
      "deploy it: cd workers/connector-gateway && wrangler deploy",
    );
    return { mode: "local" };
  }
  if (!token) {
    warn("CONNECTOR_GATEWAY_INTERNAL_TOKEN missing; local-only mode (no-auth + API-key plugins)", "set it in Vercel env AND as a worker secret (same value): wrangler secret put CONNECTOR_GATEWAY_INTERNAL_TOKEN");
    return { mode: "local" };
  }
  try {
    const probe = await fetch(`${base}/v1/connections`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-clauxen-internal": token,
        "x-clauxen-user-id": "00000000-0000-0000-0000-000000000000",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (probe.status === 401 || probe.status === 403) {
      warn("gateway token rejected (401/403); local-only mode until fixed", "make Vercel CONNECTOR_GATEWAY_INTERNAL_TOKEN match the worker secret exactly");
      return { mode: "local" };
    }
    if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
    ok("gateway auth valid (full mode: OAuth + no-auth + API-key plugins)");
    return { mode: "full" };
  } catch (error) {
    warn(
      `gateway auth check failed (${error instanceof Error ? error.message : String(error)})`,
      "verify the worker URL and token, then re-run",
    );
    return { mode: "local" };
  }
}

loadDotEnvLocal();
console.log("plugins setup check\n");
await checkCatalog();
await checkDatabase();
const gateway = await checkGateway();

console.log("");
if (failures.length > 0) {
  console.log(`result: BROKEN — ${failures.length} fatal issue(s). Add cannot work until these are fixed.`);
  process.exit(1);
}
if (gateway.mode === "local") {
  console.log("result: OK (local mode) — Add works for open and API-key plugins with Postgres alone. OAuth plugins need the gateway.");
} else {
  console.log("result: OK (full mode) — Add works for OAuth, open, and API-key plugins.");
}
if (warnings.length > 0) process.exit(0);
