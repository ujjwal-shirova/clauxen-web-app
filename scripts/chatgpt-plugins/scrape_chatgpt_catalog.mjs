#!/usr/bin/env node
/**
 * Live-capture the public ChatGPT plugin directory the same way Clauxen's
 * catalog was originally built: listing + per-plugin detail from
 * chatgpt.com/backend-anon/ps/*, including mcp_servers URLs.
 *
 * Usage:
 *   node scripts/chatgpt-plugins/scrape_chatgpt_catalog.mjs
 *
 * Requires Playwright with Google Chrome (`channel: "chrome"`) so Cloudflare
 * lets the public plugin APIs through. Optional:
 *   CHATGPT_STORAGE_STATE=/tmp/chatgpt-plugins-state.json
 *   PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs
 */

import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(scriptDir, "chatgpt-catalog.json");
const MCP_LIST = path.join(scriptDir, "mcp-url-list.json");
const PROGRESS = path.join(scriptDir, "chatgpt-catalog.progress.json");

const CATEGORIES = [
  "featured",
  "new-and-noteworthy",
  "productivity",
  "creativity",
  "developer-tools",
  "business-and-operations",
  "data-and-analytics",
  "communication",
  "education-and-research",
  "scientific-research",
  "security",
  "finance",
  "healthcare",
  "travel",
  "entertainment",
  "other",
];

const API_HEADERS = {
  "oai-language": "en-US",
  "oai-product-sku": "CONNECTOR_SETTING",
};

async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    "playwright",
    "/Users/ujjwal_tyagi/.npm/_npx/423231821c231c73/node_modules/playwright/index.mjs",
  ].filter(Boolean);
  const errors = [];
  for (const spec of candidates) {
    try {
      const href = spec.startsWith("/") ? pathToFileURL(spec).href : spec;
      return await import(href);
    } catch (err) {
      errors.push(`${spec}: ${err.message}`);
    }
  }
  throw new Error(
    `Could not import playwright. Install it or set PLAYWRIGHT_MODULE.\n${errors.join("\n")}`,
  );
}

function mcpServersFromDetail(detail) {
  const servers = detail?.release?.mcp_servers;
  if (!Array.isArray(servers)) return [];
  return servers
    .map((item) => {
      const meta = item?.metadata || {};
      const url = meta.url || meta.endpoint || null;
      return {
        key: item?.key || null,
        type: meta.type || null,
        url,
        oauthResource: meta.oauth_resource || meta.oauthResource || null,
      };
    })
    .filter((item) => item.url);
}

function normalizePlugin(listing, detail, categories) {
  const iface = detail?.release?.interface || {};
  const mcpServers = mcpServersFromDetail(detail);
  const mcpUrl = mcpServers[0]?.url || null;
  return {
    id: detail?.id || listing.id,
    name: detail?.name || listing.display_name || listing.id,
    displayName:
      detail?.release?.display_name || listing.display_name || detail?.name || "",
    description: iface.long_description || detail?.release?.description || listing.short_description || "",
    shortDescription: iface.short_description || listing.short_description || "",
    longDescription: iface.long_description || detail?.release?.description || "",
    version: detail?.release?.version || "",
    developer: iface.developer_name || detail?.creator_name || "",
    category: iface.category || "",
    capabilities: iface.capabilities || [],
    websiteUrl: iface.website_url || "",
    privacyPolicyUrl: iface.privacy_policy_url || "",
    termsOfServiceUrl: iface.terms_of_service_url || "",
    defaultPrompts: iface.default_prompts || (iface.default_prompt ? [iface.default_prompt] : []),
    keywords: iface.keywords || listing.keywords || [],
    logoUrl: iface.logo_url || listing.icon_url || "",
    logoUrlDark: iface.logo_url_dark || listing.icon_url_dark || "",
    brandColor: iface.brand_color || "",
    requiresLocalExecutor: Boolean(
      listing.requires_local_executor ?? detail?.release?.requires_local_executor,
    ),
    sourceUrl: `https://chatgpt.com/plugins/${detail?.id || listing.id}`,
    categories,
    directoryDescription: listing.short_description || "",
    captureStatus: "detail-api",
    status: detail?.status || listing.status || "",
    discoverability: detail?.discoverability || "",
    authenticationPolicy: detail?.authentication_policy || "",
    installationPolicy: detail?.installation_policy || listing.installation_policy || "",
    canonicalAppId: detail?.canonical_app_id || "",
    shareUrl: detail?.share_url || "",
    mcpUrl,
    mcpServers,
    skills: (detail?.release?.skills || []).map((skill) => ({
      name: skill.name,
      displayName: skill.interface?.display_name || skill.name,
      description: skill.description || skill.interface?.short_description || "",
    })),
    rawListing: listing,
    rawDetail: detail,
  };
}

async function api(page, pathName) {
  return page.evaluate(
    async ({ pathName, headers }) => {
      const res = await fetch(pathName, {
        credentials: "include",
        headers,
      });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { parseError: true, text: text.slice(0, 500) };
      }
      return { status: res.status, json };
    },
    { pathName, headers: API_HEADERS },
  );
}

async function listCategory(page, slug) {
  const plugins = [];
  let pageToken = null;
  for (let pageNo = 0; pageNo < 20; pageNo += 1) {
    let pathName = `/backend-anon/ps/plugin-categories/${slug}/plugins?scope=GLOBAL&limit=700`;
    if (pageToken) {
      pathName += `&pageToken=${encodeURIComponent(pageToken)}`;
    }
    const { status, json } = await api(page, pathName);
    if (status !== 200 || !Array.isArray(json?.plugins)) {
      throw new Error(`${slug} list failed HTTP ${status}: ${JSON.stringify(json).slice(0, 200)}`);
    }
    plugins.push(...json.plugins);
    pageToken = json.pagination?.next_page_token || null;
    console.log(
      `  ${slug} page=${pageNo + 1} got=${json.plugins.length} total=${plugins.length} more=${Boolean(pageToken)}`,
    );
    if (!pageToken) break;
  }
  return plugins;
}

async function fetchDetails(page, ids) {
  return page.evaluate(
    async ({ ids, headers }) => {
      return Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/backend-anon/ps/plugins/${id}`, {
            credentials: "include",
            headers,
          });
          const text = await res.text();
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = { parseError: true, text: text.slice(0, 400) };
          }
          return { id, status: res.status, json };
        }),
      );
    },
    { ids, headers: API_HEADERS },
  );
}

function mcpUrlFromApp(app) {
  const resource = app?.supported_auth?.[0]?.resource;
  if (typeof resource === "string" && /^https?:\/\//i.test(resource)) return resource;
  const website = app?.branding?.website;
  if (typeof website === "string" && /mcp/i.test(website) && /^https?:\/\//i.test(website)) {
    return website;
  }
  return null;
}

async function fetchAppsContent(page, appIds) {
  return page.evaluate(
    async ({ appIds, headers }) => {
      const res = await fetch(
        "/backend-anon/apps/content?detail=full&platform=chat&locale=en-US",
        {
          method: "POST",
          credentials: "include",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ app_ids: appIds }),
        },
      );
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { parseError: true, text: text.slice(0, 400) };
      }
      return { status: res.status, json };
    },
    { appIds, headers: API_HEADERS },
  );
}

async function main() {
  const { chromium } = await loadPlaywright();
  const storageState = process.env.CHATGPT_STORAGE_STATE || "/tmp/chatgpt-plugins-state.json";
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
  });
  const context = await browser.newContext({
    storageState: existsSync(storageState) ? storageState : undefined,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  console.log("opening https://chatgpt.com/plugins");
  await page.goto("https://chatgpt.com/plugins", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("text=Plugins", { timeout: 120000 });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const title = await page.title();
  console.log(`page title: ${title}`);
  if (/just a moment|enable javascript/i.test(title) || title.length < 3) {
    throw new Error("Cloudflare challenge still up; rerun headed and complete it once");
  }

  const byId = new Map();
  const categoryMap = new Map();
  for (const slug of CATEGORIES) {
    console.log(`listing ${slug}`);
    const listings = await listCategory(page, slug);
    for (const listing of listings) {
      const existing = byId.get(listing.id);
      if (existing) {
        categoryMap.get(listing.id).add(slug);
      } else {
        byId.set(listing.id, listing);
        categoryMap.set(listing.id, new Set([slug]));
      }
    }
  }

  const ids = [...byId.keys()];
  console.log(`unique listed plugins: ${ids.length}`);

  let existing = {};
  if (existsSync(OUT)) {
    try {
      const prev = JSON.parse(await readFile(OUT, "utf8"));
      for (const plugin of prev.plugins || []) {
        if (plugin.id && plugin.captureStatus === "detail-api") {
          existing[plugin.id] = plugin;
        }
      }
      console.log(`resuming ${Object.keys(existing).length} existing detail rows`);
    } catch {
      existing = {};
    }
  }

  const plugins = [];
  const concurrency = 20;
  let done = 0;
  let mcpFound = plugins.filter((plugin) => plugin.mcpUrl).length;
  const pending = ids.filter((id) => !existing[id]);
  console.log(`details to fetch: ${pending.length}`);

  for (const id of ids) {
    if (existing[id]) {
      plugins.push(existing[id]);
      if (existing[id].mcpUrl) mcpFound += 1;
    }
  }

  async function savePartial() {
    const payload = {
      capturedAt: new Date().toISOString(),
      source: "https://chatgpt.com/plugins",
      api: {
        listing: "/backend-anon/ps/plugin-categories/{category}/plugins",
        detail: "/backend-anon/ps/plugins/{plugin_id}",
      },
      categories: CATEGORIES,
      total: plugins.length,
      listedCount: ids.length,
      mcpUrlCount: plugins.filter((plugin) => plugin.mcpUrl).length,
      plugins,
    };
    await writeFile(OUT, JSON.stringify(payload, null, 2));
    const mcpUrls = plugins
      .filter((plugin) => plugin.mcpUrl)
      .map((plugin) => ({
        id: plugin.id,
        displayName: plugin.displayName,
        mcpUrl: plugin.mcpUrl,
        mcpServers: plugin.mcpServers,
      }));
    await writeFile(MCP_LIST, JSON.stringify(mcpUrls, null, 2));
    const withMcp = plugins.filter((plugin) => plugin.mcpUrl);
    const compact = withMcp.map((plugin) => ({
      id: plugin.id,
      displayName: plugin.displayName,
      shortDescription: plugin.shortDescription || "",
      logoUrl: plugin.logoUrl || "",
      websiteUrl: plugin.websiteUrl || "",
      developer: plugin.developer || "",
      categories: plugin.categories || [],
      sourceUrl: plugin.sourceUrl || "",
      mcpUrl: plugin.mcpUrl,
      mcpServers: plugin.mcpServers || [],
    }));
    await writeFile(path.join(scriptDir, "chatgpt-plugin-list.json"), JSON.stringify(compact, null, 2));
    await writeFile(
      PROGRESS,
      JSON.stringify(
        {
          listed: ids.length,
          detailed: plugins.length,
          mcpUrlCount: mcpUrls.length,
          remaining: pending.length - done,
        },
        null,
        2,
      ),
    );
  }

  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency);
    const fetched = await fetchDetails(page, batch);
    const results = fetched.map((row) => {
      const listing = byId.get(row.id);
      if (row.status !== 200 || !row.json?.id) {
        return {
          id: row.id,
          name: listing.display_name || row.id,
          displayName: listing.display_name || row.id,
          description: listing.short_description || "",
          shortDescription: listing.short_description || "",
          longDescription: "",
          version: "",
          developer: "",
          category: "",
          capabilities: [],
          websiteUrl: "",
          privacyPolicyUrl: "",
          termsOfServiceUrl: "",
          defaultPrompts: [],
          keywords: listing.keywords || [],
          logoUrl: listing.icon_url || "",
          logoUrlDark: listing.icon_url_dark || "",
          brandColor: "",
          requiresLocalExecutor: Boolean(listing.requires_local_executor),
          sourceUrl: `https://chatgpt.com/plugins/${row.id}`,
          categories: [...(categoryMap.get(row.id) || [])],
          directoryDescription: listing.short_description || "",
          captureStatus: "index-only",
          detailFetchError: `HTTP ${row.status}`,
          mcpUrl: null,
          mcpServers: [],
          skills: [],
          rawListing: listing,
          rawDetail: row.json || null,
        };
      }
      return normalizePlugin(listing, row.json, [...(categoryMap.get(row.id) || [])]);
    });
    plugins.push(...results);
    done += results.length;
    mcpFound += results.filter((plugin) => plugin.mcpUrl).length;
    console.log(
      `details ${done}/${pending.length} catalog=${plugins.length} mcpUrls=${mcpFound}`,
    );
    await savePartial();
  }

  const needAppIds = [];
  const byAppId = new Map();
  for (const plugin of plugins) {
    const appId =
      plugin.canonicalAppId ||
      (plugin.id.startsWith("plugin_asdk_app_")
        ? plugin.id.slice("plugin_".length)
        : null);
    if (!appId) continue;
    if (!byAppId.has(appId)) byAppId.set(appId, []);
    byAppId.get(appId).push(plugin);
    if (!plugin.mcpUrl) needAppIds.push(appId);
  }
  const uniqueAppIds = [...new Set(needAppIds)];
  console.log(`apps/content enrich ${uniqueAppIds.length} app ids`);
  for (let i = 0; i < uniqueAppIds.length; i += 40) {
    const batch = uniqueAppIds.slice(i, i + 40);
    const { status, json } = await fetchAppsContent(page, batch);
    const apps = status === 200 && Array.isArray(json?.apps) ? json.apps : [];
    for (const app of apps) {
      const url = mcpUrlFromApp(app);
      const matches = byAppId.get(app.id) || [];
      for (const plugin of matches) {
        plugin.appsContent = {
          connectorType: app.connector_type || null,
          resource: app.supported_auth?.[0]?.resource || null,
          authorizationUrl: app.supported_auth?.[0]?.authorization_url || null,
          tokenUrl: app.supported_auth?.[0]?.token_url || null,
          website: app.branding?.website || null,
        };
        if (url) {
          plugin.mcpUrl = url;
          if (!plugin.mcpServers.some((server) => server.url === url)) {
            plugin.mcpServers.push({
              key: app.name || app.id,
              type: app.connector_type || "MCP",
              url,
              oauthResource: app.supported_auth?.[0]?.authorization_server_base || null,
            });
          }
        }
      }
    }
    mcpFound = plugins.filter((plugin) => plugin.mcpUrl).length;
    console.log(
      `apps/content ${Math.min(i + batch.length, uniqueAppIds.length)}/${uniqueAppIds.length} mcpUrls=${mcpFound}`,
    );
    await savePartial();
  }

  plugins.sort((a, b) => (a.displayName || a.id).localeCompare(b.displayName || b.id));
  await savePartial();
  await context.storageState({ path: storageState }).catch(() => {});
  await browser.close();
  console.log(`done listed=${ids.length} detailed=${plugins.length} mcpUrls=${mcpFound} -> ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
