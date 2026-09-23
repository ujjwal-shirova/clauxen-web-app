/** Header Google and Bing honor only after they are allowed to fetch the response. */
export const SHARE_ROBOTS_TAG =
  "noindex, nofollow, noarchive, nosnippet, noimageindex";

export const SHARE_TURNSTILE_ACTION = "share_open";

/** Cloudflare's published always-pass test widget. Local development only. */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

export type SharedChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type SharedChatSnapshot = {
  title: string;
  capturedAt: string;
  messages: SharedChatMessage[];
};

const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

const AUTOMATED_AGENTS = [
  "googlebot",
  "google-extended",
  "storebot-google",
  "bingbot",
  "bingpreview",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "applebot",
  "facebookexternalhit",
  "twitterbot",
  "slackbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "discordbot",
  "redditbot",
  "pinterestbot",
  "embedly",
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "claudebot",
  "claude-searchbot",
  "anthropic-ai",
  "ccbot",
  "bytespider",
  "amazonbot",
  "petalbot",
  "semrushbot",
  "ahrefsbot",
  "mj12bot",
  "dotbot",
  "ia_archiver",
  "archive.org_bot",
  "wget/",
  "curl/",
  "python-requests",
  "go-http-client",
  "headlesschrome",
  "phantomjs",
  "scrapy",
];

export function isShareToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

/** Known crawlers and preview fetchers. A normal browser does not match. */
export function isAutomatedShareAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return false;
  return AUTOMATED_AGENTS.some((name) => ua.includes(name));
}

export function isAllowedShareHostname(
  hostname: string,
  options: { allowLocal: boolean; extraHosts?: string[] },
): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return options.allowLocal;
  if (host === "clauxen.com" || host === "www.clauxen.com") return true;
  if (host.endsWith(".vercel.app") && !host.endsWith("..vercel.app")) {
    return true;
  }
  return (options.extraHosts ?? []).some((extra) => extra.toLowerCase() === host);
}

export function parseShareSnapshot(value: unknown): SharedChatSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string") return null;
  if (typeof record.capturedAt !== "string") return null;
  if (!Array.isArray(record.messages)) return null;
  const messages: SharedChatMessage[] = [];
  for (const item of record.messages) {
    if (!item || typeof item !== "object") return null;
    const message = item as Record<string, unknown>;
    if (typeof message.id !== "string" || typeof message.content !== "string") {
      return null;
    }
    if (message.role !== "user" && message.role !== "assistant") return null;
    if (typeof message.createdAt !== "string") return null;
    messages.push({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    });
  }
  return {
    title: record.title,
    capturedAt: record.capturedAt,
    messages,
  };
}
