#!/usr/bin/env node
/**
 * Configure a REST connector OAuth app on the Cloudflare gateway.
 *
 * Secrets stay on the worker: it seals client_secret into
 * private.connector_oauth_configs. Never send these values to Vercel.
 *
 * Usage:
 *   CONNECTOR_GATEWAY_ADMIN_TOKEN=... \
 *   CONNECTOR_OAUTH_GITHUB_CLIENT_ID=... \
 *   CONNECTOR_OAUTH_GITHUB_CLIENT_SECRET=... \
 *   node scripts/connectors/configure-oauth.mjs github
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "../..");

function loadDotEnvLocal() {
  const file = join(root, ".env.local");
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

loadDotEnvLocal();

const RECIPES = {
  github: {
    name: "GitHub",
    provider: "github",
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    apiBaseUrl: "https://api.github.com",
    clientAuthMethod: "client_secret_post",
    supportsPkce: true,
    scopes: ["repo", "read:user", "user:email"],
  },
  slack: {
    name: "Slack",
    provider: "slack",
    authorizationEndpoint: "https://slack.com/oauth/v2/authorize",
    tokenEndpoint: "https://slack.com/api/oauth.v2.access",
    apiBaseUrl: "https://slack.com/api",
    clientAuthMethod: "client_secret_post",
    supportsPkce: false,
    scopes: [
      "channels:read",
      "channels:history",
      "chat:write",
      "users:read",
      "users:read.email",
    ],
  },
  notion: {
    name: "Notion",
    provider: "notion",
    authorizationEndpoint: "https://api.notion.com/v1/oauth/authorize",
    tokenEndpoint: "https://api.notion.com/v1/oauth/token",
    apiBaseUrl: "https://api.notion.com",
    clientAuthMethod: "client_secret_basic",
    supportsPkce: true,
    scopes: [],
    authorizationParams: { owner: "user" },
  },
  gmail: {
    name: "Gmail",
    provider: "google",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://gmail.googleapis.com",
    clientAuthMethod: "client_secret_post",
    supportsPkce: true,
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ],
    authorizationParams: { access_type: "offline", prompt: "consent" },
  },
  "google-drive": {
    name: "Google Drive",
    provider: "google",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://www.googleapis.com",
    clientAuthMethod: "client_secret_post",
    supportsPkce: true,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    authorizationParams: { access_type: "offline", prompt: "consent" },
  },
  figma: {
    name: "Figma",
    provider: "figma",
    authorizationEndpoint: "https://www.figma.com/oauth",
    tokenEndpoint: "https://api.figma.com/v1/oauth/token",
    apiBaseUrl: "https://api.figma.com",
    clientAuthMethod: "client_secret_basic",
    supportsPkce: false,
    scopes: ["files:read"],
  },
};

const key = (process.argv[2] || "").trim();
if (!key || !(key in RECIPES)) {
  console.error(
    `Usage: node scripts/connectors/configure-oauth.mjs <${Object.keys(RECIPES).join("|")}>`,
  );
  process.exit(1);
}

const envKey = key.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
const clientId = (process.env[`CONNECTOR_OAUTH_${envKey}_CLIENT_ID`] || "").trim();
const clientSecret = (
  process.env[`CONNECTOR_OAUTH_${envKey}_CLIENT_SECRET`] || ""
).trim();
const adminToken = (process.env.CONNECTOR_GATEWAY_ADMIN_TOKEN || "").trim();
const gatewayUrl = (
  process.env.CONNECTOR_GATEWAY_URL ||
  "https://clauxen-connector-gateway.ujjwal-8fc.workers.dev"
).replace(/\/+$/, "");

if (!clientId || !clientSecret) {
  console.error(
    `Missing CONNECTOR_OAUTH_${envKey}_CLIENT_ID / CONNECTOR_OAUTH_${envKey}_CLIENT_SECRET`,
  );
  process.exit(1);
}
if (!adminToken) {
  console.error("Missing CONNECTOR_GATEWAY_ADMIN_TOKEN");
  process.exit(1);
}

const recipe = RECIPES[key];
const response = await fetch(
  `${gatewayUrl}/v1/admin/connectors/${encodeURIComponent(key)}/oauth`,
  {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-clauxen-admin": adminToken,
    },
    body: JSON.stringify({
      ...recipe,
      clientId,
      clientSecret,
      enabled: true,
    }),
  },
);

const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error("OAuth configure failed", response.status, payload);
  process.exit(1);
}
console.log(`Configured ${key} OAuth app (enabled). Client secret sealed in Supabase.`);
