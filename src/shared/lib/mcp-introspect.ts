/**
 * Minimal MCP client used to introspect remote MCP servers that speak the
 * Streamable HTTP transport: `initialize` → `notifications/initialized` →
 * `tools/list`. Runs only on the server (API routes) — browsers can't call
 * most MCP servers directly (CORS + OAuth).
 */

export type McpToolSummary = {
  name: string;
  description: string;
};

export type McpIntrospectResult =
  | { ok: true; tools: McpToolSummary[] }
  | {
      ok: false;
      error:
        | "invalid-url"
        | "auth-required"
        | "no-tools"
        | "timeout"
        | "unavailable";
      message?: string;
    };

const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: number;
  result?: unknown;
  error?: { code?: number; message?: string };
};

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** Some servers frame JSON-RPC replies as SSE `data:` events. */
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
    signal: AbortSignal.timeout(8_000),
  });
  const rpc = response.ok ? await parseRpcResponse(response) : null;
  return { response, rpc };
}

/**
 * Probe a remote MCP server for its tool list. Never throws — every failure
 * mode maps to a tagged error result the UI can render.
 */
export async function introspectMcpServer(
  rawUrl: string,
): Promise<McpIntrospectResult> {
  const url = rawUrl.trim();
  if (!isHttpUrl(url)) {
    return { ok: false, error: "invalid-url", message: "Not an http(s) URL." };
  }

  try {
    // 1. initialize — establishes the session (session id comes back header).
    const init = await rpcPost(
      url,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "clauxen-plugin-hub", version: "1.0.0" },
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
    if (init.rpc?.error) {
      // Some simplified servers skip the handshake — fall through and try a
      // bare tools/list before giving up.
      if (init.rpc.error.code !== -32601) {
        return {
          ok: false,
          error: "unavailable",
          message: init.rpc.error.message ?? "initialize failed.",
        };
      }
    }

    const sessionId = init.response.headers.get("mcp-session-id");

    // 2. notifications/initialized — required by spec before normal requests.
    if (sessionId) {
      await rpcPost(
        url,
        {
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: {},
        },
        sessionId,
      ).catch(() => null);
    }

    // 3. tools/list — within the established session.
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
          list.rpc?.error?.message ?? `Server responded ${list.response.status}.`,
      };
    }

    const result = list.rpc?.result as { tools?: unknown } | undefined;
    const tools = Array.isArray(result?.tools) ? result.tools : [];
    const summaries: McpToolSummary[] = [];
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
