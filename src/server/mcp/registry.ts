import { McpClient } from "@/server/mcp/client";
import { listMcpServers } from "@/server/mcp/types";
import type { McpCallResult, McpToolDescriptor } from "@/server/mcp/types";
import {
  callConnectorGatewayTool,
  connectorGatewayConfigured,
  listConnectorGatewayTools,
} from "@/server/connectors/gateway";

type ToolTarget =
  | { kind: "mcp"; serverId: string; name: string }
  | { kind: "gateway"; connectorKey: string; name: string };

/**
 * Per-turn MCP connector harness. Discovers tools from every configured MCP
 * server (CLAUXEN_MCP_SERVERS), exposes them to the agent loop as
 * mcp__<serverId>__<toolName>, and routes calls back over streamable HTTP.
 * Servers that fail to connect are skipped so one bad connector never sinks
 * a turn.
 */
export class McpConnectorHarness {
  private clients = new Map<string, McpClient>();
  private toolIndex = new Map<string, ToolTarget>();
  private discovered: McpToolDescriptor[] = [];
  private ready = false;

  constructor(private readonly options: { userId?: string } = {}) {}

  hasSources(): boolean {
    return (
      listMcpServers().length > 0 ||
      Boolean(this.options.userId && connectorGatewayConfigured())
    );
  }

  /** Connect to all configured servers and discover their tools. */
  async discover(): Promise<McpToolDescriptor[]> {
    if (this.ready) return this.discovered;
    this.ready = true;
    const servers = listMcpServers();
    const discoveries: Array<Promise<void>> = servers.map(async (config) => {
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
            kind: "mcp",
            serverId: config.id,
            name: tool.name,
          });
          this.discovered.push({
            qualifiedName,
            serverId: config.id,
            name: tool.name,
            description:
              tool.description ||
              `Tool ${tool.name} from the ${config.id} connector.`,
            inputSchema: tool.inputSchema,
          });
        }
      } catch {
        // unreachable / misconfigured server — skip it for this turn
      }
    });

    if (this.options.userId && connectorGatewayConfigured()) {
      discoveries.push(
        (async () => {
          try {
            const tools = await listConnectorGatewayTools(this.options.userId!);
            for (const tool of tools) {
              if (this.toolIndex.has(tool.qualifiedName)) continue;
              this.toolIndex.set(tool.qualifiedName, {
                kind: "gateway",
                connectorKey: tool.connectorKey,
                name: tool.toolName,
              });
              this.discovered.push({
                qualifiedName: tool.qualifiedName,
                serverId: tool.connectorKey,
                name: tool.toolName,
                description: tool.description,
                inputSchema: tool.inputSchema,
              });
            }
          } catch {
            // The connector gateway is optional for a turn; built-in tools remain available.
          }
        })(),
      );
    }

    await Promise.all(discoveries);
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
    if (target.kind === "gateway") {
      if (!this.options.userId) {
        return {
          text: "Connector user context is unavailable.",
          isError: true,
        };
      }
      try {
        const outcome = await callConnectorGatewayTool(this.options.userId, {
          connectorKey: target.connectorKey,
          toolName: target.name,
          arguments: args,
        });
        if (outcome.requiresApproval) {
          return {
            text: `${outcome.text} Approval ID: ${outcome.approvalId ?? "unavailable"}. The user must approve this action in Clauxen before it can run.`,
            isError: true,
          };
        }
        return { text: outcome.text, isError: outcome.isError };
      } catch (error) {
        return {
          text: `Connector call failed: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
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
