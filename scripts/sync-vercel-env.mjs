#!/usr/bin/env node
/**
 * Sync .env.local → Vercel project env (production, preview, development).
 * Requires: npx vercel login (or VERCEL_TOKEN env var)
 *
 * Usage: npm run vercel:env:sync
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const ENV_FILE = join(ROOT, ".env.local");
const VERCEL_CLI = "npx";
const VERCEL_ARGS = ["vercel@41.7.0"];

/** Never sync these — Vercel injects them automatically. */
const SKIP_KEYS = new Set([
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_REGION",
  "CI",
  "NODE_ENV",
]);

/** Keys safe only on server — still synced to Vercel (encrypted), never NEXT_PUBLIC_. */
const SERVER_ONLY_HINT = [
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NOVITA",
  "EXA_",
  "FAL_",
  "R2_",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK",
  "JWT_SECRET",
  "CLOUDFLARE",
  "OPENAI_API",
  "REDIS_URL",
];

function parseEnvFile(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  const vars = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value || SKIP_KEYS.has(key)) continue;
    vars.push({ key, value });
  }
  return vars;
}

function runVercel(args, input) {
  const result = spawnSync(VERCEL_CLI, [...VERCEL_ARGS, ...args], {
    cwd: ROOT,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return result;
}

function main() {
  if (!existsSync(ENV_FILE)) {
    console.error("Missing .env.local — create it from .env.example first.");
    process.exit(1);
  }

  const whoami = runVercel(["whoami"]);
  if (whoami.status !== 0) {
    console.error(
      "Vercel CLI not authenticated. Run: npx vercel@41.7.0 login\n" +
        (whoami.stderr || whoami.stdout || ""),
    );
    process.exit(1);
  }

  const vars = parseEnvFile(ENV_FILE);
  const targets = ["production", "preview", "development"];
  let ok = 0;
  let fail = 0;

  console.log(`Syncing ${vars.length} variables to Vercel (clauxen)…`);

  for (const { key, value } of vars) {
    if (key.startsWith("NEXT_PUBLIC_")) {
      const bad = SERVER_ONLY_HINT.some(
        (hint) => key.includes(hint) && !key.includes("RAZORPAY_KEY_ID"),
      );
      if (bad) {
        console.warn(`  SKIP suspicious public key: ${key}`);
        continue;
      }
    }

    for (const target of targets) {
      // Remove existing then add (idempotent-ish)
      runVercel(["env", "rm", key, target, "--yes"]);
      const add = runVercel(["env", "add", key, target], `${value}\n`);
      if (add.status === 0) {
        ok++;
        console.log(`  ✓ ${key} → ${target}`);
      } else {
        fail++;
        console.error(`  ✗ ${key} → ${target}: ${add.stderr || add.stdout}`);
      }
    }
  }

  // Force production auth settings
  const prodOverrides = [
    ["AUTH_DEV_BYPASS", "false"],
    ["AUTH_REQUIRED_FOR_CHAT", "true"],
    ["STORAGE_REQUIRE_R2", "true"],
  ];
  for (const [key, value] of prodOverrides) {
    runVercel(["env", "rm", key, "production", "--yes"]);
    const add = runVercel(["env", "add", key, "production"], `${value}\n`);
    if (add.status === 0) {
      console.log(`  ✓ ${key}=${value} (production override)`);
    }
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main();
