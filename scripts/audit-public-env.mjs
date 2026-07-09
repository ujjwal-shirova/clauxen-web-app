#!/usr/bin/env node
/**
 * Fails CI if a secret-looking env var is prefixed NEXT_PUBLIC_.
 * Only explicitly allowlisted keys may be exposed to the browser bundle.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const ALLOWED_PUBLIC = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_RAZORPAY_KEY_ID",
  "NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT",
  "NEXT_PUBLIC_CHECKOUT_USD_INR_RATE",
]);

const FORBIDDEN_PATTERNS = [
  /NEXT_PUBLIC_.*SECRET/i,
  /NEXT_PUBLIC_.*SERVICE_ROLE/i,
  /NEXT_PUBLIC_.*DATABASE/i,
  /NEXT_PUBLIC_.*NOVITA/i,
  /NEXT_PUBLIC_.*EXA/i,
  /NEXT_PUBLIC_.*FAL/i,
  /NEXT_PUBLIC_.*R2_/i,
  /NEXT_PUBLIC_.*RAZORPAY.*SECRET/i,
  /NEXT_PUBLIC_.*WEBHOOK/i,
  /NEXT_PUBLIC_.*CLOUDFLARE/i,
  /NEXT_PUBLIC_.*OPENAI/i,
  /NEXT_PUBLIC_.*JWT/i,
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) files.push(p);
  }
  return files;
}

const violations = [];

for (const file of walk(ROOT)) {
  if (file.includes("audit-public-env")) continue;
  const text = readFileSync(file, "utf8");
  const matches = text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g);
  for (const m of matches) {
    const key = m[0];
    if (FORBIDDEN_PATTERNS.some((re) => re.test(key))) {
      violations.push({ file, key, reason: "forbidden pattern" });
    } else if (!ALLOWED_PUBLIC.has(key)) {
      violations.push({ file, key, reason: "not in allowlist" });
    }
  }
}

if (violations.length) {
  console.error("Public env audit failed — secrets must not use NEXT_PUBLIC_:\n");
  for (const v of violations) {
    console.error(`  ${v.key} in ${v.file.replace(ROOT, "")} (${v.reason})`);
  }
  process.exit(1);
}

console.log("Public env audit passed.");
