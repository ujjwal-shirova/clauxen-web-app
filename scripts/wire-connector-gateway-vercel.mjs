#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_ID = "prj_fvcWCHb6BfJHggIDiUQDXH9sOBjr";
const TEAM_ID = "team_uO4zWwgLWJfc9GpMMrr5KOwa";
const API = "https://api.vercel.com";

function loadVercelToken() {
  if (process.env.VERCEL_TOKEN?.trim()) return process.env.VERCEL_TOKEN.trim();
  const candidates = [
    join(homedir(), ".cursor", "vercel-token"),
    join(homedir(), "Library/Application Support/com.vercel.cli/auth.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const value = readFileSync(path, "utf8");
    if (path.endsWith(".json")) {
      const parsed = JSON.parse(value);
      if (typeof parsed.token === "string" && parsed.token) return parsed.token;
    } else if (value.trim()) {
      return value.trim();
    }
  }
  throw new Error("Vercel authentication was not found.");
}

function loadInternalToken(path) {
  const line = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .find((item) => item.startsWith("CONNECTOR_GATEWAY_INTERNAL_TOKEN="));
  const value = line?.slice("CONNECTOR_GATEWAY_INTERNAL_TOKEN=".length).trim();
  if (!value)
    throw new Error(
      "Connector internal token is missing from the secrets file.",
    );
  return value;
}

async function vercelApi(token, path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} failed with HTTP ${response.status}`,
    );
  }
  return body;
}

async function upsert(token, key, value, type) {
  await vercelApi(
    token,
    `/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&upsert=true`,
    {
      method: "POST",
      body: JSON.stringify({
        key,
        value,
        type,
        target: ["production", "preview", "development"],
      }),
    },
  );
  console.log(`Set ${key} for production, preview, and development.`);
}

async function main() {
  const secretsFile =
    process.argv[2] ?? join(process.cwd(), ".vercel/connector-gateway.secrets");
  const gatewayUrl =
    process.argv[3] ??
    "https://clauxen-connector-gateway.ujjwal-8fc.workers.dev";
  if (!existsSync(secretsFile)) {
    throw new Error(`Connector secrets file was not found at ${secretsFile}.`);
  }
  const parsedUrl = new URL(gatewayUrl);
  if (parsedUrl.protocol !== "https:")
    throw new Error("Gateway URL must use HTTPS.");

  const token = loadVercelToken();
  await upsert(
    token,
    "CONNECTOR_GATEWAY_URL",
    parsedUrl.toString().replace(/\/$/, ""),
    "encrypted",
  );
  await upsert(
    token,
    "CONNECTOR_GATEWAY_INTERNAL_TOKEN",
    loadInternalToken(secretsFile),
    "sensitive",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
