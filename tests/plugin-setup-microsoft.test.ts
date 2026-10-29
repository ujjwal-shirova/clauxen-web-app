import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  accountLabel,
  authorizationUrl,
  callbackPath,
  exchangeToken,
} from "../src/server/plugins/oauth";
import { CONNECTORS, getConnector } from "../src/server/plugins/registry";

// These are offline contract tests, not evidence of Entra registration or consent.
const scopes = {
  outlook: ["offline_access", "Mail.Read", "Mail.Send"],
  "outlook-calendar": ["offline_access", "Calendars.ReadWrite"],
  onedrive: ["offline_access", "Files.ReadWrite"],
  sharepoint: ["offline_access", "Sites.Read.All"],
  teams: ["offline_access", "Team.ReadBasic.All", "Chat.Read", "ChatMessage.Send"],
};
const origin = "https://www.clauxen.com";
const authority = "https://login.microsoftonline.com/common/oauth2/v2.0";
const clientId = "microsoft-client-fixture";
const clientSecret = "microsoft-secret-fixture-not-a-credential";
const verifier = "v".repeat(43);
const resolve = (name: string): string | undefined => {
  if (name === "PLUGIN_OAUTH_MICROSOFT_CLIENT_ID") return clientId;
  if (name === "PLUGIN_OAUTH_MICROSOFT_CLIENT_SECRET") return clientSecret;
  assert.fail(`Unexpected configuration lookup: ${name}`);
};

test("exactly five Microsoft connectors share one provider configuration", () => {
  assert.deepEqual(
    CONNECTORS.filter(({ oauth }) => oauth?.provider === "microsoft")
      .map(({ id }) => id)
      .sort(),
    Object.keys(scopes).sort(),
  );
});

for (const [id, expectedScopes] of Object.entries(scopes)) {
  test(`${id}: exact per-plugin consent, callback, common authority and S256 PKCE`, () => {
    const definition = getConnector(id)!;
    assert.equal(definition.transport, "rest");
    assert.deepEqual(definition.allowedHosts, ["graph.microsoft.com"]);
    assert.deepEqual(definition.oauth?.scopes, expectedScopes);
    assert.equal(definition.oauth?.tokenUrl, `${authority}/token`);
    assert.equal(definition.oauth?.tokenAuth, "body");

    const url = authorizationUrl(definition, origin, "state-fixture", verifier, resolve);
    assert.equal(`${url.origin}${url.pathname}`, `${authority}/authorize`);
    assert.equal(url.searchParams.get("client_id"), clientId);
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("prompt"), "select_account");
    assert.equal(url.searchParams.get("state"), "state-fixture");
    assert.equal(callbackPath(definition.id), `/api/v1/plugins/callback/${id}`);
    assert.equal(
      url.searchParams.get("redirect_uri"),
      `${origin}/api/v1/plugins/callback/${id}`,
    );
    assert.deepEqual(url.searchParams.get("scope")?.split(" "), expectedScopes);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(
      url.searchParams.get("code_challenge"),
      createHash("sha256").update(verifier).digest("base64url"),
    );
    assert.ok(!url.href.includes(clientSecret));
    assert.ok(!url.href.includes(verifier));
  });

  test(`${id}: code and refresh exchanges use the same confidential client`, async () => {
    const definition = getConnector(id)!;
    const requests: URLSearchParams[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      assert.equal(String(input), `${authority}/token`);
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "error");
      assert.ok(init?.signal instanceof AbortSignal);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Content-Type"), "application/x-www-form-urlencoded");
      assert.equal(headers.get("Authorization"), null);
      const params = new URLSearchParams(String(init?.body));
      assert.equal(params.get("client_id"), clientId);
      assert.equal(params.get("client_secret"), clientSecret);
      requests.push(params);
      return Response.json({
        token_type: "Bearer",
        access_token: "access-fixture",
        ...(requests.length === 1 ? { refresh_token: "refresh-fixture" } : {}),
        expires_in: 3600,
        // Microsoft need not echo offline_access in the Graph access-token scopes.
        scope: expectedScopes.filter((scope) => scope !== "offline_access").join(" "),
      });
    };
    const first = await exchangeToken(definition, {
      origin,
      code: "code-fixture",
      verifier,
      resolve,
      fetch: fetcher,
    });
    assert.equal(requests[0].get("grant_type"), "authorization_code");
    assert.equal(requests[0].get("code_verifier"), verifier);
    assert.equal(requests[0].get("code"), "code-fixture");
    assert.equal(requests[0].get("redirect_uri"), origin + callbackPath(definition.id));

    const refreshed = await exchangeToken(definition, {
      origin,
      previous: first.credential,
      resolve,
      fetch: fetcher,
    });
    assert.equal(requests.length, 2);
    assert.equal(requests[1].get("grant_type"), "refresh_token");
    assert.equal(requests[1].get("refresh_token"), "refresh-fixture");
    assert.equal(requests[1].has("code"), false);
    assert.equal(refreshed.credential.refreshToken, "refresh-fixture");
    assert.deepEqual(refreshed.credential.scopes, expectedScopes.slice(1));

    let identityCalls = 0;
    const label = await accountLabel(definition, refreshed.credential, {}, async () => {
      identityCalls++;
      return Response.json({});
    });
    assert.equal(identityCalls, 0, "No unconsented User.Read profile request");
    assert.equal(label, `${definition.name} account`);
  });
}
