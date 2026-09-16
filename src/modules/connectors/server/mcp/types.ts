/** MCP server configured via environment (CLAUXEN_MCP_SERVERS). */
export type McpServerConfig = {
  id: string;
  url: string;
  headers: Record<string, string>;
};

export type McpToolDescriptor = {
  /** Tool name as exposed to the model: mcp__<serverId>__<toolName>. */
  qualifiedName: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type McpCallResult = {
  text: string;
  isError: boolean;
};

type Json = Record<string, unknown>;

type McpEnvEntry = {
  id?: unknown;
  name?: unknown;
  url?: unknown;
  headers?: unknown;
  token?: unknown;
  authToken?: unknown;
};

function sanitizeServerId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Parse CLAUXEN_MCP_SERVERS — a JSON array of MCP servers:
 *   [{"id":"notion","url":"https://mcp.notion.com/mcp","token":"..."}]
 * `headers` may be an object of extra HTTP headers; `token`/`authToken` is a
 * shorthand for an Authorization: Bearer header.
 */
export function listMcpServers(): McpServerConfig[] {
  const raw = process.env.CLAUXEN_MCP_SERVERS?.trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: McpServerConfig[] = [];
  for (const entry of parsed as McpEnvEntry[]) {
    if (!entry || typeof entry !== "object") continue;
    const url = typeof entry.url === "string" ? entry.url.trim() : "";
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const idSource =
      (typeof entry.id === "string" && entry.id) ||
      (typeof entry.name === "string" && entry.name) ||
      url;
    const id = sanitizeServerId(idSource);
    if (!id) continue;
    const headers: Record<string, string> = {};
    if (
      entry.headers &&
      typeof entry.headers === "object" &&
      !Array.isArray(entry.headers)
    ) {
      for (const [k, v] of Object.entries(entry.headers as Json)) {
        if (typeof v === "string" && v) headers[k] = v;
      }
    }
    const token =
      typeof entry.token === "string"
        ? entry.token
        : typeof entry.authToken === "string"
          ? entry.authToken
          : undefined;
    if (token && !("authorization" in headers) && !("Authorization" in headers)) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    out.push({ id, url, headers });
  }
  return out;
}
