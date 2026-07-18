#!/usr/bin/env node
/**
 * Inventory every discoverable page under a domain (default: claude.com).
 *
 * Strategy (most complete → least):
 *   1. robots.txt → Sitemap: URLs
 *   2. Recursively parse sitemap index / urlset XML
 *   3. Optional BFS HTML crawl of same-host links (fills gaps sitemaps miss)
 *
 * Usage:
 *   node scripts/list-domain-pages.mjs
 *   node scripts/list-domain-pages.mjs --domain claude.com
 *   node scripts/list-domain-pages.mjs --domain claude.com --crawl --max-pages 500
 *   node scripts/list-domain-pages.mjs --domain claude.com --out ./tmp/claude-pages.json
 *
 * Flags:
 *   --domain <host>     Host to inventory (default: claude.com)
 *   --start <url>       Seed URL (default: https://<domain>/)
 *   --crawl             Also BFS-crawl HTML for internal links
 *   --max-pages <n>     Cap on crawl fetches (default: 300)
 *   --delay <ms>        Delay between crawl requests (default: 250)
 *   --include-assets    Keep .css/.js/.png/etc links (default: pages only)
 *   --include-locales   Keep /de /ja /fr /… localized mirrors (excluded by default)
 *   --main              Main site map only (hubs + product/solutions; no blog/connector detail)
 *   --max-depth <n>     Keep only URLs with path depth ≤ n (e.g. 2 → /a/b)
 *   --out <path>        Write full JSON report (stdout still gets summary)
 *   --json              Print full JSON to stdout instead of the tree
 *   --help              Show this help
 */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const PAGE_EXT_RE =
  /\.(?:css|js|mjs|map|json|xml|txt|ico|png|jpe?g|gif|webp|avif|svg|woff2?|ttf|eot|mp4|webm|mp3|wav|pdf|zip|gz|tar|tgz|br)$/i;

/** ISO 639-1 (+ a few region tags) used as first path segment on marketing sites. */
const LOCALE_SEGMENTS = new Set([
  "ar", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "es", "et", "fa", "fi",
  "fr", "gu", "he", "hi", "hr", "hu", "id", "it", "ja", "kn", "ko", "lt", "lv",
  "ml", "mr", "ms", "nb", "nl", "no", "pl", "pt", "pt-br", "pt-pt", "ro", "ru",
  "sk", "sl", "sr", "sv", "ta", "te", "th", "tr", "uk", "ur", "vi", "zh",
  "zh-cn", "zh-tw", "en-gb", "en-us", "es-es", "es-mx", "fr-ca", "fr-fr",
]);

function printHelp() {
  console.log(`Usage: node scripts/list-domain-pages.mjs [options]

Options:
  --domain <host>      Host to inventory (default: claude.com)
  --start <url>        Seed URL (default: https://<domain>/)
  --crawl              BFS-crawl HTML for internal links
  --max-pages <n>      Max crawl fetches (default: 300)
  --delay <ms>         Delay between crawl requests (default: 250)
  --include-assets     Keep asset URLs (css/js/images/…)
  --include-locales    Keep localized /de /ja /fr /… mirrors (excluded by default)
  --main               Main site map only (hubs + key sections)
  --max-depth <n>      Keep URLs with path depth ≤ n
  --out <path>         Write full JSON report to file
  --json               Print full JSON to stdout
  --help               Show help`);
}

function parseArgs(argv) {
  const args = {
    domain: "claude.com",
    start: null,
    crawl: false,
    maxPages: 300,
    delayMs: 250,
    includeAssets: false,
    includeLocales: false,
    main: false,
    maxDepth: null,
    out: null,
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null || v.startsWith("--")) {
        throw new Error(`Missing value for ${a}`);
      }
      return v;
    };
    switch (a) {
      case "--domain":
        args.domain = next().replace(/^https?:\/\//, "").replace(/\/$/, "");
        break;
      case "--start":
        args.start = next();
        break;
      case "--crawl":
        args.crawl = true;
        break;
      case "--max-pages":
        args.maxPages = Number(next());
        break;
      case "--delay":
        args.delayMs = Number(next());
        break;
      case "--include-assets":
        args.includeAssets = true;
        break;
      case "--include-locales":
        args.includeLocales = true;
        break;
      case "--main":
        args.main = true;
        break;
      case "--max-depth":
        args.maxDepth = Number(next());
        break;
      case "--out":
        args.out = next();
        break;
      case "--json":
        args.json = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown flag: ${a}`);
    }
  }

  if (!Number.isFinite(args.maxPages) || args.maxPages < 1) {
    throw new Error("--max-pages must be a positive number");
  }
  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) {
    throw new Error("--delay must be >= 0");
  }
  if (args.maxDepth != null && (!Number.isFinite(args.maxDepth) || args.maxDepth < 0)) {
    throw new Error("--max-depth must be >= 0");
  }

  args.start = args.start || `https://${args.domain}/`;
  return args;
}

function normalizeHost(host) {
  return String(host || "")
    .toLowerCase()
    .replace(/^www\./, "");
}

function hostsMatch(a, b) {
  return normalizeHost(a) === normalizeHost(b);
}

function isSameSite(url, rootHost) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return hostsMatch(u.hostname, rootHost);
  } catch {
    return false;
  }
}

function isLocalizedPath(pathname) {
  const first = String(pathname || "")
    .split("/")
    .filter(Boolean)[0]
    ?.toLowerCase();
  return Boolean(first && LOCALE_SEGMENTS.has(first));
}

/** Strip hash/query noise; collapse trailing slash except root. */
function canonicalizeUrl(raw, { includeAssets, includeLocales }) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  u.hash = "";
  // Drop tracking params commonly found on marketing sites
  for (const key of [...u.searchParams.keys()]) {
    if (
      /^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(key) ||
      key.toLowerCase() === "utm_source"
    ) {
      u.searchParams.delete(key);
    }
  }

  // Prefer https
  if (u.protocol === "http:") u.protocol = "https:";

  // Normalize www
  if (u.hostname.startsWith("www.")) {
    u.hostname = u.hostname.slice(4);
  }

  let path = u.pathname || "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  u.pathname = path;

  if (!includeLocales && isLocalizedPath(path)) return null;

  if (!includeAssets) {
    const last = path.split("/").pop() || "";
    if (PAGE_EXT_RE.test(last)) return null;
  }

  return u.toString();
}

async function fetchText(url, { timeoutMs = 20_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
                    headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      contentType: res.headers.get("content-type") || "",
      text,
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) {
    locs.push(m[1].trim());
  }
  return locs;
}

function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(xml);
}

async function collectFromSitemaps(seedUrls, rootHost, { includeAssets, includeLocales }) {
  const queue = [...seedUrls];
  const seenSitemaps = new Set();
  const pages = new Map(); // url -> { source }
  const errors = [];

  while (queue.length) {
    const smUrl = queue.shift();
    if (!smUrl || seenSitemaps.has(smUrl)) continue;
    seenSitemaps.add(smUrl);

    let res;
    try {
      res = await fetchText(smUrl);
    } catch (err) {
      errors.push({ url: smUrl, error: String(err?.message || err) });
      continue;
    }

    if (!res.ok) {
      errors.push({ url: smUrl, error: `HTTP ${res.status}` });
      continue;
    }

    const locs = extractLocs(res.text);
    if (isSitemapIndex(res.text)) {
      for (const loc of locs) {
        if (!seenSitemaps.has(loc)) queue.push(loc);
      }
      continue;
    }

    for (const loc of locs) {
      if (!isSameSite(loc, rootHost)) continue;
      const canon = canonicalizeUrl(loc, { includeAssets, includeLocales });
      if (!canon) continue;
      if (!pages.has(canon)) {
        pages.set(canon, { source: "sitemap", via: smUrl });
      }
    }
  }

  return { pages, sitemaps: [...seenSitemaps], errors };
}

async function readRobotsSitemaps(origin) {
  const robotsUrl = `${origin}/robots.txt`;
  const sitemaps = [];
  const errors = [];
  try {
    const res = await fetchText(robotsUrl);
    if (!res.ok) {
      errors.push({ url: robotsUrl, error: `HTTP ${res.status}` });
      return { sitemaps, errors, robotsText: null };
    }
    for (const line of res.text.split(/\r?\n/)) {
      const sm = line.match(/^\s*Sitemap:\s*(\S+)/i);
      if (sm) sitemaps.push(sm[1].trim());

      // chatgpt.com lists sitemaps via Allow: /marketing-sitemap.xml (no Sitemap: directive)
      const allow = line.match(/^\s*Allow:\s*(\/\S*sitemap[^.\s]*\.xml)\s*$/i);
      if (allow) {
        try {
          sitemaps.push(new URL(allow[1], origin).toString());
        } catch {
          // ignore
        }
      }
    }
    return { sitemaps, errors, robotsText: res.text };
  } catch (err) {
    errors.push({ url: robotsUrl, error: String(err?.message || err) });
    return { sitemaps, errors, robotsText: null };
  }
}

function loadSeedUrls(domain) {
  const candidates = [
    join(SCRIPT_DIR, `${domain}-main-seeds.txt`),
    join(SCRIPT_DIR, `${domain}-seeds.txt`),
  ];
  const urls = [];
  for (const file of candidates) {
    try {
      const text = readFileSync(file, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        urls.push(t);
      }
    } catch {
      // optional seed file
    }
  }
  return urls;
}

function extractHtmlLinks(html, baseUrl) {
  const out = [];
  const re = /(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (!raw || raw.startsWith("javascript:") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("data:")) {
      continue;
    }
    try {
      out.push(new URL(raw, baseUrl).toString());
    } catch {
      // ignore bad URLs
    }
  }
  return out;
}

async function bfsCrawl({
  startUrl,
  rootHost,
  maxPages,
  delayMs,
  includeAssets,
  includeLocales,
  knownPages,
}) {
  const queue = [startUrl];
  const fetched = new Set();
  const discovered = new Map(knownPages); // url -> meta
  const errors = [];
  let fetches = 0;

  while (queue.length && fetches < maxPages) {
    const next = queue.shift();
    const canon = canonicalizeUrl(next, { includeAssets: true, includeLocales });
    if (!canon || fetched.has(canon)) continue;
    if (!isSameSite(canon, rootHost)) continue;

    // Skip obvious assets during crawl fetches
    try {
      const path = new URL(canon).pathname;
      const last = path.split("/").pop() || "";
      if (PAGE_EXT_RE.test(last)) continue;
    } catch {
      continue;
    }

    fetched.add(canon);
    fetches += 1;

    if (delayMs > 0 && fetches > 1) await sleep(delayMs);

    let res;
    try {
      res = await fetchText(canon);
    } catch (err) {
      errors.push({ url: canon, error: String(err?.message || err) });
      continue;
    }

    const pageCanon = canonicalizeUrl(res.finalUrl || canon, {
      includeAssets,
      includeLocales,
    });
    if (pageCanon && isSameSite(pageCanon, rootHost)) {
      const prev = discovered.get(pageCanon);
      if (!prev) {
        discovered.set(pageCanon, {
          source: "crawl",
          status: res.status,
          contentType: res.contentType,
        });
      } else if (prev.source === "sitemap") {
        discovered.set(pageCanon, {
          ...prev,
          crawlStatus: res.status,
          contentType: res.contentType,
        });
      }
    }

    if (!res.ok) {
      errors.push({ url: canon, error: `HTTP ${res.status}` });
      continue;
    }
    if (!/text\/html/i.test(res.contentType) && !/<html[\s>]/i.test(res.text.slice(0, 2000))) {
      continue;
    }

    for (const link of extractHtmlLinks(res.text, res.finalUrl || canon)) {
      if (!isSameSite(link, rootHost)) continue;
      const linkCanon = canonicalizeUrl(link, { includeAssets, includeLocales });
      if (!linkCanon) continue;
      if (!discovered.has(linkCanon)) {
        discovered.set(linkCanon, { source: "crawl-link", via: pageCanon || canon });
        queue.push(linkCanon);
      } else if (!fetched.has(linkCanon)) {
        queue.push(linkCanon);
      }
    }
  }

  return {
    pages: discovered,
    fetches,
    queuedRemaining: queue.length,
    errors,
  };
}

function pathDepth(url) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.length;
  } catch {
    return 0;
  }
}

/** Catalog sections: keep the hub only, drop individual detail pages. */
const MAIN_HUB_ONLY = new Set([
  "blog",
  "docs",
  "connectors",
  "plugins",
  "customers",
  "code-with-claude",
  "contact-sales",
]);

/** Sections where depth-2 pages are still "main" product surface. */
const MAIN_SECTION_KEEP = new Set([
  "product",
  "solutions",
  "platform",
  "partners",
  "programs",
  "community",
  "resources",
  "lp",
  "form",
  "blog-category",
  "blog-product",
  "blog-usecases",
]);

function isMainPage(url) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts.length === 0) return true; // homepage
    if (parts.length === 1) return true; // top-level: /pricing, /download, …
    const [section] = parts;
    if (MAIN_HUB_ONLY.has(section)) return parts.length === 1;
    if (MAIN_SECTION_KEEP.has(section)) return parts.length <= 2;
    // Unknown section: keep shallow pages only
    return parts.length <= 2;
  } catch {
    return false;
  }
}

function keepUrl(url, { main, maxDepth }) {
  if (maxDepth != null && pathDepth(url) > maxDepth) return false;
  if (main && !isMainPage(url)) return false;
  return true;
}

function groupByTopSegment(urls) {
  const groups = new Map();
  for (const url of urls) {
    let key = "(root)";
    try {
      const parts = new URL(url).pathname.split("/").filter(Boolean);
      key = parts[0] ? `/${parts[0]}` : "(root)";
    } catch {
      key = "(invalid)";
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(url);
  }
  for (const list of groups.values()) list.sort();
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function printTree(urls) {
  const groups = groupByTopSegment(urls);
  for (const [segment, list] of groups) {
    console.log(`\n${segment}  (${list.length})`);
    for (const u of list) {
      console.log(`  ${u}`);
    }
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(String(err?.message || err));
    printHelp();
    process.exit(1);
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const rootHost = args.domain;
  const origin = `https://${rootHost}`;
  const allErrors = [];

  console.error(`Domain: ${rootHost}`);
  console.error(`Seed:   ${args.start}`);
  console.error(
    `Mode:   sitemap${args.crawl ? " + crawl" : ""} | locales ${args.includeLocales ? "included" : "excluded"}${args.main ? " | main-only" : ""}${args.maxDepth != null ? ` | max-depth ${args.maxDepth}` : ""}`,
  );

  // 1) robots.txt
  console.error("\n[1/3] Reading robots.txt …");
  const robots = await readRobotsSitemaps(origin);
  allErrors.push(...robots.errors);

  const sitemapSeeds = [
    ...robots.sitemaps,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ];
  // de-dupe
  const uniqueSeeds = [...new Set(sitemapSeeds)];

  // 2) sitemaps
  console.error(`[2/3] Fetching sitemaps (${uniqueSeeds.length} seeds) …`);
  const sm = await collectFromSitemaps(uniqueSeeds, rootHost, {
    includeAssets: args.includeAssets,
    includeLocales: args.includeLocales,
  });
  allErrors.push(...sm.errors);
  console.error(
    `       Found ${sm.pages.size} URLs from ${sm.sitemaps.length} sitemap file(s)`,
  );

  let pages = sm.pages;
  const sitemapUrlCount = sm.pages.size;
  let crawlMeta = null;

  // Seed URLs (used when sitemaps are blocked, e.g. chatgpt.com Cloudflare 403)
  const seedUrls = loadSeedUrls(rootHost);
  let seedHits = 0;
  for (const raw of seedUrls) {
    if (!isSameSite(raw, rootHost)) continue;
    const canon = canonicalizeUrl(raw, {
      includeAssets: args.includeAssets,
      includeLocales: args.includeLocales,
    });
    if (!canon) continue;
    if (!pages.has(canon)) {
      pages.set(canon, { source: "seed-file" });
      seedHits += 1;
    }
  }
  if (seedUrls.length) {
    console.error(
      `       Seed file(s): ${seedUrls.length} entries → +${seedHits} new URLs (total ${pages.size})`,
    );
  }

  // 3) optional HTML crawl
  if (args.crawl) {
    console.error(`[3/3] BFS crawl (max ${args.maxPages}, delay ${args.delayMs}ms) …`);
    const crawl = await bfsCrawl({
      startUrl: args.start,
      rootHost,
      maxPages: args.maxPages,
      delayMs: args.delayMs,
      includeAssets: args.includeAssets,
      includeLocales: args.includeLocales,
      knownPages: pages,
    });
    pages = crawl.pages;
    crawlMeta = {
      fetches: crawl.fetches,
      queuedRemaining: crawl.queuedRemaining,
    };
    allErrors.push(...crawl.errors);
    console.error(
      `       After crawl: ${pages.size} unique URLs (${crawl.fetches} fetches, ${crawl.queuedRemaining} still queued)`,
    );
  } else {
    console.error("[3/3] Crawl skipped (pass --crawl to enable)");
  }

  // Always ensure homepage is present
  const home = canonicalizeUrl(args.start, {
    includeAssets: args.includeAssets,
    includeLocales: args.includeLocales,
  });
  if (home && !pages.has(home)) {
    pages.set(home, { source: "seed" });
  }

  const urls = [...pages.keys()]
    .filter((url) => keepUrl(url, { main: args.main, maxDepth: args.maxDepth }))
    .sort((a, b) => {
      const da = pathDepth(a);
      const db = pathDepth(b);
      if (da !== db) return da - db;
      return a.localeCompare(b);
    });

  const kept = new Set(urls);
  for (const url of [...pages.keys()]) {
    if (!kept.has(url)) pages.delete(url);
  }

  const bySource = {};
  for (const meta of pages.values()) {
    const s = meta.source || "unknown";
    bySource[s] = (bySource[s] || 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    domain: rootHost,
    start: args.start,
    includeLocales: args.includeLocales,
    main: args.main,
    maxDepth: args.maxDepth,
    totals: {
      uniquePages: urls.length,
      sitemapsParsed: sm.sitemaps.length,
      bySource,
      errors: allErrors.length,
    },
    crawl: crawlMeta,
    robotsSitemaps: robots.sitemaps,
    sitemapsParsed: sm.sitemaps,
    pages: urls.map((url) => ({ url, ...pages.get(url) })),
    errors: allErrors,
  };

  if (args.out) {
    const outPath = resolve(args.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    console.error(`\nWrote report → ${outPath}`);
  }

  // Always write a plain link list beside this script for --main inventories
  if (args.main) {
    const safeHost = rootHost.replace(/[^a-z0-9.-]+/gi, "-");
    const linksPath = join(SCRIPT_DIR, `${safeHost}-main-pages.txt`);
    const notes = [];
    if (sitemapUrlCount === 0 && seedHits > 0) {
      notes.push(
        `# note: live sitemaps were blocked for this host; list built from scripts/${safeHost}-main-seeds.txt`,
      );
    }
    const header = [
      `# ${rootHost} — main English page links (locales + catalog detail excluded)`,
      ...notes,
      `# generated: ${report.generatedAt}`,
      `# count: ${urls.length}`,
      `# regenerate: node scripts/list-domain-pages.mjs --domain ${rootHost} --main`,
      "",
    ].join("\n");
    writeFileSync(linksPath, header + urls.join("\n") + "\n", "utf8");
    console.error(`Wrote links  → ${linksPath}`);
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n=== ${rootHost} — ${urls.length} unique pages ===`);
    printTree(urls);
    console.log(`\n--- summary ---`);
    console.log(`unique pages:   ${urls.length}`);
    console.log(`sitemaps:       ${sm.sitemaps.length}`);
    console.log(`by source:      ${JSON.stringify(bySource)}`);
    if (crawlMeta) {
      console.log(`crawl fetches:  ${crawlMeta.fetches}`);
      console.log(`still queued:   ${crawlMeta.queuedRemaining}`);
    }
    if (allErrors.length) {
      console.log(`errors:         ${allErrors.length} (see --out / --json for details)`);
    }
    console.log(`\nTip: re-run with --crawl for pages missing from sitemaps.`);
    console.log(`     node scripts/list-domain-pages.mjs --domain ${rootHost} --crawl --out ./tmp/${rootHost}-pages.json`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
