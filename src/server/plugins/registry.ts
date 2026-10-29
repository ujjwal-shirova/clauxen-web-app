import {
  PRIORITY_CONNECTORS,
  type ConnectorId,
} from "../../shared/lib/plugin-connectors";

export type ConnectorDefinition = {
  id: ConnectorId;
  name: string;
  transport: "github" | "rest" | "mcp";
  registrationUrl: string;
  oauth?: {
    // Credentials: PLUGIN_OAUTH_${provider.toUpperCase()}_CLIENT_ID / CLIENT_SECRET.
    provider: string;
    authorizeUrl: string;
    tokenUrl: string;
    scopes: string[];
    pkce: boolean;
    tokenAuth: "basic" | "body";
    extraAuthorize?: Record<string, string>;
  };
  mcpUrl?: string;
  allowedHosts?: string[];
};

type Settings = Omit<ConnectorDefinition, "id" | "name">;
const google = (scopes: string[]): Settings => ({
  transport: "rest",
  registrationUrl: "https://console.cloud.google.com/apis/credentials",
  allowedHosts: ["gmail.googleapis.com", "www.googleapis.com"],
  oauth: {
    provider: "google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: scopes.map((scope) => `https://www.googleapis.com/auth/${scope}`),
    pkce: true,
    tokenAuth: "body",
    extraAuthorize: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
  },
});
const microsoft = (scopes: string[]): Settings => ({
  transport: "rest",
  registrationUrl:
    "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
  allowedHosts: ["graph.microsoft.com"],
  oauth: {
    provider: "microsoft",
    authorizeUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["offline_access", ...scopes],
    pkce: true,
    tokenAuth: "body",
    extraAuthorize: { prompt: "select_account" },
  },
});

const settings: Record<ConnectorId, Settings> = {
  // Execution stays in executeGitHubAgent(userId, operation, args), not a token adapter.
  github: {
    transport: "github",
    registrationUrl: "https://github.com/settings/apps",
  },
  gmail: google(["gmail.readonly", "gmail.compose"]), // compose also authorizes sending.
  "google-calendar": google(["calendar.events"]),
  "google-drive": google(["drive.readonly", "drive.file"]),
  notion: {
    transport: "mcp",
    registrationUrl: "https://developers.notion.com/docs/mcp",
    mcpUrl: "https://mcp.notion.com/mcp",
    allowedHosts: ["mcp.notion.com"],
  },
  slack: {
    transport: "rest",
    registrationUrl: "https://api.slack.com/apps",
    allowedHosts: ["slack.com"],
    oauth: {
      provider: "slack",
      authorizeUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      // These are USER scopes. Auth must use user_scope, not scope, and authed_user.access_token.
      scopes: [
        "search:read",
        "channels:read",
        "groups:read",
        "im:read",
        "mpim:read",
        "chat:write",
      ],
      pkce: false,
      tokenAuth: "basic",
      extraAuthorize: {
        user_scope:
          "search:read,channels:read,groups:read,im:read,mpim:read,chat:write",
      },
    },
  },
  outlook: microsoft(["Mail.Read", "Mail.Send"]),
  "outlook-calendar": microsoft(["Calendars.ReadWrite"]),
  onedrive: microsoft(["Files.ReadWrite"]),
  sharepoint: microsoft(["Sites.Read.All"]),
  teams: microsoft(["Team.ReadBasic.All", "Chat.Read", "ChatMessage.Send"]),
  linear: {
    transport: "rest",
    registrationUrl: "https://linear.app/settings/api/applications/new",
    allowedHosts: ["api.linear.app"],
    oauth: {
      provider: "linear",
      authorizeUrl: "https://linear.app/oauth/authorize",
      tokenUrl: "https://api.linear.app/oauth/token",
      scopes: ["read", "issues:create"],
      pkce: true,
      tokenAuth: "body",
    },
  },
  "atlassian-mcp": {
    transport: "mcp",
    registrationUrl:
      "https://developer.atlassian.com/platform/remote-mcp-server/",
    mcpUrl: "https://mcp.atlassian.com/v2/mcp",
    allowedHosts: ["mcp.atlassian.com"],
  },
  airtable: {
    transport: "rest",
    registrationUrl: "https://airtable.com/create/oauth",
    allowedHosts: ["api.airtable.com"],
    oauth: {
      provider: "airtable",
      authorizeUrl: "https://airtable.com/oauth2/v1/authorize",
      tokenUrl: "https://airtable.com/oauth2/v1/token",
      scopes: ["schema.bases:read", "data.records:read", "data.records:write"],
      pkce: true,
      tokenAuth: "basic",
    },
  },
  asana: {
    transport: "rest",
    registrationUrl: "https://app.asana.com/0/my-apps",
    allowedHosts: ["app.asana.com"],
    oauth: {
      provider: "asana",
      authorizeUrl: "https://app.asana.com/-/oauth_authorize",
      tokenUrl: "https://app.asana.com/-/oauth_token",
      scopes: ["tasks:read", "tasks:write", "projects:read"],
      pkce: true,
      tokenAuth: "body",
    },
  },
  todoist: {
    transport: "rest",
    registrationUrl:
      "https://app.todoist.com/app/settings/integrations/developer",
    allowedHosts: ["api.todoist.com"],
    oauth: {
      provider: "todoist",
      authorizeUrl: "https://app.todoist.com/oauth/authorize",
      tokenUrl: "https://api.todoist.com/oauth/access_token",
      scopes: ["data:read", "task:add"],
      pkce: false,
      tokenAuth: "body",
      extraAuthorize: { scope: "data:read,task:add" },
    },
  },
  dropbox: {
    transport: "rest",
    registrationUrl: "https://www.dropbox.com/developers/apps",
    allowedHosts: ["api.dropboxapi.com", "content.dropboxapi.com"],
    oauth: {
      provider: "dropbox",
      authorizeUrl: "https://www.dropbox.com/oauth2/authorize",
      tokenUrl: "https://api.dropboxapi.com/oauth2/token",
      scopes: [
        "files.metadata.read",
        "files.content.read",
        "files.content.write",
      ],
      pkce: true,
      tokenAuth: "basic",
      extraAuthorize: { token_access_type: "offline" },
    },
  },
  figma: {
    transport: "mcp",
    registrationUrl:
      "https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/",
    mcpUrl: "https://mcp.figma.com/mcp",
    allowedHosts: ["mcp.figma.com", "api.figma.com", "www.figma.com"],
  },
  zoom: {
    transport: "rest",
    registrationUrl: "https://marketplace.zoom.us/develop/create",
    allowedHosts: ["api.zoom.us"],
    oauth: {
      provider: "zoom",
      authorizeUrl: "https://zoom.us/oauth/authorize",
      tokenUrl: "https://zoom.us/oauth/token",
      scopes: ["meeting:read:list_meetings", "meeting:write:meeting"],
      pkce: false,
      tokenAuth: "basic",
    },
  },
  hubspot: {
    transport: "rest",
    registrationUrl: "https://app.hubspot.com/developer",
    allowedHosts: ["api.hubapi.com"],
    oauth: {
      provider: "hubspot",
      authorizeUrl: "https://app.hubspot.com/oauth/authorize",
      tokenUrl: "https://api.hubspot.com/oauth/v3/token",
      scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"],
      pkce: false,
      tokenAuth: "body",
    },
  },
};

export const CONNECTORS: readonly ConnectorDefinition[] =
  PRIORITY_CONNECTORS.map(({ id, name }) => ({ id, name, ...settings[id] }));

export function getConnector(id: string): ConnectorDefinition | undefined {
  return CONNECTORS.find((connector) => connector.id === id);
}
