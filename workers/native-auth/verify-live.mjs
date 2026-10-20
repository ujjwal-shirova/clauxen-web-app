import assert from "node:assert/strict";

// Safe negative-credential checks only: never creates a user or selects a human account.
const base = "https://www.clauxen.com/api/v1/auth/native/";
const cases = [
  { path: "health", expected: 200 },
  { path: "user", expected: 401 },
  { path: "token?grant_type=id_token", expected: 400,
    body: { provider: "google", id_token: "invalid-verification-token", nonce: "n".repeat(43) } },
  { path: "token?grant_type=refresh_token", expected: 400,
    body: { refresh_token: "invalid-verification-token" } },
];
for (const { path, expected, body } of cases) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Clauxen-Client": "native-android", "User-Agent": "Clauxen-Android/1.0" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.headers.get("X-Clauxen-Auth-Gateway"), "1", `${path}: did not reach gateway`);
  assert.equal(response.status, expected, `${path}: unexpected status`);
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  await response.json();
  console.log(`${path}: ${response.status}, gateway JSON, no-store`);
}
