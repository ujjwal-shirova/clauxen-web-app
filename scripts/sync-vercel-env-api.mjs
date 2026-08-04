#!/usr/bin/env node
/**
 * Sync .env.local → Vercel via REST API (not CLI).
 * Auth: VERCEL_TOKEN env var, or ~/.cursor/vercel-token, or macOS Vercel CLI auth.json
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ROOT = process.cwd();
const ENV_FILE = join(ROOT, ".env.local");
const PROJECT_ID = "prj_fvcWCHb6BfJHggIDiUQDXH9sOBjr";
const TEAM_ID = "team_uO4zWwgLWJfc9GpMMrr5KOwa";
const API = "https://api.vercel.com";

const SKIP = new Set(["VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_REGION", "CI", "NODE_ENV"]);

/** Never sync — integration duplicates or deprecated keys. */
const SKIP_KEYS = new Set([
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
  "STORAGE_LOCAL_PATH",
]);

const PROD_OVERRIDES = {
  AUTH_DEV_BYPASS: "false",
  AUTH_REQUIRED_FOR_CHAT: "true",
  STORAGE_REQUIRE_R2: "true",
  NEXT_PUBLIC_APP_URL: "https://www.clauxen.com",
};

const PROD_OVERRIDE_KEYS = new Set(Object.keys(PROD_OVERRIDES));

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

function parseEnv(path) {
  const vars = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!value || SKIP.has(key)) continue;
    vars.push({ key, value });
  }
  return vars;
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
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function listEnv(token) {
  const data = await api(`/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {}, token);
  return data.envs ?? data.env ?? [];
}

async function deleteKeyRows(token, key) {
  const existing = await listEnv(token);
  for (const row of existing.filter((e) => e.key === key)) {
    await api(`/v9/projects/${PROJECT_ID}/env/${row.id}?teamId=${TEAM_ID}`, {
      method: "DELETE",
    }, token).catch(() => {});
  }
}

async function upsertEnv(token, key, value, targets) {
  await deleteKeyRows(token, key);
  const prodPreview = targets.filter((t) => t !== "development");
  const dev = targets.filter((t) => t === "development");
  if (prodPreview.length) {
    await api(`/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
      method: "POST",
      body: { key, value, type: "sensitive", target: prodPreview },
    }, token);
  }
  if (dev.length) {
    await api(`/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
      method: "POST",
      body: { key, value, type: "encrypted", target: dev },
    }, token);
  }
}

async function main() {
  const token = loadToken();
  if (!token) {
    console.error("No Vercel token. Set VERCEL_TOKEN or run: npx vercel@41.7.0 login");
    process.exit(1);
  }
  if (!existsSync(ENV_FILE)) {
    console.error("Missing .env.local");
    process.exit(1);
  }

  const raw = parseEnv(ENV_FILE);
  const publishable = raw.find((v) => v.key === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const vars = raw.filter(({ key }) => !SKIP_KEYS.has(key));
  if (publishable && !vars.some((v) => v.key === "NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    vars.push({ key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: publishable.value });
  }

  let ok = 0;
  let fail = 0;

  console.log(`Syncing ${vars.length} vars to Vercel project clauxen…`);

  for (const { key, value } of vars) {
    if (PROD_OVERRIDE_KEYS.has(key)) continue;
    try {
      await upsertEnv(token, key, value, ["production", "preview", "development"]);
      ok++;
      console.log(`  ✓ ${key} → production,preview,development`);
    } catch (err) {
      fail++;
      console.error(`  ✗ ${key}: ${err.message}`);
    }
  }

  for (const [key, value] of Object.entries(PROD_OVERRIDES)) {
    try {
      const localVal = vars.find((v) => v.key === key)?.value ?? value;
      await upsertEnv(token, key, value, ["production"]);
      await upsertEnv(token, key, localVal, ["preview", "development"]);
      ok += 2;
      console.log(`  ✓ ${key} (production=${value}, preview/dev from local)`);
    } catch (err) {
      fail++;
      console.error(`  ✗ override ${key}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main();
