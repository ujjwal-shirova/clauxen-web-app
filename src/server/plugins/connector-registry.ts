import endpointsJson from "./connector-endpoints.generated.json";
import { pluginById } from "@/client/components/plugins/catalog";
import {
  providerCredentials,
  providerConfig,
  type OAuthProviderId,
} from "@/server/plugins/oauth-providers";
import type { RestToolsetId } from "@/server/plugins/rest-toolsets";

/**
 * How each marketplace plugin connects.
 *
 *  - "mcp":  the provider's own remote MCP server. Authorization follows the
 *            MCP OAuth profile: RFC 9728 discovery points at the provider's
 *            authorization server, so the user consents on the provider's site.
 *  - "rest": providers without a usable remote MCP server. Clauxen runs the
 *            provider's OAuth flow and ships first-party tools that call the
 *            provider's REST API.
 *
 * Plugins that only ship a local (stdio) MCP server have no entry and are
 * shown as unavailable rather than faking a connection.
 */

type EndpointEntry = { transport: string; url: string };
const ENDPOINTS = endpointsJson as Record<string, EndpointEntry>;

export type ConnectorSpec =
  | {
      kind: "mcp";
      pluginId: string;
      name: string;
      iconUrl: string | null;
      mcpUrl: string;
      /** Pre-registered OAuth app to use when discovery lands on this provider. */
      provider: OAuthProviderId | null;
      /** Used only when the server's metadata does not advertise scopes. */
      fallbackScopes: string[];
    }
  | {
      kind: "rest";
      pluginId: string;
      name: string;
      iconUrl: string | null;
      provider: OAuthProviderId;
      toolset: RestToolsetId;
      scopes: string[];
    };

type Override =
  | {
      kind: "mcp";
      mcpUrl?: string;
      provider?: OAuthProviderId;
      fallbackScopes?: string[];
    }
  | {
      kind: "rest";
      provider: OAuthProviderId;
      toolset: RestToolsetId;
      scopes: string[];
    }
  | { kind: "unavailable" };

const MICROSOFT_BASE = ["offline_access", "User.Read"];

const OVERRIDES: Record<string, Override> = {
  gmail: {
    kind: "mcp",
    provider: "google",
    fallbackScopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  },
  "google-calendar": {
    kind: "mcp",
    provider: "google",
    fallbackScopes: ["https://www.googleapis.com/auth/calendar"],
  },
  "google-drive": {
    kind: "rest",
    provider: "google",
    toolset: "google-drive",
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ],
  },
  github: {
    kind: "mcp",
    provider: "github",
    fallbackScopes: ["repo", "read:org", "read:user", "user:email"],
  },
  slack: { kind: "mcp", provider: "slack" },
  linear: { kind: "mcp", mcpUrl: "https://mcp.linear.app/mcp" },
  outlook: {
    kind: "rest",
    provider: "microsoft",
    toolset: "outlook-mail",
    scopes: [...MICROSOFT_BASE, "Mail.ReadWrite", "Mail.Send"],
  },
  "outlook-calendar": {
    kind: "rest",
    provider: "microsoft",
    toolset: "outlook-calendar",
    scopes: [...MICROSOFT_BASE, "Calendars.ReadWrite"],
  },
  onedrive: {
    kind: "rest",
    provider: "microsoft",
    toolset: "onedrive",
    scopes: [...MICROSOFT_BASE, "Files.ReadWrite"],
  },
  teams: {
    kind: "rest",
    provider: "microsoft",
    toolset: "teams",
    scopes: [
      ...MICROSOFT_BASE,
      "Chat.ReadWrite",
      "Team.ReadBasic.All",
      "Channel.ReadBasic.All",
      "ChannelMessage.Send",
    ],
  },
  sharepoint: {
    kind: "rest",
    provider: "microsoft",
    toolset: "sharepoint",
    scopes: [...MICROSOFT_BASE, "Sites.Read.All", "Files.Read.All"],
  },
};

/** Connection plan for a catalog plugin, or null when it cannot connect. */
export function resolveConnector(pluginId: string): ConnectorSpec | null {
  const catalogEntry = pluginById(pluginId);
  if (!catalogEntry) return null;

  const base = {
    pluginId,
    name: catalogEntry.name,
    iconUrl: catalogEntry.iconUrl || null,
  };
  const override = OVERRIDES[pluginId];
  if (override?.kind === "unavailable") return null;

  if (override?.kind === "rest") {
    return {
      ...base,
      kind: "rest",
      provider: override.provider,
      toolset: override.toolset,
      scopes: override.scopes,
    };
  }

  const endpoint = ENDPOINTS[pluginId];
  const mcpUrl =
    override?.mcpUrl ??
    (endpoint && endpoint.transport === "http" ? endpoint.url : null);
  if (!mcpUrl) return null;

  return {
    ...base,
    kind: "mcp",
    mcpUrl,
    provider: override?.provider ?? null,
    fallbackScopes: override?.fallbackScopes ?? [],
  };
}

export type ConnectorAvailability = {
  pluginId: string;
  available: boolean;
  kind: "mcp" | "rest" | null;
  providerLabel: string | null;
  /** Why the plugin cannot be connected right now. */
  reason: "local_only" | "provider_not_configured" | null;
};

export function connectorAvailability(pluginId: string): ConnectorAvailability {
  const spec = resolveConnector(pluginId);
  if (!spec) {
    return {
      pluginId,
      available: false,
      kind: null,
      providerLabel: null,
      reason: "local_only",
    };
  }
  const provider = spec.provider;
  const configured = provider ? providerCredentials(provider) !== null : true;
  return {
    pluginId,
    available: configured,
    kind: spec.kind,
    providerLabel: provider ? providerConfig(provider).label : null,
    reason: configured ? null : "provider_not_configured",
  };
}
