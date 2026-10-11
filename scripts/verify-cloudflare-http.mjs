#!/usr/bin/env node
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";

const origin = process.argv[2] || "https://clauxen-app.shirova.workers.dev";
const checks = [
  ["/overview", 200],
  ["/new", 200],
  ["/login", 307],
  ["/api/v1/chats", 401],
  ["/api/v1/settings", 401],
  ["/api/v1/billing/plans", 200],
  ["/api/v1/storage/object", 401],
  ["/api/v1/internal/generations/continue", 401, "POST"],
  ["/assets/icons/clauxen-favicon.png", 200],
  ["/_next/image?url=%2Fassets%2Ficons%2Fclauxen-favicon.png&w=64&q=75", 200],
];
const results = await Promise.all(
  checks.map(async ([path, expected, method = "GET"]) => {
    const started = Date.now();
    const response = await fetch(origin + path, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    const bytes = (await response.arrayBuffer()).byteLength;
    const result = {
      path,
      status: response.status,
      expected,
      bytes,
      milliseconds: Date.now() - started,
      contentType: response.headers.get("content-type"),
      cacheControl: response.headers.get("cache-control"),
      serverTiming: response.headers.get("server-timing"),
      mitigation: response.headers.get("cf-mitigated"),
      server: response.headers.get("server"),
      vercelId: response.headers.get("x-vercel-id"),
    };
    console.log(JSON.stringify(result));
    return result;
  }),
);
mkdirSync("tmp", { recursive: true });
writeFileSync(
  "tmp/cloudflare-http-checks.json",
  JSON.stringify(
    { origin, checkedAt: new Date().toISOString(), results },
    null,
    2,
  ),
);
for (const result of results) {
  // The production zone deliberately challenges this public auth entry.
  // This validates the edge rule only; it cannot verify browser clearance.
  const expectedChallenge =
    ["clauxen.com", "www.clauxen.com"].includes(new URL(origin).hostname) &&
    result.path === "/login" &&
    result.status === 403 &&
    result.mitigation === "challenge";
  if (!expectedChallenge)
    assert.equal(result.status, result.expected, result.path);
  else console.log("/login: existing edge challenge; browser clearance not tested");
  assert.equal(result.server, "cloudflare", result.path);
  assert.equal(result.vercelId, null, result.path);
}
assert(
  results
    .find((result) => result.path.startsWith("/_next/image"))
    ?.contentType?.startsWith("image/"),
  "image optimization returns an image",
);
console.log(`Passed ${results.length} HTTP checks`);
