export type ConnectorId =
  | "github"
  | "gmail"
  | "google-calendar"
  | "google-drive"
  | "notion"
  | "slack"
  | "outlook"
  | "outlook-calendar"
  | "onedrive"
  | "sharepoint"
  | "teams"
  | "linear"
  | "atlassian-mcp"
  | "airtable"
  | "asana"
  | "todoist"
  | "dropbox"
  | "figma"
  | "zoom"
  | "hubspot";

export const PRIORITY_CONNECTORS: readonly { id: ConnectorId; name: string }[] =
  [
    { id: "github", name: "GitHub" },
    { id: "gmail", name: "Gmail" },
    { id: "google-calendar", name: "Google Calendar" },
    { id: "google-drive", name: "Google Drive" },
    { id: "notion", name: "Notion" },
    { id: "slack", name: "Slack" },
    { id: "outlook", name: "Outlook" },
    { id: "outlook-calendar", name: "Outlook Calendar" },
    { id: "onedrive", name: "OneDrive" },
    { id: "sharepoint", name: "SharePoint" },
    { id: "teams", name: "Microsoft Teams" },
    { id: "linear", name: "Linear" },
    { id: "atlassian-mcp", name: "Atlassian" },
    { id: "airtable", name: "Airtable" },
    { id: "asana", name: "Asana" },
    { id: "todoist", name: "Todoist" },
    { id: "dropbox", name: "Dropbox" },
    { id: "figma", name: "Figma" },
    { id: "zoom", name: "Zoom" },
    { id: "hubspot", name: "HubSpot" },
  ];

export type ConnectorTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
};

export type ConnectorConnection = {
  id: string;
  pluginId: ConnectorId;
  accountLabel: string;
  status: "active" | "reauthorization_required";
  grantedScopes: string[];
  connectedAt: string;
};

export type ConnectorAvailability = {
  pluginId: ConnectorId;
  name: string;
  ready: boolean;
  reason?: string;
  registrationUrl: string;
  scopes: string[];
  transport: "github" | "rest" | "mcp";
};

export type ConnectorApproval = {
  id: string;
  pluginId: ConnectorId;
  toolName: string;
  title: string;
  arguments: Record<string, unknown>;
  status:
    | "pending"
    | "approved"
    | "running"
    | "complete"
    | "failed"
    | "unknown";
  expiresAt: string;
  result?: unknown;
};
