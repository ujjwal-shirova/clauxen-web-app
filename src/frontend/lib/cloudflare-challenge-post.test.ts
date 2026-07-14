import { describe, expect, it } from "vitest";
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
    expect(isCloudflareChallengeDocumentPost(req("/login"))).toBe(true);
    expect(isCloudflareChallengeDocumentPost(req("/new"))).toBe(true);
    expect(isCloudflareChallengeDocumentPost(req("/"))).toBe(true);
    expect(isCloudflareChallengeDocumentPost(req("/c/abc123"))).toBe(true);
  });

  it("ignores GET and API routes", () => {
    expect(
      isCloudflareChallengeDocumentPost(req("/login", { method: "GET" })),
    ).toBe(false);
    expect(isCloudflareChallengeDocumentPost(req("/api/v1/auth/login"))).toBe(
      false,
    );
  });

  it("preserves Next.js Server Actions", () => {
    expect(
      isCloudflareChallengeDocumentPost(
        req("/new", { headers: { "next-action": "abc" } }),
      ),
    ).toBe(false);
  });
});
