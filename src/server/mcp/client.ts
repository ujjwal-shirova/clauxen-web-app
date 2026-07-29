import type { McpServerConfig } from "@/server/mcp/types";

/**
 * Minimal MCP client over the streamable-HTTP transport (JSON-RPC 2.0).
 * One ephemeral session per Clauxen agent turn: initialize → tools/list /
 * tools/call → DELETE. Servers that don't hand out session ids work too.
 */

const PROTOCOL_VERSION = "2025-03-26";
const REQUEST_TIMEOUT_MS = 20_000;

type Json = Record<string, unknown>;

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
