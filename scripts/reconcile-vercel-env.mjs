#!/usr/bin/env node
/**
 * Reconcile Vercel env: exactly 33 keys, one sensitive row each (production + preview + development).
 * Supabase/Postgres keys are seeded empty for dashboard fill-in; app keys sync from .env.local.
 * Auth: VERCEL_TOKEN
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ENV_FILE = join(ROOT, ".env.local");
const PROJECT_ID = "prj_fvcWCHb6BfJHggIDiUQDXH9sOBjr";
const TEAM_ID = "team_uO4zWwgLWJfc9GpMMrr5KOwa";
const API = "https://api.vercel.com";

/** User fills these in Vercel dashboard — never overwrite with .env.local. */
const USER_FILL_KEYS = new Set([
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
]);

/** Exactly 33 keys — must match src/lib/vercel-env.ts */
const CANONICAL_KEYS = [
  ...USER_FILL_KEYS,
  "AUTH_DEV_BYPASS",
  "AUTH_REQUIRED_FOR_CHAT",
  "STORAGE_REQUIRE_R2",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT",
  "JWT_SECRET",
  "Provider_API_Key",
  "Provider_BASE_URL",
  "Provider_SANDBOX_TIMEOUT_MS",
  "Provider_Model_Clauxen_V1",
  "EXA_API_KEY",
  "FAL_KEY",
  "PARALLEL_API_KEY",
  "SHIROVA_THINKING_TYPE",
  "R2_IMAGES_BUCKET",
  "R2_DOCUMENTS_BUCKET",
  "R2_ARTIFACTS_BUCKET",
];

const PROD_OVERRIDES = {
  AUTH_DEV_BYPASS: "false",
  AUTH_REQUIRED_FOR_CHAT: "true",
  STORAGE_REQUIRE_R2: "true",
  NEXT_PUBLIC_APP_URL: "https://www.clauxen.com",
};

const PLACEHOLDER_RE = /YOUR_|change-me-in-production|CHANGEME/i;
const CIPHER_RE = /^eyJ2Ijoi/;

const ALL_TARGETS = ["production", "preview", "development"];

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
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
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

async function deleteAll(token, envs) {
  for (const e of envs) {
    await api(
      `/v9/projects/${PROJECT_ID}/env/${e.id}?teamId=${TEAM_ID}`,
      { method: "DELETE" },
      token,
    );
  }
}

async function createKey(token, key, value) {
  const body = {
    key,
    value: value || "",
    target: ALL_TARGETS,
  };

  // ponytail: one row per key — development shares production/preview values (no duplicate dev rows)
  try {
    await api(
      `/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
      { method: "POST", body: { ...body, type: "sensitive" } },
      token,
    );
  } catch {
    await api(
      `/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
      { method: "POST", body: { ...body, type: "encrypted" } },
      token,
    );
  }
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.error("Set VERCEL_TOKEN");
    process.exit(1);
  }

  if (CANONICAL_KEYS.length !== 33) {
    throw new Error(`Expected 33 keys, got ${CANONICAL_KEYS.length}`);
  }

  const local = parseEnvLocal();
  const rows = await listEnv(token);
  const vercel = {};

  for (const row of rows) {
    try {
      const value = await decryptValue(token, row.id);
      if (isUsable(value)) vercel[row.key] = value;
    } catch {
      /* skip */
    }
  }

  const values = {};
  for (const key of CANONICAL_KEYS) {
    if (USER_FILL_KEYS.has(key)) {
      // Keep existing dashboard value if set; otherwise blank for user fill-in
      values[key] = isUsable(vercel[key]) ? vercel[key] : "";
    } else if (isUsable(local[key])) {
      values[key] = local[key];
    } else if (isUsable(vercel[key])) {
      values[key] = vercel[key];
    } else {
      values[key] = "";
    }
    if (PROD_OVERRIDES[key] !== undefined) {
      values[key] = PROD_OVERRIDES[key];
    }
  }

  console.log(`Replacing ${rows.length} rows → ${CANONICAL_KEYS.length} canonical keys…`);
  await deleteAll(token, rows);

  let ok = 0;
  let fail = 0;
  for (const key of CANONICAL_KEYS) {
    try {
      await createKey(token, key, values[key] ?? "");
      ok++;
      const label = values[key] ? "has value" : "blank (fill in dashboard)";
      console.log(`  ✓ ${key} ${label}`);
    } catch (err) {
      fail++;
      console.error(`  ✗ ${key}: ${err.message}`);
    }
  }

  const after = await listEnv(token);
  const byKey = {};
  for (const e of after) {
    byKey[e.key] ??= [];
    byKey[e.key].push(`${(e.target || []).join(",")}:${e.type}`);
  }

  console.log(
    `\nDone: ${ok} ok, ${fail} failed → ${after.length} rows, ${Object.keys(byKey).length} keys`,
  );
  if (after.length !== 33) {
    console.log(`⚠ Expected exactly 33 rows, got ${after.length}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
