import { env, requireContextDevApiKey } from "@/server/config/env";

const CONTEXT_DEV_API_BASE = "https://api.context.dev/v1";

export type ContextDevRequest = Record<string, unknown>;
export type ContextDevResponse = Record<string, unknown>;

function requestTimeoutMs(args: ContextDevRequest, fallback: number): number {
  const timeout = args.timeoutOpts;
  if (!timeout || typeof timeout !== "object" || Array.isArray(timeout)) {
    return fallback;
  }
  const milliseconds = (timeout as Record<string, unknown>).milliseconds;
  if (typeof milliseconds !== "number" || !Number.isFinite(milliseconds)) {
    return fallback;
  }
  return Math.max(1_000, Math.min(305_000, milliseconds + 5_000));
}

function errorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.error === "string"
          ? record.error
          : null;
    const code =
      typeof record.error_code === "string" ? record.error_code : null;
    if (message) return code ? `${message} (${code})` : message;
  }
  return `Context.dev request failed (${status}).`;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function contextDevRequest(
  path: string,
  args: ContextDevRequest,
  options: { method: "GET" | "POST"; fallbackTimeoutMs: number },
): Promise<ContextDevResponse> {
  const url = new URL(`${CONTEXT_DEV_API_BASE}${path}`);
  const init: RequestInit = {
    method: options.method,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${requireContextDevApiKey()}`,
    },
    signal: AbortSignal.timeout(
      requestTimeoutMs(args, options.fallbackTimeoutMs),
    ),
  };

  if (options.method === "POST") {
    init.headers = { ...init.headers, "content-type": "application/json" };
    init.body = JSON.stringify(args);
  } else {
    for (const [key, value] of Object.entries(args)) {
      if (value === undefined || value === null) continue;
      if (key === "timeoutOpts" && typeof value === "object") {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (nestedValue !== undefined && nestedValue !== null) {
            url.searchParams.set(
              `timeoutOpts[${nestedKey}]`,
              String(nestedValue),
            );
          }
        }
      } else if (key === "headers" && typeof value === "object") {
        for (const [headerName, headerValue] of Object.entries(value)) {
          url.searchParams.set(headerName, String(headerValue));
        }
      } else if (Array.isArray(value)) {
        url.searchParams.set(key, value.map(String).join(","));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, init);
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(errorMessage(data, response.status));
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Context.dev returned an invalid response.");
  }
  return data as ContextDevResponse;
}

export function searchWebWithContextDev(
  args: ContextDevRequest,
): Promise<ContextDevResponse> {
  return contextDevRequest("/web/search", args, {
    method: "POST",
    fallbackTimeoutMs: 30_000,
  });
}

export function scrapeUrlWithContextDev(
  args: ContextDevRequest,
): Promise<ContextDevResponse> {
  return contextDevRequest("/web/scrape", args, {
    method: "POST",
    fallbackTimeoutMs: 95_000,
  });
}

export function mapUrlsWithContextDev(
  args: ContextDevRequest,
): Promise<ContextDevResponse> {
  return contextDevRequest("/web/urls", args, {
    method: "GET",
    fallbackTimeoutMs: 95_000,
  });
}

export function crawlWebsiteWithContextDev(
  args: ContextDevRequest,
): Promise<ContextDevResponse> {
  return contextDevRequest("/web/crawl", args, {
    method: "POST",
    fallbackTimeoutMs: 115_000,
  });
}

export function isContextDevConfigured(): boolean {
  return Boolean(env.contextDevApiKey);
}
