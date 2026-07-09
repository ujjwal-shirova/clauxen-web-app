#!/usr/bin/env node
/**
 * Deduplicate Vercel env vars: one row per key (multi-target), drop Anthropic + redundant Supabase/Postgres keys.
 * Auth: VERCEL_TOKEN env var.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ENV_FILE = join(ROOT, ".env.local");
const PROJECT_ID = "prj_fvcWCHb6BfJHggIDiUQDXH9sOBjr";
const TEAM_ID = "team_uO4zWwgLWJfc9GpMMrr5KOwa";
const API = "https://api.vercel.com";
const DELETE_DELAY_MS = 1100;

/** Never sync — Anthropic-only or deprecated keys. */
const SKIP_KEYS = new Set([
  "NOVITA_ANTHROPIC_BASE_URL",
  "SHIROVA_NOVITA_MESSAGES_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_JWT_SECRET",
  "POSTGRES_DATABASE",
  "POSTGRES_HOST",
  "POSTGRES_PASSWORD",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_USER",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "R2_USER_FILES_BUCKET",
  "SHIROVA_INFERENCE_FUNCTION",
  "ANTHROPIC_API_KEY",
]);

/** @deprecated Prefer scripts/reconcile-vercel-env.mjs — kept for emergency wipe+rebuild. */
const REMOVE = SKIP_KEYS;

const PROD_OVERRIDES = {
  AUTH_DEV_BYPASS: "false",
  AUTH_REQUIRED_FOR_CHAT: "true",
  STORAGE_REQUIRE_R2: "true",
  NEXT_PUBLIC_APP_URL: "https://www.clauxen.com",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

async function deleteAll(token, envs) {
  console.log(`Deleting ${envs.length} existing entries (throttled)…`);
  for (const e of envs) {
    await api(
      `/v9/projects/${PROJECT_ID}/env/${e.id}?teamId=${TEAM_ID}`,
      { method: "DELETE" },
      token,
    );
    await sleep(DELETE_DELAY_MS);
  }
}

async function createEnv(token, key, value, targets) {
  await api(
    `/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
    {
      method: "POST",
      body: { key, value, type: "encrypted", target: targets },
    },
    token,
  );
  console.log(`  ✓ ${key} → [${targets.join(",")}]`);
}

function buildCanonical(local, vercelValues) {
  const canonical = {};
  const allKeys = new Set([...Object.keys(local), ...Object.keys(vercelValues)]);

  for (const key of allKeys) {
    if (REMOVE.has(key)) continue;
    const value = local[key] || vercelValues[key];
    if (value) canonical[key] = value;
  }

  if (!canonical.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    canonical.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      vercelValues.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      vercelValues.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      vercelValues.SUPABASE_ANON_KEY ||
      "";
  }

  return canonical;
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.error("Set VERCEL_TOKEN");
    process.exit(1);
  }

  const local = parseEnvLocal();
  const data = await api(
    `/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&decrypt=true`,
    {},
    token,
  );
  const envs = data.envs ?? [];

  const vercelValues = {};
  for (const e of envs) {
    if (!e.value) continue;
    const isProd = e.target?.includes("production");
    if (!vercelValues[e.key] || isProd) vercelValues[e.key] = e.value;
  }

  const canonical = buildCanonical(local, vercelValues);
  await deleteAll(token, envs);

  const prodOverrideKeys = new Set(Object.keys(PROD_OVERRIDES));
  const shared = {};
  const prodOnly = {};
  const nonProdOnly = {};

  for (const [key, value] of Object.entries(canonical)) {
    if (prodOverrideKeys.has(key)) {
      prodOnly[key] = PROD_OVERRIDES[key];
      nonProdOnly[key] = value;
    } else {
      shared[key] = value;
    }
  }

  console.log(`Recreating ${Object.keys(canonical).length} canonical keys…`);
  for (const [key, value] of Object.entries(shared)) {
    await createEnv(token, key, value, ["production", "preview", "development"]);
  }
  for (const [key, value] of Object.entries(prodOnly)) {
    await createEnv(token, key, value, ["production"]);
  }
  for (const [key, value] of Object.entries(nonProdOnly)) {
    await createEnv(token, key, value, ["preview", "development"]);
  }

  const after = await api(
    `/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
    {},
    token,
  );
  const afterEnvs = after.envs ?? [];
  const keys = [...new Set(afterEnvs.map((e) => e.key))].sort();
  console.log(
    `\nDone: ${afterEnvs.length} rows, ${keys.length} unique keys`,
  );
  console.log(keys.join("\n"));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
