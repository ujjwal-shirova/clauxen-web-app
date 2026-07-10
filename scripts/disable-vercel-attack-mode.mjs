#!/usr/bin/env node
/**
 * Disable Vercel Attack Challenge Mode ("We're verifying your browser").
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/disable-vercel-attack-mode.mjs
 *   node scripts/disable-vercel-attack-mode.mjs --team <teamId>
 *
 * Get a token: https://vercel.com/account/tokens
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_ID = "prj_fvcWCHb6BfJHggIDiUQDXH9sOBjr";

function readLocalToken() {
  try {
    const authPath = join(homedir(), ".vercel", "auth.json");
    const auth = JSON.parse(readFileSync(authPath, "utf8"));
    return auth.token ?? null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const teamIdx = argv.indexOf("--team");
  return {
    teamId: teamIdx >= 0 ? argv[teamIdx + 1] : process.env.VERCEL_TEAM_ID ?? null,
  };
}

async function vercelFetch(path, { method = "GET", body, token, teamId }) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const message =
      json?.error?.message ?? json?.message ?? response.statusText;
    throw new Error(`${response.status} ${message}`);
  }

  return json;
}

async function main() {
  const { teamId } = parseArgs(process.argv.slice(2));
  const token = process.env.VERCEL_TOKEN ?? readLocalToken();

  if (!token) {
    console.error(
      "Missing Vercel token. Set VERCEL_TOKEN or run `npx vercel@41 login`.",
    );
    process.exit(1);
  }

  console.log(`Disabling attack challenge mode for project ${PROJECT_ID}...`);

  const result = await vercelFetch("/v1/security/attack-mode", {
    method: "POST",
    token,
    teamId,
    body: {
      projectId: PROJECT_ID,
      attackModeEnabled: false,
    },
  });

  console.log("Attack challenge mode disabled:", result);
}

main().catch((error) => {
  console.error("Failed to disable Vercel attack challenge mode:", error.message);
  console.error(
    "\nIf the token is invalid, create one at https://vercel.com/account/tokens",
  );
  console.error(
    "Cloudflare Bot Fight / Under Attack on clauxen.com must be disabled separately in Cloudflare.",
  );
  process.exit(1);
});
