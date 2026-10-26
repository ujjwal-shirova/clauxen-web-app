#!/usr/bin/env node
/**
 * Builds src/server/plugins/connector-endpoints.generated.json from the
 * scraped MCP dataset (public/data/mcp-plugins.json) and the marketplace
 * catalog. The runtime imports the compact JSON so endpoint resolution works
 * on Cloudflare Workers, where public/ is not readable through node:fs.
 *
 * Usage: node scripts/build-connector-endpoints.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataset = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/mcp-plugins.json"), "utf8"),
);
const catalog = JSON.parse(
  fs.readFileSync(
    path.join(root, "src/client/components/plugins/marketplace-catalog.json"),
    "utf8",
  ),
);

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const tokens = (value) => value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const exact = new Map();
const normalized = new Map();
for (const plugin of dataset.plugins) {
  for (const key of [plugin.fullRef, plugin.name]) {
    if (!key) continue;
    if (!exact.has(key)) exact.set(key, plugin);
    const fp = normalize(key);
    if (fp && !normalized.has(fp)) normalized.set(fp, plugin);
  }
  if (plugin.displayName) {
    const fp = normalize(plugin.displayName);
    if (fp && !normalized.has(fp)) normalized.set(fp, plugin);
  }
}

function fuzzy(slug) {
  const query = new Set(tokens(slug));
  let best = null;
  let bestOverlap = 0;
  let bestPrecision = 0;
  for (const plugin of dataset.plugins) {
    const candidate = new Set(
      tokens(`${plugin.fullRef} ${plugin.name} ${plugin.displayName ?? ""}`),
    );
    if (candidate.size === 0) continue;
    let overlap = 0;
    for (const token of query) if (candidate.has(token)) overlap += 1;
    if (overlap === 0) continue;
    const precision = overlap / candidate.size;
    if (precision < 0.5) continue;
    if (overlap > bestOverlap || (overlap === bestOverlap && precision > bestPrecision)) {
      best = plugin;
      bestOverlap = overlap;
      bestPrecision = precision;
    }
  }
  return best;
}

function isPublicHttpsUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    if (/[{}$]/.test(raw)) return false;
    const host = url.hostname;
    if (host === "localhost" || host.endsWith(".local")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return false;
    // Cursor-hosted proxies are bound to Cursor's own OAuth apps.
    if (host === "api.cursor.com") return false;
    return true;
  } catch {
    return false;
  }
}

const out = {};
let remote = 0;
for (const id of Object.keys(catalog.plugins)) {
  const plugin =
    exact.get(id) ?? normalized.get(normalize(id)) ?? fuzzy(id) ?? null;
  if (!plugin) continue;
  const servers = (plugin.mcp?.servers ?? [])
    .filter(
      (server) =>
        (server.type === "http" || server.type === "sse") &&
        server.url &&
        isPublicHttpsUrl(server.url.trim()),
    )
    .map((server) => ({
      transport: server.type,
      url: server.url.trim(),
    }));
  if (servers.length === 0) continue;
  remote += 1;
  out[id] = servers[0];
}

const target = path.join(root, "src/server/plugins/connector-endpoints.generated.json");
fs.writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${remote} remote MCP endpoints to ${path.relative(root, target)}`);
