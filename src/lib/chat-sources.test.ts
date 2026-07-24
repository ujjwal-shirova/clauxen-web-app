import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  convertCitationReferencesToLinks,
  type ChatSource,
} from "@/lib/chat-sources";

function source(
  partial: Pick<ChatSource, "title" | "url" | "domain">,
): ChatSource {
  return {
    id: partial.url,
    snippet: "",
    messageId: "m1",
    ...partial,
  };
}

describe("convertCitationReferencesToLinks", () => {
  const sources = [
    source({
      title: "Example Source Alpha",
      url: "https://alpha.example.com/article-a",
      domain: "alpha.example.com",
    }),
    source({
      title: "Example Source Beta",
      url: "https://beta.example.com/article-b",
      domain: "beta.example.com",
    }),
  ];

  it("converts indexed citations to markdown links for any source", () => {
    const out = convertCitationReferencesToLinks(
      "Claim ([Example Source Alpha][1]).",
      sources,
    );
    assert.match(
      out,
      /\[Example Source Alpha\]\(https:\/\/alpha\.example\.com\/article-a\)/,
    );
  });

  it("falls back to title/domain when index is out of range", () => {
    const out = convertCitationReferencesToLinks(
      "Claim ([Example Source Beta][9]).",
      sources,
    );
    assert.equal(
      out.includes("([Example Source Beta][9])"),
      false,
      "raw citation markup must not remain",
    );
    assert.match(
      out,
      /\[Example Source Beta\]\(https:\/\/beta\.example\.com\/article-b\)/,
    );
  });

  it("matches by domain fragment when titles differ", () => {
    const out = convertCitationReferencesToLinks(
      "Claim ([alpha.example.com][1]).",
      sources,
    );
    assert.match(out, /https:\/\/alpha\.example\.com\/article-a/);
    assert.equal(out.includes("[1]"), false);
  });

  it("strips unmatched citation markup to plain title", () => {
    const out = convertCitationReferencesToLinks(
      "Claim ([Unknown Outlet][99]).",
      sources,
    );
    assert.equal(out.includes("[99]"), false);
    assert.match(out, /Claim Unknown Outlet\./);
  });
});
