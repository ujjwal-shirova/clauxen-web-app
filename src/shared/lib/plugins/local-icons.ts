/**
 * Local plugin artwork extracted from history (`public/assets/plugins`).
 *
 * The 1,977-entry verified MCP catalog ships with remote `files.openai.com`
 * artwork. For the curated subset we bundle locally, prefer the same-origin
 * `/assets/plugins/<slug>.png` file: faster, cacheable, and immune to remote
 * CDN expiry. Everything else falls back to the catalog URL, then to a
 * letter avatar in `PluginArtwork`.
 *
 * Slug algorithm matches the original `pluginIconPath` helper so history
 * stays the source of truth for file names.
 */

const LOCAL_ICON_SLUGS = new Set([
  "academic-writing-toolkit",
  "acumen-by-talarion",
  "ahrefs",
  "alpaca",
  "apollo-io",
  "apple-music",
  "ask-tarot-cards",
  "astro-scope-astrology",
  "atlassian-rovo",
  "attio",
  "b12-website-generator",
  "background-music",
  "base44",
  "bigquery",
  "binance",
  "biohub-esm",
  "bitdefender",
  "caliber",
  "caloriecam",
  "calorie-tracker",
  "canva",
  "caveman-mode",
  "chessy",
  "cloudflare",
  "codex-security",
  "consensus",
  "context7",
  "coros",
  "coupler-io",
  "data-analytics",
  "datadog-preview",
  "default-templates",
  "devpost-hackathons",
  "documents",
  "edreams",
  "elicit",
  "etsy",
  "exa",
  "expedia",
  "factset-ai-ready-data",
  "figma",
  "fireflies",
  "fitness-ai-connector",
  "flight-network",
  "flixor",
  "foreflight-mobile",
  "freddy",
  "github",
  "gmail",
  "google-calendar",
  "google-drive",
  "granola",
  "health",
  "hex",
  "heygen",
  "higgsfield",
  "homey",
  "hostinger-mail",
  "hubspot",
  "hugging-face",
  "idealista",
  "indeed",
  "interactive-brokers-ibkr",
  "komoot",
  "linear",
  "linkedin",
  "longbridge",
  "magnific",
  "mailopoly-inbox",
  "malwarebytes",
  "mcp-precheck",
  "metorik",
  "metricool-for-social-media",
  "mixpanel-headless",
  "mixpanel",
  "mobbin",
  "monday-com",
  "motherduck",
  "myfitnesspal",
  "neon-postgres",
  "nightvision",
  "nopressure",
  "notion",
  "openai-certified",
  "otter-ai",
  "outlook-calendar",
  "outlook-email",
  "pdf",
  "pitchbook",
  "plaud",
  "playbookux",
  "plugin-management",
  "podcast-app",
  "posthog",
  "presentations",
  "privacyhawk",
  "product-design",
  "public-equity-investing",
  "quartr",
  "radar-lite",
  "razorpay",
  "readwise",
  "resend",
  "runway",
  "scispace",
  "scite",
  "shazam",
  "shopify",
  "sider-scholar",
  "skill-risk-check",
  "skyscanner",
  "slack",
  "smart-chess-train-learn-to-win",
  "spotify",
  "spreadsheets",
  "steer-astro",
  "stripe",
  "supabase",
  "superhuman-mail",
  "tarot",
  "teams",
  "template-creator",
  "textmagic",
  "tredict",
  "trip-com",
  "trivago",
  "undermind",
  "vanta",
  "vercel",
  "webflow",
  "wikiloc",
  "zoho-crm",
  "zoom",
  "zoominfo",
]);

export function pluginNameToSlug(name: string): string {
  return (name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function localPluginIconPath(name: string): string | null {
  const slug = pluginNameToSlug(name);
  if (!slug || !LOCAL_ICON_SLUGS.has(slug)) return null;
  return `/assets/plugins/${slug}.png`;
}

/**
 * Prefer a bundled icon when the plugin name matches one, otherwise keep the
 * catalog-provided remote URL. Accepts both displayName and internal name so
 * renames still resolve.
 */
export function resolvePluginLogo(input: {
  displayName?: string | null;
  name?: string | null;
  logoUrl?: string | null;
}): string {
  const displayHit = input.displayName
    ? localPluginIconPath(input.displayName)
    : null;
  if (displayHit) return displayHit;
  const nameHit = input.name ? localPluginIconPath(input.name) : null;
  if (nameHit) return nameHit;
  return input.logoUrl || "";
}
