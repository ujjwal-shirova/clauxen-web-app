import assert from "node:assert/strict";
import { test } from "node:test";
import { env } from "../src/server/config/env";
import { searchWebWithExa } from "../src/server/search/exa";

test("research hands all 30 source previews off with one search request and one progress event", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = env.exaApiKey;
  let calls = 0,
    events = 0;
  env.exaApiKey = "fixture";
  globalThis.fetch = async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.numResults, 30);
    assert.equal(body.stream, undefined);
    assert.equal(body.outputSchema, undefined);
    assert.equal(body.contents.text.maxCharacters, 1800);
    assert(init?.signal);
    return Response.json({
      results: Array.from({ length: 30 }, (_, i) => ({
        title: `Source ${i}`,
        url: `https://example.test/${i}`,
        text: "Primary source excerpt",
      })),
    });
  };
  try {
    const results = await searchWebWithExa("research query", {
      directResults: true,
      numResults: 30,
      onPartialResults: (hits) => {
        events++;
        assert.equal(hits.length, 30);
      },
    });
    assert.equal(results.length, 30);
    assert.equal(calls, 1);
    assert.equal(events, 1);
    assert.equal(results[29].snippet, "Primary source excerpt");
  } finally {
    globalThis.fetch = originalFetch;
    env.exaApiKey = originalKey;
  }
});
