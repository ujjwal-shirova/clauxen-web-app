import { test } from "node:test";
import assert from "node:assert/strict";
import { providerClaims } from "./src/providers";

test("unverified emails cannot authorize or link a Supabase account", async () => {
  for (const provider of ["github", "gitlab"] as const) {
    const fetcher = (async (input: any) => {
      if (String(input).includes("/token") || String(input).includes("/access_token")) return Response.json({ access_token: "fixture-token" });
      if (String(input).includes("/user/emails")) return Response.json([{ email: "unverified@example.test", primary: true, verified: false }]);
      return Response.json({ id: 123, email: "unverified@example.test", confirmed_at: null });
    }) as typeof fetch;
    await assert.rejects(providerClaims(provider, { id: "fixture", secret: "fixture" }, "code", "verifier", fetcher), /verified_email_required/);
  }
});
test("provider token exchange errors cannot reach user identity lookup", async () => {
  let calls = 0;
  await assert.rejects(providerClaims("github", { id: "fixture", secret: "fixture" }, "code", "verifier", (async () => {
    calls++; return Response.json({ error: "bad_verification_code" });
  }) as typeof fetch), /provider_exchange_failed/);
  assert.equal(calls, 1);
});
