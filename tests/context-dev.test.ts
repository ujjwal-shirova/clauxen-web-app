import assert from "node:assert/strict";
import { test } from "node:test";
import { env } from "../src/server/config/env";
import {
  crawlWebsiteWithContextDev,
  mapUrlsWithContextDev,
  scrapeUrlWithContextDev,
  searchWebWithContextDev,
} from "../src/server/search/context-dev";
import { autonomousAgentTools } from "../src/server/inference/autonomous-tools/definitions";
import { executeAutonomousTool } from "../src/server/inference/autonomous-tools/executor";

function useFixtureKey() {
  const originalKey = env.contextDevApiKey;
  env.contextDevApiKey = "fixture";
  return () => {
    env.contextDevApiKey = originalKey;
  };
}

function useMockFetch(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) =>
    handler(
      new URL(input instanceof Request ? input.url : String(input)),
      init,
    );
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("search sends structured Context.dev filters and content options", async () => {
  const restoreKey = useFixtureKey();
  const restoreFetch = useMockFetch((url, init) => {
    assert.equal(url.toString(), "https://api.context.dev/v1/web/search");
    assert.equal(init?.method, "POST");
    assert.equal(
      (init?.headers as Record<string, string>).authorization,
      "Bearer fixture",
    );
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body, {
      query: "Context.dev docs",
      numResults: 12,
      includeDomains: ["docs.context.dev"],
      freshness: "last_month",
      languages: ["en"],
      markdownOptions: { enabled: true, useMainContentOnly: true },
      highlightsOptions: { enabled: true, maxCharacters: 1200 },
    });
    return Response.json({ query: body.query, results: [] });
  });
  try {
    await searchWebWithContextDev({
      query: "Context.dev docs",
      numResults: 12,
      includeDomains: ["docs.context.dev"],
      freshness: "last_month",
      languages: ["en"],
      markdownOptions: { enabled: true, useMainContentOnly: true },
      highlightsOptions: { enabled: true, maxCharacters: 1200 },
    });
  } finally {
    restoreFetch();
    restoreKey();
  }
});

test("scrape passes nested formats, extraction schemas, rendering, and actions without code", async () => {
  const restoreKey = useFixtureKey();
  const restoreFetch = useMockFetch((url, init) => {
    assert.equal(url.pathname, "/v1/web/scrape");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.formats.markdown, true);
    assert.equal(body.formats.json, true);
    assert.deepEqual(body.jsonParams.schema, {
      type: "object",
      properties: { title: { type: "string" } },
    });
    assert.equal(body.sharedParams.mainContentOnly, true);
    assert.deepEqual(body.sharedParams.actions, [
      { type: "waitFor", selector: "main" },
    ]);
    return Response.json({ url: body.url, markdown: { data: "Docs" } });
  });
  try {
    await scrapeUrlWithContextDev({
      url: "https://docs.context.dev/introduction",
      formats: { markdown: true, json: true },
      jsonParams: {
        schema: {
          type: "object",
          properties: { title: { type: "string" } },
        },
      },
      sharedParams: {
        mainContentOnly: true,
        actions: [{ type: "waitFor", selector: "main" }],
      },
    });
  } finally {
    restoreFetch();
    restoreKey();
  }
});

test("map serializes filters, headers, and deep-object timeout query parameters", async () => {
  const restoreKey = useFixtureKey();
  const restoreFetch = useMockFetch((url, init) => {
    assert.equal(url.origin, "https://api.context.dev");
    assert.equal(url.pathname, "/v1/web/urls");
    assert.equal(init?.method, "GET");
    assert.equal(init?.body, undefined);
    assert.equal(url.searchParams.get("domain"), "docs.context.dev");
    assert.equal(url.searchParams.get("includeSubdomains"), "true");
    assert.equal(url.searchParams.get("maxLinks"), "250");
    assert.equal(url.searchParams.get("urlRegex"), "/api-reference/");
    assert.equal(url.searchParams.get("X-Test"), "value");
    assert.equal(url.searchParams.get("timeoutOpts[milliseconds]"), "20000");
    assert.equal(
      url.searchParams.get("timeoutOpts[behavior]"),
      "return-partial",
    );
    return Response.json({
      success: true,
      domain: "docs.context.dev",
      urls: [],
    });
  });
  try {
    await mapUrlsWithContextDev({
      domain: "docs.context.dev",
      includeSubdomains: true,
      maxLinks: 250,
      urlRegex: "/api-reference/",
      headers: { "X-Test": "value" },
      timeoutOpts: { milliseconds: 20000, behavior: "return-partial" },
    });
  } finally {
    restoreFetch();
    restoreKey();
  }
});

test("crawl sends bounded scope and page-content controls", async () => {
  const restoreKey = useFixtureKey();
  const restoreFetch = useMockFetch((url, init) => {
    assert.equal(url.pathname, "/v1/web/crawl");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.maxPages, 25);
    assert.equal(body.maxDepth, 2);
    assert.equal(body.useMainContentOnly, true);
    assert.deepEqual(body.excludeSelectors, ["nav", "footer"]);
    assert.equal(body.stopAfterMs, 80000);
    return Response.json({ results: [], metadata: { numUrls: 0 } });
  });
  try {
    await crawlWebsiteWithContextDev({
      url: "https://docs.context.dev/introduction",
      maxPages: 25,
      maxDepth: 2,
      useMainContentOnly: true,
      excludeSelectors: ["nav", "footer"],
      stopAfterMs: 80000,
    });
  } finally {
    restoreFetch();
    restoreKey();
  }
});

test("agent catalog exposes exactly the structured Context.dev web surface", () => {
  const tools = autonomousAgentTools.filter((tool) =>
    tool.name.startsWith("web_"),
  );
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["web_search", "web_scrape", "web_map", "web_crawl"],
  );
  for (const tool of tools) {
    assert.match(tool.description, /structured JSON/i);
    assert.doesNotMatch(tool.description, /Exa/i);
  }
  const scrape = tools.find((tool) => tool.name === "web_scrape");
  const properties = scrape?.parameters.properties as Record<string, unknown>;
  for (const parameter of [
    "formats",
    "markdownParams",
    "parseParams",
    "highlightsParams",
    "jsonParams",
    "sharedParams",
    "maxAgeMs",
    "timeoutOpts",
  ]) {
    assert(parameter in properties, `missing web_scrape.${parameter}`);
  }
});

test("web_search executor returns indexed model-ready evidence and progress", async () => {
  const restoreKey = useFixtureKey();
  const restoreFetch = useMockFetch((_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.numResults, 5);
    assert.equal(body.country, "us");
    return Response.json({
      query: body.query,
      request_id: "request-1",
      results: [
        {
          title: "Context.dev",
          url: "https://docs.context.dev/introduction",
          description: "Web data API",
          relevance: "high",
          markdown: { markdown: "Full documentation", code: "SUCCESS" },
          highlights: { highlights: ["Web data"], code: "SUCCESS" },
        },
      ],
    });
  });
  const events: Record<string, unknown>[] = [];
  try {
    const outcome = await executeAutonomousTool(
      "web_search",
      { query: "Context.dev", numResults: 5 },
      {
        conversationId: "conversation-1",
        userCountryCode: "US",
        onToolProgress: (event) => events.push(event),
      },
    );
    const output = outcome.output as Record<string, any>;
    assert.equal(output.provider, "context.dev");
    assert.equal(output.results[0].index, 1);
    assert.equal(output.results[0].snippet, "Web data API");
    assert.equal(output.results[0].markdown, "Full documentation");
    assert.deepEqual(output.results[0].highlights, ["Web data"]);
    assert.equal(events[0].status, "searching");
    assert.equal(events[1].status, "results");
  } finally {
    restoreFetch();
    restoreKey();
  }
});
