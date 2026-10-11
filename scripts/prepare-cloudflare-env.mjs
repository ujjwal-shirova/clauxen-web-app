#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
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
const deny =
  /^(VERCEL|POSTGRES_|CLOUDFLARE_API_TOKEN$|R2_API_TOKEN$|EDGE_CONFIG$|STORAGE_LOCAL_PATH$)/;
for (const [key, value] of Object.entries(values)) {
  if (
    deny.test(key) ||
    !value ||
    /^YOUR_|^CHANGEME|^change-me|^__FILL_IN/.test(value)
  )
    delete values[key];
}
Object.assign(values, {
  HOSTING_PLATFORM: "cloudflare",
  NEXT_PUBLIC_APP_URL: "https://www.clauxen.com",
  AUTH_DEV_BYPASS: "false",
  AUTH_REQUIRED_FOR_CHAT: "true",
  NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT: "true",
  STORAGE_REQUIRE_R2: "true",
  GENERATIONS_EXECUTION_ORIGIN: "https://clauxen-app.shirova.workers.dev",
  GENERATIONS_CONTINUATION_WORKER_URL: "",
  AUTH_EMAIL_WORKER_URL:
    "https://clauxen-auth-email-app.shirova.workers.dev",
});
values.GENERATIONS_INTERNAL_TOKEN ||= randomBytes(32).toString("hex");
values.R2_SIGNING_KEY ||= randomBytes(32).toString("hex");
values.AUTH_EMAIL_INTERNAL_TOKEN ||= randomBytes(32).toString("hex");
const required = [
  "Provider_API_Key",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "JWT_SECRET",
  "CHAT_COORD_INTERNAL_TOKEN",
  "CHAT_HISTORY_INTERNAL_TOKEN",
  "SCHEDULED_TASKS_INTERNAL_TOKEN",
  "BILLING_INTERNAL_TOKEN",
  "PAYMENT_METHOD_ENCRYPTION_KEY",
];
const missing = required.filter((key) => !values[key]);
if (missing.length)
  throw new Error(`Missing migration credentials: ${missing.join(", ")}`);
writeFileSync(
  ".dev.vars",
  Object.entries(values)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
const publicVars = new Set([
  "HOSTING_PLATFORM",
  "CF_WORKER_NAME",
  "NEXT_PUBLIC_APP_URL",
  "GENERATIONS_EXECUTION_ORIGIN",
  "AUTH_DEV_BYPASS",
  "AUTH_REQUIRED_FOR_CHAT",
  "NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT",
  "STORAGE_REQUIRE_R2",
]);
writeFileSync(
  "tmp/cloudflare-secrets.json",
  JSON.stringify(
    Object.fromEntries(
      Object.entries(values).filter(([key]) => !publicVars.has(key)),
    ),
  ),
  { mode: 0o600 },
);
writeFileSync(
  "tmp/cloudflare-auth-email-secrets.json",
  JSON.stringify({
    AUTH_EMAIL_INTERNAL_TOKEN: values.AUTH_EMAIL_INTERNAL_TOKEN,
  }),
  { mode: 0o600 },
);
console.log(
  `Prepared ${Object.keys(values).length} application variables; credential values were not printed`,
);
