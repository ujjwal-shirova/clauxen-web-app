#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- Paths come from a fixed local configuration list. */
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

const values = { ...process.env };
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
const token = values.CLOUDFLARE_API_TOKEN?.trim();
if (!token)
  throw new Error(
    "CLOUDFLARE_API_TOKEN is required to verify deployed chat configuration",
  );
const account =
  values.CLOUDFLARE_ACCOUNT_ID?.trim() || "8fc7a67e9057989309921f362784ecf4";
const worker = values.CF_WORKER_NAME?.trim() || "clauxen-app";
const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${worker}/settings`,
  {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  },
);
const payload = await response.json();
if (!response.ok || !payload.success)
  throw new Error(
    `Unable to verify deployed chat bindings (${response.status})`,
  );
const bindings = payload.result.bindings ?? [];
const required = [
  "Provider_API_Key",
  "GENERATIONS_INTERNAL_TOKEN",
  "CHAT_COORD_INTERNAL_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
];
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
  )
    missing.push(name);
}
if (missing.length)
  throw new Error(
    `Deployment has missing chat bindings: ${missing.join(", ")}. Restore them before deploying or accepting chat traffic.`,
  );
console.log(
  `${worker}: required chat credentials, queue, and database bindings verified (values not printed)`,
);
