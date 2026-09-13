import type { McpServerConfig } from "@/server/mcp/types";

/**
 * Minimal MCP client over the streamable-HTTP transport (JSON-RPC 2.0).
 * One ephemeral session per Clauxen agent turn: initialize → tools/list /
 * tools/call → DELETE. Servers that don't hand out session ids work too.
 */

const PROTOCOL_VERSION = "2025-03-26";
const REQUEST_TIMEOUT_MS = 20_000;

type Json = Record<string, unknown>;

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

export class McpClient {
  private sessionId: string | null = null;
  private nextRequestId = 1;
  private initialized = false;

  constructor(private readonly config: McpServerConfig) {}

  get serverId(): string {
    return this.config.id;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": PROTOCOL_VERSION,
      ...this.config.headers,
    };
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;
    return headers;
  }

  private async post(
    payload: Json,
  ): Promise<{ response: Response; sessionId: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.config.url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) this.sessionId = sessionId;
      return { response, sessionId };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Parse an MCP HTTP response: plain JSON or an SSE stream of JSON-RPC messages. */
  private async parseResponse(response: Response): Promise<Json | null> {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      const text = await response.text();
      for (const chunk of text.split("\n\n")) {
        const dataLine = chunk
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload) continue;
        try {
          const parsed = JSON.parse(payload) as Json;
          if (parsed && (parsed.result !== undefined || parsed.error)) {
            return parsed;
          }
        } catch {
          continue;
        }
      }
      return null;
    }
    if (response.status === 202) return null; // notification accepted
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text) as Json;
  }

  private async request(
    method: string,
    params: Json,
  ): Promise<{ result?: Json; error?: { code?: number; message?: string } }> {
    const id = this.nextRequestId++;
    const { response } = await this.post({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `MCP ${this.config.id} ${method} failed: HTTP ${response.status} ${body.slice(0, 200)}`,
      );
    }
    const parsed = await this.parseResponse(response);
    if (!parsed) return {};
    return {
      result: parsed.result as Json | undefined,
      error: parsed.error as { code?: number; message?: string } | undefined,
    };
  }

  private async notify(method: string, params: Json = {}): Promise<void> {
    try {
      await this.post({ jsonrpc: "2.0", method, params });
    } catch {
      // notifications are best-effort
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const { error } = await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "clauxen", version: "1.0.0" },
    });
    if (error) {
      throw new Error(
        `MCP ${this.config.id} initialize rejected: ${error.message ?? "unknown error"}`,
      );
    }
    this.initialized = true;
    await this.notify("notifications/initialized");
  }

  /**
   * Probe the server without throwing on auth challenges. Used by installs to
   * distinguish open servers (connect immediately) from OAuth servers (need
   * the gateway) and API-key servers (need a user key).
   */
  async probe(): Promise<{
    status: number;
    authorized: boolean;
    resourceMetadataUrl: string | null;
  }> {
    const id = this.nextRequestId++;
    const { response } = await this.post({
      jsonrpc: "2.0",
      id,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "clauxen", version: "1.0.0" },
      },
    });
    const resourceMetadataUrl = parseWwwAuthenticate(
      response.headers.get("www-authenticate"),
    );
    if (response.status === 401 || response.status === 403) {
      return { status: response.status, authorized: false, resourceMetadataUrl };
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `MCP ${this.config.id} initialize failed: HTTP ${response.status} ${body.slice(0, 200)}`,
      );
    }
    const parsed = await this.parseResponse(response);
    const error = parsed?.error as { message?: string } | undefined;
    if (error) {
      throw new Error(
        `MCP ${this.config.id} initialize rejected: ${error.message ?? "unknown error"}`,
      );
    }
    this.initialized = true;
    await this.notify("notifications/initialized");
    return {
      status: response.status,
      authorized: true,
      resourceMetadataUrl,
    };
  }

  async listTools(): Promise<
    Array<{ name: string; description: string; inputSchema: Json }>
  > {
    await this.initialize();
    const tools: Array<{ name: string; description: string; inputSchema: Json }> =
      [];
    let cursor: string | undefined;
    // paginate through tools/list
    for (let page = 0; page < 10; page++) {
      const { result, error } = await this.request(
        "tools/list",
        cursor ? { cursor } : {},
      );
      if (error) {
        throw new Error(
          `MCP ${this.config.id} tools/list rejected: ${error.message ?? "unknown error"}`,
        );
      }
      const pageTools = Array.isArray(result?.tools) ? (result.tools as Json[]) : [];
      for (const tool of pageTools) {
        const name = typeof tool.name === "string" ? tool.name : "";
        if (!name) continue;
        const inputSchema =
          tool.inputSchema && typeof tool.inputSchema === "object"
            ? (tool.inputSchema as Json)
            : { type: "object", properties: {} };
        tools.push({
          name,
          description:
            typeof tool.description === "string" ? tool.description : "",
          inputSchema,
        });
      }
      cursor =
        result && typeof result.nextCursor === "string"
          ? result.nextCursor
          : undefined;
      if (!cursor) break;
    }
    return tools;
  }

  async listPrompts(): Promise<McpPrompt[]> {
    try {
      await this.initialize();
      const { result } = await this.request("prompts/list", {});
      const prompts = Array.isArray(result?.prompts)
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
    await this.initialize();
    const { result, error } = await this.request("prompts/get", {
      name,
      arguments: args,
    });
    if (error) {
      return {
        text: `MCP skill error: ${error.message ?? "unknown error"}`,
        isError: true,
      };
    }
    const parts: string[] = [];
    const description =
      result && typeof result.description === "string"
        ? result.description
        : "";
    if (description) parts.push(description);
    const messages = Array.isArray(result?.messages)
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
    await this.initialize();
    const { result, error } = await this.request("tools/call", {
      name,
      arguments: args,
    });
    if (error) {
      return {
        text: `MCP tool error: ${error.message ?? "unknown error"}`,
        isError: true,
      };
    }
    const isError = result?.isError === true;
    const parts: string[] = [];
    const content = Array.isArray(result?.content)
      ? (result.content as Json[])
      : [];
    for (const block of content) {
      if (block.type === "text" && typeof block.text === "string") {
        parts.push(block.text);
      } else if (block.type === "resource") {
        const resource = block.resource as Json | undefined;
        if (resource && typeof resource.text === "string") {
          parts.push(resource.text);
        } else {
          parts.push(JSON.stringify(block));
        }
      } else {
        parts.push(JSON.stringify(block));
      }
    }
    const structured = result?.structuredContent;
    if (
      parts.length === 0 &&
      structured !== undefined &&
      structured !== null
    ) {
      parts.push(JSON.stringify(structured, null, 2));
    }
    return { text: parts.join("\n\n") || "(no output)", isError };
  }

  async close(): Promise<void> {
    if (!this.sessionId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      await fetch(this.config.url, {
        method: "DELETE",
        headers: this.buildHeaders(),
        signal: controller.signal,
      });
    } catch {
      // session teardown is best-effort
    } finally {
      clearTimeout(timer);
    }
  }
}
