type Json = Record<string, unknown>;

const PROTOCOL_VERSION = "2025-03-26";
const REQUEST_TIMEOUT_MS = 20_000;

export type McpHttpTool = {
  name: string;
  description: string;
  inputSchema: Json;
};

export type McpPrompt = {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
};

function parseWwwAuthenticate(header: string | null): string | null {
  if (!header) return null;
  const quoted = /resource_metadata\s*=\s*"([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const bare = /resource_metadata\s*=\s*([^,\s]+)/i.exec(header);
  return bare?.[1]?.replace(/;$/, "") ?? null;
}

async function parseRpc(response: Response): Promise<Json | null> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!text) return null;
  if (contentType.includes("text/event-stream")) {
    for (const chunk of text.split("\n\n")) {
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;
      try {
        const parsed = JSON.parse(payload) as Json;
        if (parsed && (parsed.result !== undefined || parsed.error)) return parsed;
      } catch {
        continue;
      }
    }
    return null;
  }
  try {
    return JSON.parse(text) as Json;
  } catch {
    return null;
  }
}

export class WorkerMcpClient {
  private sessionId: string | null = null;
  private nextId = 1;
  private initialized = false;

  constructor(
    private readonly url: string,
    private readonly accessToken?: string | null,
  ) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": PROTOCOL_VERSION,
      "user-agent": "Clauxen-Connector-Gateway/1.0",
    };
    if (this.accessToken) {
      headers.authorization = `Bearer ${this.accessToken}`;
    }
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;
    return headers;
  }

  private async post(payload: Json): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) this.sessionId = sessionId;
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async probe(): Promise<{
    status: number;
    authorized: boolean;
    resourceMetadataUrl: string | null;
  }> {
    const response = await this.post({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "clauxen", version: "1.0.0" },
      },
    });
    const resourceMetadataUrl =
      parseWwwAuthenticate(response.headers.get("www-authenticate")) ??
      parseWwwAuthenticate(response.headers.get("WWW-Authenticate"));
    if (response.status === 401 || response.status === 403) {
      return { status: response.status, authorized: false, resourceMetadataUrl };
    }
    if (!response.ok) {
      const body = await parseRpc(response);
      const message =
        (body?.error as { message?: string } | undefined)?.message ??
        `HTTP ${response.status}`;
      throw new Error(`MCP initialize failed: ${message}`);
    }
    const parsed = await parseRpc(response);
    if (parsed?.error) {
      throw new Error(
        `MCP initialize rejected: ${String((parsed.error as { message?: string }).message ?? "unknown error")}`,
      );
    }
    this.initialized = true;
    await this.post({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    return {
      status: response.status,
      authorized: true,
      resourceMetadataUrl,
    };
  }

  private async request(method: string, params: Json = {}): Promise<Json> {
    if (!this.initialized) {
      const probe = await this.probe();
      if (!probe.authorized) {
        throw new Error("MCP authorization is required.");
      }
    }
    const response = await this.post({
      jsonrpc: "2.0",
      id: this.nextId++,
      method,
      params,
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error("MCP authorization is required.");
    }
    if (!response.ok) {
      throw new Error(`MCP ${method} failed: HTTP ${response.status}`);
    }
    const parsed = await parseRpc(response);
    if (parsed?.error) {
      throw new Error(
        `MCP ${method} rejected: ${String((parsed.error as { message?: string }).message ?? "unknown error")}`,
      );
    }
    return (parsed?.result as Json) ?? {};
  }

  async listTools(): Promise<McpHttpTool[]> {
    const tools: McpHttpTool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const result = await this.request("tools/list", cursor ? { cursor } : {});
      const pageTools = Array.isArray(result.tools) ? (result.tools as Json[]) : [];
      for (const tool of pageTools) {
        const name = typeof tool.name === "string" ? tool.name : "";
        if (!name) continue;
        tools.push({
          name,
          description: typeof tool.description === "string" ? tool.description : "",
          inputSchema:
            tool.inputSchema && typeof tool.inputSchema === "object"
              ? (tool.inputSchema as Json)
              : { type: "object", properties: {} },
        });
      }
      cursor =
        typeof result.nextCursor === "string" ? result.nextCursor : undefined;
      if (!cursor) break;
    }
    return tools;
  }

  async listPrompts(): Promise<McpPrompt[]> {
    try {
      const result = await this.request("prompts/list");
      const prompts = Array.isArray(result.prompts)
        ? (result.prompts as Json[])
        : [];
      return prompts
        .map((prompt) => ({
          name: typeof prompt.name === "string" ? prompt.name : "",
          description:
            typeof prompt.description === "string" ? prompt.description : "",
          arguments: Array.isArray(prompt.arguments)
            ? (prompt.arguments as Json[])
                .map((item) => ({
                  name: typeof item.name === "string" ? item.name : "",
                  description:
                    typeof item.description === "string"
                      ? item.description
                      : undefined,
                  required: item.required === true,
                }))
                .filter((item) => item.name)
            : undefined,
        }))
        .filter((prompt) => prompt.name);
    } catch {
      return [];
    }
  }

  async getPrompt(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<{ text: string; isError: boolean }> {
    const result = await this.request("prompts/get", {
      name,
      arguments: args,
    });
    const parts: string[] = [];
    const description =
      typeof result.description === "string" ? result.description : "";
    if (description) parts.push(description);
    const messages = Array.isArray(result.messages)
      ? (result.messages as Json[])
      : [];
    for (const message of messages) {
      const role = typeof message.role === "string" ? message.role : "user";
      const content = message.content;
      if (typeof content === "string") {
        parts.push(`${role}: ${content}`);
        continue;
      }
      if (content && typeof content === "object") {
        const block = content as Json;
        if (typeof block.text === "string") {
          parts.push(`${role}: ${block.text}`);
        } else {
          parts.push(`${role}: ${JSON.stringify(content)}`);
        }
      }
    }
    return { text: parts.join("\n\n") || "(empty skill)", isError: false };
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ text: string; isError: boolean }> {
    const result = await this.request("tools/call", { name, arguments: args });
    const isError = result.isError === true;
    const parts: string[] = [];
    const content = Array.isArray(result.content)
      ? (result.content as Json[])
      : [];
    for (const block of content) {
      if (block.type === "text" && typeof block.text === "string") {
        parts.push(block.text);
      } else {
        parts.push(JSON.stringify(block));
      }
    }
    if (parts.length === 0 && result.structuredContent != null) {
      parts.push(JSON.stringify(result.structuredContent, null, 2));
    }
    return { text: parts.join("\n\n") || "(no output)", isError };
  }

  async close(): Promise<void> {
    if (!this.sessionId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      await fetch(this.url, {
        method: "DELETE",
        headers: this.headers(),
        signal: controller.signal,
      });
    } catch {
      // session teardown is best-effort
    } finally {
      clearTimeout(timer);
    }
  }
}
