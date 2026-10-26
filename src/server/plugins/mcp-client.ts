/**
 * Streamable HTTP MCP client with Bearer authentication.
 *
 * Used by the plugin runtime to discover and invoke tools on a connected
 * plugin's MCP server. Talks JSON-RPC 2.0 over the Streamable HTTP transport
 * (`initialize` → `notifications/initialized` → `tools/list` / `tools/call`),
 * handling both plain JSON and SSE-framed responses.
 *
 * Runs server-side only — browsers cannot call most MCP servers (CORS).
 */

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type McpCallContent = {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
};

export type McpCallResult = {
  content: McpCallContent[];
  isError: boolean;
  structuredContent?: unknown;
};

export type McpClientErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "timeout"
  | "protocol_error"
  | "unavailable";

export type McpClientOutcome<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: McpClientErrorCode;
      message: string;
    };

const PROTOCOL_VERSION = "2025-06-18";
const REQUEST_TIMEOUT_MS = 60_000;
const SESSION_HEADER = "mcp-session-id";

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: number | string;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        return JSON.parse(payload) as JsonRpcResponse;
      } catch {
        // Keep scanning subsequent data lines.
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

type Session = { id: string | null };

async function rpcPost(
  url: string,
  body: unknown,
  accessToken: string,
  session: Session,
): Promise<{ status: number; rpc: JsonRpcResponse | null; sessionId: string | null }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (session.id) headers[SESSION_HEADER] = session.id;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const sessionId = response.headers.get(SESSION_HEADER);
  const rpc = await parseRpcResponse(response);
  return { status: response.status, rpc, sessionId };
}

function mapStatus(status: number): McpClientErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  return "unavailable";
}

/**
 * Establish an MCP session against a remote server. Returns the session id
 * (null for servers that do not use sessions).
 */
async function openSession(
  url: string,
  accessToken: string,
  clientName: string,
): Promise<McpClientOutcome<Session>> {
  const session: Session = { id: null };

  const init = await rpcPost(
    url,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: clientName, version: "1.0.0" },
      },
    },
    accessToken,
    session,
  ).catch(() => null);

  if (!init) return { ok: false, code: "unavailable", message: "Server unreachable." };
  if (init.status === 401 || init.status === 403) {
    return {
      ok: false,
      code: mapStatus(init.status),
      message: "The plugin's server rejected the stored credentials.",
    };
  }
  if (!init.status || init.status >= 400) {
    return {
      ok: false,
      code: mapStatus(init.status),
      message: `Server responded ${init.status}.`,
    };
  }

  session.id = init.sessionId;

  // Some simplified servers skip the handshake and error on `initialize`
  // with METHOD_NOT_FOUND — that is fine, keep going.
  if (init.rpc?.error && init.rpc.error.code !== -32601) {
    return {
      ok: false,
      code: "protocol_error",
      message: init.rpc.error.message ?? "initialize failed.",
    };
  }

  await rpcPost(
    url,
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
    accessToken,
    session,
  ).catch(() => null);

  return { ok: true, value: session };
}

export type McpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
};

export type McpDiscoveredTool = McpToolDefinition & {
  title: string;
  annotations: McpToolAnnotations;
};

export type McpNamedCapability = {
  name: string;
  title: string;
  description: string;
  uri: string | null;
};

export type McpCapabilities = {
  tools: McpDiscoveredTool[];
  resources: McpNamedCapability[];
  prompts: McpNamedCapability[];
};

const MAX_LIST_PAGES = 5;

/** Page through an MCP list method, returning every item under `key`. */
async function listAll(
  url: string,
  accessToken: string,
  session: Session,
  method: string,
  key: string,
): Promise<McpClientOutcome<Record<string, unknown>[]>> {
  const items: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const reply = await rpcPost(
      url,
      {
        jsonrpc: "2.0",
        id: 10 + page,
        method,
        params: cursor ? { cursor } : {},
      },
      accessToken,
      session,
    ).catch(() => null);

    if (!reply) return { ok: false, code: "unavailable", message: "Server unreachable." };
    if (reply.status === 401 || reply.status === 403) {
      return {
        ok: false,
        code: mapStatus(reply.status),
        message: "The plugin's server rejected the stored credentials.",
      };
    }
    if (!reply.status || reply.status >= 400 || reply.rpc?.error) {
      return {
        ok: false,
        code: reply.status === 404 ? "not_found" : "protocol_error",
        message: reply.rpc?.error?.message ?? `Server responded ${reply.status}.`,
      };
    }
    const result = isRecord(reply.rpc?.result) ? reply.rpc.result : null;
    const pageItems = result && Array.isArray(result[key]) ? result[key] : [];
    for (const item of pageItems) if (isRecord(item)) items.push(item);
    cursor = typeof result?.nextCursor === "string" ? result.nextCursor : undefined;
    if (!cursor) break;
  }
  return { ok: true, value: items };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Discover everything a connected MCP server exposes in one session. Tools
 * are required; resources and prompts are optional MCP features, so a server
 * that does not implement them simply returns none.
 */
export async function discoverMcpCapabilities(
  url: string,
  accessToken: string,
): Promise<McpClientOutcome<McpCapabilities>> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error();
  } catch {
    return { ok: false, code: "unavailable", message: "Invalid MCP server URL." };
  }

  const opened = await openSession(url, accessToken, "clauxen");
  if (!opened.ok) return opened;
  const session = opened.value;

  const rawTools = await listAll(url, accessToken, session, "tools/list", "tools");
  if (!rawTools.ok) return rawTools;

  const tools: McpDiscoveredTool[] = [];
  for (const raw of rawTools.value) {
    if (typeof raw.name !== "string" || !raw.name) continue;
    const annotations = isRecord(raw.annotations) ? raw.annotations : {};
    tools.push({
      name: raw.name,
      title: text(raw.title) || text(annotations.title) || raw.name,
      description: text(raw.description),
      inputSchema: isRecord(raw.inputSchema)
        ? (raw.inputSchema as Record<string, unknown>)
        : { type: "object", properties: {} },
      annotations: {
        readOnlyHint:
          typeof annotations.readOnlyHint === "boolean"
            ? annotations.readOnlyHint
            : undefined,
        destructiveHint:
          typeof annotations.destructiveHint === "boolean"
            ? annotations.destructiveHint
            : undefined,
      },
    });
  }

  const [rawResources, rawPrompts] = await Promise.all([
    listAll(url, accessToken, session, "resources/list", "resources"),
    listAll(url, accessToken, session, "prompts/list", "prompts"),
  ]);

  const resources: McpNamedCapability[] = rawResources.ok
    ? rawResources.value
        .filter((raw) => typeof raw.name === "string" || typeof raw.uri === "string")
        .map((raw) => ({
          name: text(raw.name) || text(raw.uri),
          title: text(raw.title) || text(raw.name) || text(raw.uri),
          description: text(raw.description),
          uri: text(raw.uri) || null,
        }))
    : [];

  const prompts: McpNamedCapability[] = rawPrompts.ok
    ? rawPrompts.value
        .filter((raw) => typeof raw.name === "string" && raw.name)
        .map((raw) => ({
          name: text(raw.name),
          title: text(raw.title) || text(raw.name),
          description: text(raw.description),
          uri: null,
        }))
    : [];

  return { ok: true, value: { tools, resources, prompts } };
}

/** Invoke a single tool on a connected MCP server. */
export async function callMcpTool(
  url: string,
  accessToken: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpClientOutcome<McpCallResult>> {
  const opened = await openSession(url, accessToken, "clauxen");
  if (!opened.ok) return opened;
  const session = opened.value;

  const call = await rpcPost(
    url,
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    },
    accessToken,
    session,
  ).catch(() => null);

  if (!call) return { ok: false, code: "unavailable", message: "Server unreachable." };
  if (call.status === 401 || call.status === 403) {
    return {
      ok: false,
      code: mapStatus(call.status),
      message: "The plugin's server rejected the stored credentials.",
    };
  }
  if (!call.status || call.status >= 400) {
    return {
      ok: false,
      code: mapStatus(call.status),
      message: `Tool call failed (${call.status}).`,
    };
  }

  if (call.rpc?.error) {
    return {
      ok: false,
      code: "protocol_error",
      message: call.rpc.error.message ?? "The plugin returned an error.",
    };
  }

  const result = isRecord(call.rpc?.result) ? call.rpc?.result : null;
  const content = Array.isArray(result?.content)
    ? (result.content as McpCallContent[]).filter(isRecord)
    : [];

  return {
    ok: true,
    value: {
      content: content.map((entry) => ({
        type: typeof entry.type === "string" ? entry.type : "text",
        text: typeof entry.text === "string" ? entry.text : undefined,
        data: typeof entry.data === "string" ? entry.data : undefined,
        mimeType: typeof entry.mimeType === "string" ? entry.mimeType : undefined,
      })),
      isError: result?.isError === true,
      structuredContent: result?.structuredContent,
    },
  };
}

/** Flatten an MCP call result to the text the model reads. */
export function mcpResultToText(result: McpCallResult): string {
  const parts: string[] = [];
  for (const item of result.content) {
    if (item.type === "text" && item.text) parts.push(item.text);
    else if (item.type === "image" && item.mimeType) {
      parts.push(`[image: ${item.mimeType}]`);
    }
  }
  if (parts.length === 0 && result.structuredContent !== undefined) {
    try {
      return JSON.stringify(result.structuredContent, null, 2);
    } catch {
      return "The plugin returned a result that could not be rendered.";
    }
  }
  return parts.join("\n");
}
