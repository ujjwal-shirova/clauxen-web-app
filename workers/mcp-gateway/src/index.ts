/**
 * Clauxen MCP Gateway — Cloudflare Worker backend for the Plugins pages.
 *
 * Serves the scraped plugin/MCP dataset out of R2 and proxies live MCP
 * tool discovery (`initialize` → `tools/list`) that browsers can't perform
 * directly (CORS + OAuth on most MCP servers).
 *
 * Routes:
 *   GET /v0/plugins                      — full dataset JSON (from R2)
 *   GET /v0/plugins/search?q=&category=  — filtered plugin list
 *   GET /v0/mcp/tools?url=<mcp-server>   — live MCP tool introspection
 *
 * Setup:
 *   npx wrangler login
 *   npx wrangler r2 bucket create clauxen-plugin-data
 *   npx wrangler r2 object put clauxen-plugin-data/mcp-plugins.json \
 *     --file ../../public/data/mcp-plugins.json
 *   npm run deploy
 */

export interface Env {
  PLUGIN_DATA: R2Bucket;
  ALLOWED_ORIGINS: string;
}

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: number;
  result?: unknown;
  error?: { code?: number; message?: string };
};

type ToolSummary = { name: string; description: string };

const PROTOCOL_VERSION = "2025-06-18";
const SUCCESS_TTL_MS = 10 * 60 * 1000;
const FAILURE_TTL_MS = 40 * 60 * 1000;
const PROBE_TIMEOUT_MS = 8_000;

const toolsCache = new Map<
  string,
  { expiresAt: number; payload: unknown }
>();

function corsHeaders(
  request: Request,
  allowedOrigins: string,
): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = allowedOrigins
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const headers: Record<string, string> = {
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
  if (allowed.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "Origin";
  }
  return headers;
}

function jsonResponse(
  request: Request,
  env: Env,
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      ...corsHeaders(request, env.ALLOWED_ORIGINS),
      ...init.headers,
    },
  });
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

async function parseRpcResponse(
  response: Response,
): Promise<JsonRpcResponse | null> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!text) return null;
  if (contentType.includes("text/event-stream")) {
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const payload = trimmed.slice(5).trim();
        if (payload && payload !== "[DONE]") {
          try {
            return JSON.parse(payload) as JsonRpcResponse;
          } catch {
            // Keep scanning subsequent data lines.
          }
        }
      }
    }
    return null;
  }
  try {
    return JSON.parse(text) as JsonRpcResponse;
  } catch {
    return null;
  }
}

async function rpcPost(
  url: string,
  body: unknown,
  sessionId: string | null,
): Promise<{ response: Response; rpc: JsonRpcResponse | null }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  const rpc = response.ok ? await parseRpcResponse(response) : null;
  return { response, rpc };
}

async function introspectMcpServer(rawUrl: string): Promise<unknown> {
  const url = rawUrl.trim();
  if (!isHttpUrl(url)) {
    return {
      ok: false,
      error: "invalid-url",
      message: "Not an http(s) URL.",
    };
  }

  try {
    const init = await rpcPost(
      url,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "clauxen-mcp-gateway", version: "1.0.0" },
        },
      },
      null,
    );
    if (init.response.status === 401 || init.response.status === 403) {
      return { ok: false, error: "auth-required" };
    }
    if (!init.response.ok) {
      return {
        ok: false,
        error: "unavailable",
        message: `Server responded ${init.response.status}.`,
      };
    }

    const sessionId = init.response.headers.get("mcp-session-id");
    if (sessionId) {
      await rpcPost(
        url,
        { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
        sessionId,
      ).catch(() => null);
    }

    const list = await rpcPost(
      url,
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      sessionId,
    );
    if (list.response.status === 401 || list.response.status === 403) {
      return { ok: false, error: "auth-required" };
    }
    if (!list.response.ok || list.rpc?.error) {
      return {
        ok: false,
        error: "unavailable",
        message:
          list.rpc?.error?.message ??
          `Server responded ${list.response.status}.`,
      };
    }

    const result = list.rpc?.result as { tools?: unknown } | undefined;
    const tools = Array.isArray(result?.tools) ? result.tools : [];
    const summaries: ToolSummary[] = [];
    for (const tool of tools) {
      if (
        typeof tool === "object" &&
        tool !== null &&
        typeof (tool as { name?: unknown }).name === "string"
      ) {
        summaries.push({
          name: (tool as { name: string }).name,
          description:
            typeof (tool as { description?: unknown }).description === "string"
              ? (tool as { description: string }).description
              : "",
        });
      }
    }
    if (summaries.length === 0) {
      return { ok: false, error: "no-tools" };
    }
    return { ok: true, tools: summaries };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected introspect error.";
    if (/timeout|abort/i.test(message)) {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: "unavailable", message };
  }
}

function normalizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env.ALLOWED_ORIGINS),
      });
    }

    // Full dataset from R2.
    if (request.method === "GET" && path === "/v0/plugins") {
      const object = await env.PLUGIN_DATA.get("mcp-plugins.json");
      if (!object) {
        return jsonResponse(
          request,
          env,
          { error: "dataset not uploaded" },
          { status: 404 },
        );
      }
      return new Response(object.body, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=3600",
          ...corsHeaders(request, env.ALLOWED_ORIGINS),
        },
      });
    }

    // Search/filter over the dataset.
    if (request.method === "GET" && path === "/v0/plugins/search") {
      const object = await env.PLUGIN_DATA.get("mcp-plugins.json");
      if (!object) {
        return jsonResponse(
          request,
          env,
          { error: "dataset not uploaded" },
          { status: 404 },
        );
      }
      const dataset = (await object.json()) as {
        plugins?: Array<Record<string, unknown>>;
      };
      const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const category = (url.searchParams.get("category") ?? "")
        .trim()
        .toUpperCase();
      const plugins = (dataset.plugins ?? []).filter((plugin) => {
        if (category) {
          const categories = Array.isArray(plugin.curatedCategories)
            ? (plugin.curatedCategories as string[])
            : [];
          if (!categories.includes(category)) return false;
        }
        if (query) {
          const haystack = [plugin.name, plugin.displayName, plugin.description]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      });
      return jsonResponse(request, env, { count: plugins.length, plugins });
    }

    // Live MCP tool introspection.
    if (request.method === "GET" && path === "/v0/mcp/tools") {
      const target = url.searchParams.get("url")?.trim() ?? "";
      const cached = toolsCache.get(target);
      if (cached && cached.expiresAt > Date.now()) {
        return jsonResponse(request, env, cached.payload);
      }
      const result = await introspectMcpServer(target);
      toolsCache.set(target, {
        payload: result,
        expiresAt:
          Date.now() +
          ((result as { ok?: boolean }).ok ? SUCCESS_TTL_MS : FAILURE_TTL_MS),
      });
      return jsonResponse(request, env, result);
    }

    if (request.method === "GET" && path === "/v0/health") {
      return jsonResponse(request, env, { ok: true });
    }

    return jsonResponse(request, env, { error: "not found" }, { status: 404 });
  },
};
