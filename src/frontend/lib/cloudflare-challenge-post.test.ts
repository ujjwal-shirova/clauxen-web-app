import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { isCloudflareChallengeDocumentPost } from "./cloudflare-challenge-post";

function req(
  path: string,
  init?: { method?: string; headers?: Record<string, string> },
) {
  return new NextRequest(`https://clauxen.com${path}`, {
    method: init?.method ?? "POST",
    headers: init?.headers,
  });
}

describe("isCloudflareChallengeDocumentPost", () => {
  it("treats document POSTs as challenge completions", () => {
    assert.equal(isCloudflareChallengeDocumentPost(req("/login")), true);
    assert.equal(isCloudflareChallengeDocumentPost(req("/new")), true);
    assert.equal(isCloudflareChallengeDocumentPost(req("/")), true);
    assert.equal(isCloudflareChallengeDocumentPost(req("/c/abc123")), true);
  });

  it("ignores GET and API routes", () => {
    assert.equal(
      isCloudflareChallengeDocumentPost(req("/login", { method: "GET" })),
      false,
    );
    assert.equal(
      isCloudflareChallengeDocumentPost(req("/api/v1/auth/login")),
      false,
    );
  });

  it("preserves Next.js Server Actions", () => {
    assert.equal(
      isCloudflareChallengeDocumentPost(
        req("/new", { headers: { "next-action": "abc" } }),
      ),
      false,
    );
  });
});
