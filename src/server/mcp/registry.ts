import { McpClient } from "@/server/mcp/client";
import { listMcpServers } from "@/server/mcp/types";
import type {
  McpCallResult,
  McpToolDescriptor,
} from "@/server/mcp/types";

/**
 * Per-turn MCP connector harness. Discovers tools from every configured MCP
 * server (CLAUXEN_MCP_SERVERS), exposes them to the agent loop as
 * mcp__<serverId>__<toolName>, and routes calls back over streamable HTTP.
 * Servers that fail to connect are skipped so one bad connector never sinks
 * a turn.
 */
export class McpConnectorHarness {
  private clients = new Map<string, McpClient>();
  private toolIndex = new Map<string, { serverId: string; name: string }>();
  private discovered: McpToolDescriptor[] = [];
  private ready = false;

  /** Connect to all configured servers and discover their tools. */
  async discover(): Promise<McpToolDescriptor[]> {
    if (this.ready) return this.discovered;
    this.ready = true;
    const servers = listMcpServers();
    await Promise.all(
      servers.map(async (config) => {
        const client = new McpClient(config);
        try {
          const tools = await client.listTools();
          this.clients.set(config.id, client);
          for (const tool of tools) {
            const qualifiedName = `mcp__${config.id}__${tool.name}`.replace(
              /[^a-zA-Z0-9_-]/g,
              "_",
            );
            if (this.toolIndex.has(qualifiedName)) continue;
            this.toolIndex.set(qualifiedName, {
              serverId: config.id,
              name: tool.name,
            });
            this.discovered.push({
              qualifiedName,
              serverId: config.id,
              name: tool.name,
              description:
                tool.description || `Tool ${tool.name} from the ${config.id} connector.`,
              inputSchema: tool.inputSchema,
            });
          }
        } catch {
          // unreachable / misconfigured server — skip it for this turn
        }
      }),
    );
    return this.discovered;
  }

  /** Route a qualified mcp__* call to its server. */
  async call(
    qualifiedName: string,
    args: Record<string, unknown>,
  ): Promise<McpCallResult> {
    const target = this.toolIndex.get(qualifiedName);
    if (!target) {
      return { text: `Unknown MCP tool: ${qualifiedName}`, isError: true };
    }
    const client = this.clients.get(target.serverId);
    if (!client) {
      return {
        text: `MCP server "${target.serverId}" is not connected in this turn.`,
        isError: true,
      };
    }
    try {
      return await client.callTool(target.name, args);
    } catch (error) {
      return {
        text: `MCP call failed: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  /** Tear down all sessions (end of turn). */
  async close(): Promise<void> {
    await Promise.all(
      [...this.clients.values()].map((client) => client.close()),
    );
    this.clients.clear();
    this.toolIndex.clear();
    this.discovered = [];
    this.ready = false;
  }
}
