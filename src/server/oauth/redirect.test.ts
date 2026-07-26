import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { isAllowedLoopbackRedirect } from "./redirect";
import { verifyPkceS256 } from "./crypto";

describe("isAllowedLoopbackRedirect", () => {
  it("accepts 127.0.0.1 with port and /callback", () => {
    assert.equal(
      isAllowedLoopbackRedirect("http://127.0.0.1:54321/callback"),
      true,
    );
  });

  it("accepts IPv6 loopback", () => {
    assert.equal(isAllowedLoopbackRedirect("http://[::1]:9999/callback"), true);
  });

  it("rejects non-loopback hosts", () => {
    assert.equal(
      isAllowedLoopbackRedirect("http://example.com/callback"),
      false,
    );
  });

  it("rejects https and wrong path", () => {
    assert.equal(isAllowedLoopbackRedirect("https://127.0.0.1/callback"), false);
    assert.equal(isAllowedLoopbackRedirect("http://127.0.0.1/other"), false);
  });
});

describe("verifyPkceS256", () => {
  it("validates a matching verifier/challenge", () => {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    assert.equal(verifyPkceS256(verifier, challenge), true);
    assert.equal(verifyPkceS256(verifier, "wrong"), false);
  });
});
