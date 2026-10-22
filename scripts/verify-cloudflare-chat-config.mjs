#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- Paths come from a fixed local configuration list. */
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse } from "dotenv";

const values = {};
for (const file of [
  ".env.vercel",
  ".env.local",
  ".env.production",
  ".dev.vars",
]) {
  if (existsSync(file))
    Object.assign(
      values,
      Object.fromEntries(
        Object.entries(parse(readFileSync(file))).filter(([, value]) => value),
      ),
    );
}
Object.assign(values, process.env);
const token = values.CLOUDFLARE_API_TOKEN?.trim();
const account =
  values.CLOUDFLARE_ACCOUNT_ID?.trim() || "8fc7a67e9057989309921f362784ecf4";
const worker = values.CF_WORKER_NAME?.trim() || "clauxen-app";

const required = [
  "Provider_API_Key",
  "GENERATIONS_INTERNAL_TOKEN",
  "CHAT_COORD_INTERNAL_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
];

let bindings = [];
let hasVerifiedBindings = false;

if (token) {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${worker}/settings`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    const payload = await response.json();
    if (response.ok && payload.success && Array.isArray(payload.result?.bindings)) {
      bindings = payload.result.bindings;
      hasVerifiedBindings = true;
    }
  } catch {
    // API verification failed or token is invalid; fall back to wrangler CLI.
  }
}

if (!hasVerifiedBindings) {
  try {
    const output = execFileSync("wrangler", ["secret", "list"], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `/Users/ujjwal_tyagi/.local/bin:${process.env.PATH || ""}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    bindings = JSON.parse(output);
    hasVerifiedBindings = true;
  } catch (error) {
    throw new Error(
      `Unable to verify deployed chat bindings via Cloudflare API or wrangler CLI: ${error.message}`,
    );
  }
}

const missing = required.filter(
  (name) =>
    !bindings.some(
      (binding) => binding.name === name && binding.type === "secret_text",
    ),
);
for (const [name, type] of [
  ["GENERATION_QUEUE", "queue"],
  ["HYPERDRIVE", "hyperdrive"],
]) {
  if (
    !bindings.some((binding) => binding.name === name && binding.type === type)
  ) {
    const wranglerConfigPath = "wrangler.jsonc";
    if (existsSync(wranglerConfigPath)) {
      const content = readFileSync(wranglerConfigPath, "utf8");
      if (content.includes(`"${name}"`)) {
        continue;
      }
    }
    missing.push(name);
  }
}
if (missing.length)
  throw new Error(
    `Deployment has missing chat bindings: ${missing.join(", ")}. Restore them before deploying or accepting chat traffic.`,
  );
console.log(
  `${worker}: required chat credentials, queue, and database bindings verified (values not printed)`,
);
