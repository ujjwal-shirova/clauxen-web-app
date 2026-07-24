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
      title: "Independent article",
      url: "https://www.independent.co.uk/news/a",
      domain: "independent.co.uk",
    }),
    source({
      title: "The Hindu coverage",
      url: "https://www.thehindu.com/news/b",
      domain: "thehindu.com",
    }),
  ];

  it("converts indexed citations to markdown links", () => {
    const out = convertCitationReferencesToLinks(
      "Claim ([Independent article][1]).",
      sources,
    );
    assert.match(out, /\[Independent article\]\(https:\/\/www\.independent\.co\.uk\/news\/a\)/);
  });

  it("falls back to title/domain when index is out of range", () => {
    const out = convertCitationReferencesToLinks(
      "Claim ([The Hindu][9]).",
      sources,
    );
    assert.equal(
      out.includes("([The Hindu][9])"),
      false,
      "raw citation markup must not remain",
    );
    assert.match(out, /\[The Hindu\]\(https:\/\/www\.thehindu\.com\/news\/b\)/);
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
