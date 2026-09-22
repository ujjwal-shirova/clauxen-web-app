#!/usr/bin/env node
/**
 * Narrow Cloudflare Managed Challenge so it does NOT re-fire on every chat
 * navigation / RSC fetch / API call.
 *
 * Policy (Free plan, ≤5 custom rules):
 *  1. Skip APIs, Next internals, RSC — never challenge product traffic
 *  2. Block scanners / empty UA / sensitive paths
 *  3. Managed Challenge only on public auth entry (once per clearance)
 *  4. Challenge suspicious auth POSTs
 *  5. (optional slot) keep prior rate-limit outside custom rules
 *
 * Also raises challenge_ttl to 1 year so clearance isn't constantly re-asked.
 *
 * Requires CLOUDFLARE_API_TOKEN with:
 *   Zone → Zone WAF → Edit, Zone → Zone Settings → Edit
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   node scripts/ops/apply-cloudflare-challenge-policy.mjs
 *   node scripts/ops/apply-cloudflare-challenge-policy.mjs --dry-run
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ZONE_NAME = "clauxen.com";
const ACCOUNT_HINT = "8fc7a67e9057989309921f362784ecf4";
const CHALLENGE_TTL_SECONDS = 31_536_000; // 1 year

const DRY_RUN = process.argv.includes("--dry-run");

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2] ?? "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN missing");
  process.exit(1);
}

async function cf(path, { method = "GET", body } = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  if (!json.success) {
    const msg = (json.errors || [])
      .map((e) => `${e.code}: ${e.message}`)
      .join("; ");
    throw new Error(`${method} ${path} → ${msg || response.statusText}`);
  }
  return json.result;
}

/**
 * Desired custom rules — order matters (first match wins).
 * Intentionally no broad HTML challenge on /c/* /new — that re-fired on chat nav.
 * No cf.threat_score (deprecated on upgraded zones).
 */
function desiredRules() {
  const notProductTraffic = `not starts_with(http.request.uri.path, "/api/") and not starts_with(http.request.uri.path, "/_next/") and not starts_with(http.request.uri.path, "/cdn-cgi/") and not http.request.uri.query contains "_rsc"`;

  return [
    {
      description: "Block scanners, empty UA, and sensitive paths",
      action: "block",
      expression: `(http.user_agent eq "" or http.request.uri.path contains "/.env" or http.request.uri.path contains "/wp-admin" or http.request.uri.path contains "/wp-login" or http.request.uri.path contains "/phpmyadmin" or http.request.uri.path contains "/.git")`,
      enabled: true,
    },
    {
      description:
        "Managed Challenge once on public auth entry (not chat nav)",
      action: "managed_challenge",
      expression: `(http.request.method eq "GET" and ${notProductTraffic} and (http.request.uri.path eq "/" or http.request.uri.path eq "/login" or starts_with(http.request.uri.path, "/signup") or starts_with(http.request.uri.path, "/auth/")))`,
      enabled: true,
    },
    {
      description: "Challenge suspicious auth POSTs (empty/short UA only)",
      action: "managed_challenge",
      expression: `(http.request.method eq "POST" and (starts_with(http.request.uri.path, "/api/v1/auth/") or starts_with(http.request.uri.path, "/auth/") or http.request.uri.path eq "/login" or starts_with(http.request.uri.path, "/signup")) and (http.user_agent eq "" or not exists(http.user_agent) or len(http.user_agent) lt 12))`,
      enabled: true,
    },
  ];
}

async function main() {
  console.log(`Account hint: ${ACCOUNT_HINT}`);
  console.log(DRY_RUN ? "DRY RUN — no writes" : "APPLYING challenge policy");

  const zones = await cf(`/zones?name=${ZONE_NAME}`);
  const zone = zones?.[0];
  if (!zone?.id) throw new Error(`Zone ${ZONE_NAME} not found`);
  console.log(`Zone ${ZONE_NAME} = ${zone.id}`);

  // Long clearance so users aren't re-challenged constantly.
  try {
    if (!DRY_RUN) {
      await cf(`/zones/${zone.id}/settings/challenge_ttl`, {
        method: "PATCH",
        body: { value: CHALLENGE_TTL_SECONDS },
      });
    }
    console.log(`challenge_ttl → ${CHALLENGE_TTL_SECONDS}s (1y)`);
  } catch (error) {
    console.warn(`challenge_ttl skipped: ${error.message}`);
  }

  // Prefer Under Attack OFF.
  try {
    if (!DRY_RUN) {
      await cf(`/zones/${zone.id}/settings/security_level`, {
        method: "PATCH",
        body: { value: "essentially_off" },
      });
    }
    console.log("security_level → essentially_off (custom rules handle bots)");
  } catch (error) {
    console.warn(`security_level skipped: ${error.message}`);
  }

  let entry;
  try {
    entry = await cf(
      `/zones/${zone.id}/rulesets/phases/http_request_firewall_custom/entrypoint`,
    );
  } catch (error) {
    console.error(`\nCannot read custom rules: ${error.message}`);
    console.error(
      "Create an API token with Zone WAF Edit + Zone Settings Edit for clauxen.com,",
    );
    console.error("put it in CLOUDFLARE_API_TOKEN, then re-run this script.\n");
    process.exit(2);
  }

  const rulesetId = entry.id;
  const existing = entry.rules ?? [];
  console.log(`Current custom rules: ${existing.length}`);
  for (const rule of existing) {
    console.log(`  - [${rule.action}] ${rule.description || rule.id}`);
    console.log(`    ${rule.expression}`);
  }

  const nextRules = desiredRules();

  if (DRY_RUN) {
    console.log("\nDesired rules:");
    for (const rule of nextRules) {
      console.log(`  - [${rule.action}] ${rule.description}`);
      console.log(`    ${rule.expression}`);
    }
    return;
  }

  let applied = null;
  try {
    applied = await cf(`/zones/${zone.id}/rulesets/${rulesetId}`, {
      method: "PUT",
      body: { rules: nextRules },
    });
    console.log(`\nApplied ${nextRules.length} custom rules.`);
  } catch (error) {
    throw error;
  }

  for (const rule of applied.rules ?? []) {
    console.log(`  ✓ [${rule.action}] ${rule.description || rule.id}`);
  }
  console.log("\nDone. Chat/API/RSC traffic should no longer re-challenge.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
