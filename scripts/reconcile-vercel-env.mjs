#!/usr/bin/env node
/**
 * Reconcile Vercel project env vars:
 * - Production + Preview → type "sensitive" (Vercel does not allow sensitive on Development)
 * - Development → type "encrypted" with the same value
 * - Every key available in production, preview, and development
 *
 * Auth: VERCEL_TOKEN (or ~/.cursor/vercel-token / Vercel CLI auth.json)
 * Values: decrypt existing encrypted/plain rows; fill gaps from .env.local
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ROOT = process.cwd();
const ENV_FILE = join(ROOT, ".env.local");
const PROJECT_ID = "prj_fvcWCHb6BfJHggIDiUQDXH9sOBjr";
const TEAM_ID = "team_uO4zWwgLWJfc9GpMMrr5KOwa";
const API = "https://api.vercel.com";

/** Keep in sync with src/lib/vercel-env.ts CANONICAL_VERCEL_ENV_KEYS */
const CANONICAL_VERCEL_ENV_KEYS = [
  "POSTGRES_DATABASE",
  "POSTGRES_HOST",
  "POSTGRES_PASSWORD",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_USER",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_JWT_SECRET",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "AUTH_DEV_BYPASS",
  "AUTH_REQUIRED_FOR_CHAT",
  "STORAGE_REQUIRE_R2",
  "DATABASE_POOL_MAX",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT",
  "JWT_SECRET",
  "Provider_API_Key",
  "Provider_BASE_URL",
  "Provider_SANDBOX_TIMEOUT_MS",
  "Provider_Model_Clauxen_V1",
  "EXA_API_KEY",
  "Assembly_Provider_Key",
  "ASSEMBLYAI_STREAMING_HOST",
  "R2_AUDIO_RECORDINGS_BUCKET",
  "FAL_KEY",
  "PARALLEL_API_KEY",
  "SHIROVA_THINKING_TYPE",
  "R2_IMAGES_BUCKET",
  "R2_DOCUMENTS_BUCKET",
  "R2_ARTIFACTS_BUCKET",
  "WORKER_URL",
  "NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL",
  "CHAT_HISTORY_WORKER_URL",
  "CHAT_HISTORY_INTERNAL_TOKEN",
  "CHAT_COORD_WORKER_URL",
  "CHAT_COORD_INTERNAL_TOKEN",
  "EDGE_CONFIG",
];

/** Production-safe overrides (always win when set). */
const PROD_OVERRIDES = {
  AUTH_DEV_BYPASS: "false",
  AUTH_REQUIRED_FOR_CHAT: "true",
  STORAGE_REQUIRE_R2: "true",
  NEXT_PUBLIC_APP_URL: "https://www.clauxen.com",
  NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT: "true",
};

const PLACEHOLDER_RE = /YOUR_|change-me-in-production|CHANGEME|__FILL_IN_VERCEL_DASHBOARD__/i;
const CIPHER_RE = /^eyJ2Ijoi/;

function loadToken() {
  if (process.env.VERCEL_TOKEN?.trim()) return process.env.VERCEL_TOKEN.trim();
  const paths = [
    join(homedir(), ".cursor", "vercel-token"),
    join(homedir(), "Library/Application Support/com.vercel.cli/auth.json"),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    if (p.endsWith(".json")) {
      const j = JSON.parse(raw);
      if (j.token) return j.token;
    } else {
      return raw.trim();
    }
  }
  return null;
}

function parseEnvLocal() {
  const map = {};
  if (!existsSync(ENV_FILE)) return map;
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) map[key] = value;
  }
  return map;
}

function isUsable(value) {
  return Boolean(value?.trim()) && !PLACEHOLDER_RE.test(value) && !CIPHER_RE.test(value);
}

async function api(path, { method = "GET", body } = {}, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function listEnv(token) {
  const data = await api(`/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {}, token);
  return data.envs ?? [];
}

async function decryptValue(token, envId) {
  const data = await api(
    `/v9/projects/${PROJECT_ID}/env/${envId}?teamId=${TEAM_ID}&decrypt=true`,
    {},
    token,
  );
  return data.value ?? "";
}

async function deleteRow(token, id) {
  await api(`/v9/projects/${PROJECT_ID}/env/${id}?teamId=${TEAM_ID}`, { method: "DELETE" }, token);
}

async function createSensitive(token, key, value) {
  await api(
    `/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
    {
      method: "POST",
      body: {
        key,
        value,
        type: "sensitive",
        target: ["production", "preview"],
      },
    },
    token,
  );
}

async function createEncryptedDev(token, key, value) {
  await api(
    `/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
    {
      method: "POST",
      body: {
        key,
        value,
        type: "encrypted",
        target: ["development"],
      },
    },
    token,
  );
}

async function recreateKey(token, key, value) {
  const rows = (await listEnv(token)).filter((e) => e.key === key);
  for (const row of rows) {
    await deleteRow(token, row.id);
  }
  await createSensitive(token, key, value);
  await createEncryptedDev(token, key, value);
}

async function main() {
  const token = loadToken();
  if (!token) {
    console.error("Set VERCEL_TOKEN");
    process.exit(1);
  }

  const local = parseEnvLocal();
  if (isUsable(local.Provider_Model_Clauxen_V1) && !isUsable(local.SHIROVA_DEFAULT_MODEL)) {
    local.SHIROVA_DEFAULT_MODEL = local.Provider_Model_Clauxen_V1;
  }

  const rows = await listEnv(token);
  const byKey = new Map();
  for (const row of rows) {
    if (!byKey.has(row.key)) byKey.set(row.key, []);
    byKey.get(row.key).push(row);
  }

  const vercelValues = {};
  const sensitiveOnly = new Set();

  for (const [key, keyRows] of byKey) {
    let best = "";
    let anySensitive = false;
    let anyReadable = false;
    for (const row of keyRows) {
      if (row.type === "sensitive") anySensitive = true;
      try {
        const value = await decryptValue(token, row.id);
        if (isUsable(value)) {
          vercelValues[key] = value;
          best = value;
          anyReadable = true;
        }
      } catch {
        /* sensitive / forbidden */
      }
    }
    if (anySensitive && !anyReadable && !isUsable(best)) {
      sensitiveOnly.add(key);
    }
  }

  const keys = new Set([
    ...CANONICAL_VERCEL_ENV_KEYS,
    ...byKey.keys(),
    ...Object.keys(local).filter((k) => !k.startsWith("VERCEL_") && k !== "CI" && k !== "NODE_ENV"),
  ]);

  // Do not push local-only tooling / Cloudflare deploy tokens into Vercel unless already present
  const SKIP_SYNC = new Set([
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "VERCEL_TOKEN",
    "Vercel_Token",
  ]);

  let ok = 0;
  let skip = 0;
  let fail = 0;

  console.log(`Reconciling ${keys.size} keys (sensitive on production+preview, encrypted on development)…`);

  for (const key of [...keys].sort()) {
    if (SKIP_SYNC.has(key) && !byKey.has(key)) continue;

    let value = "";
    if (PROD_OVERRIDES[key] !== undefined) {
      value = PROD_OVERRIDES[key];
    } else if (isUsable(vercelValues[key])) {
      value = vercelValues[key];
    } else if (isUsable(local[key])) {
      value = local[key];
    }

    // CRITICAL: never overwrite an unreadable sensitive production key with a
    // local guess — that is how a working Provider_API_Key was destroyed.
    if (sensitiveOnly.has(key)) {
      const force = process.env.FORCE_OVERWRITE_SENSITIVE === "1";
      if (!force) {
        console.log(
          `  ↷ ${key}: keeping existing sensitive row(s) (unreadable; set FORCE_OVERWRITE_SENSITIVE=1 only when intentionally rotating)`,
        );
        skip++;
        continue;
      }
    }

    // Blank seeds only for brand-new canonical keys that never existed.
    if (!isUsable(value)) {
      if (!byKey.has(key) && CANONICAL_VERCEL_ENV_KEYS.includes(key)) {
        try {
          await recreateKey(token, key, "");
          ok++;
          console.log(`  ✓ ${key} blank seed (fill in dashboard)`);
        } catch (err) {
          fail++;
          console.error(`  ✗ ${key}: ${err.message}`);
        }
      } else {
        console.log(`  ↷ ${key}: no usable value (left unchanged)`);
        skip++;
      }
      continue;
    }

    try {
      await recreateKey(token, key, value);
      ok++;
      console.log(`  ✓ ${key}`);
    } catch (err) {
      fail++;
      console.error(`  ✗ ${key}: ${err.message}`);
    }
  }

  const after = await listEnv(token);
  const summary = new Map();
  for (const e of after) {
    if (!summary.has(e.key)) summary.set(e.key, []);
    summary.get(e.key).push(`${(e.target || []).join("+")}:${e.type}`);
  }

  let bad = 0;
  for (const [key, parts] of [...summary.entries()].sort()) {
    const targets = new Set(
      after.filter((e) => e.key === key).flatMap((e) => e.target || []),
    );
    const types = after.filter((e) => e.key === key).map((e) => e.type);
    const hasPP = targets.has("production") && targets.has("preview");
    const hasDev = targets.has("development");
    const ppSensitive = after
      .filter((e) => e.key === key && (e.target || []).some((t) => t === "production" || t === "preview"))
      .every((e) => e.type === "sensitive");
    const okShape = hasPP && hasDev && ppSensitive;
    if (!okShape) {
      bad++;
      console.log(`  ⚠ ${key} → ${parts.join(" | ")}`);
    }
  }

  console.log(
    `\nDone: ${ok} recreated, ${skip} kept/skipped, ${fail} failed → ${after.length} rows / ${summary.size} keys (${bad} still incomplete)`,
  );
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
