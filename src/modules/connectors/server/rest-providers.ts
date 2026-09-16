export type RestToolRisk = "read" | "write" | "destructive" | "sensitive";

export type RestProviderTool = {
  name: string;
  title: string;
  description: string;
  httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  pathTemplate: string;
  riskLevel: RestToolRisk;
  requiresConfirmation?: boolean;
  inputSchema: Record<string, unknown>;
  requestConfig?: Record<string, unknown>;
};

export type RestProviderRecipe = {
  key: string;
  name: string;
  provider: string;
  documentationUrl: string;
  authType: "oauth2";
  protocol: "rest";
  status: "active" | "beta";
  scopes: string[];
  authorizationEndpoint: string;
  tokenEndpoint: string;
  refreshEndpoint?: string | null;
  revocationEndpoint?: string | null;
  apiBaseUrl: string;
  clientAuthMethod: "none" | "client_secret_post" | "client_secret_basic";
  supportsPkce: boolean;
  scopeSeparator: " " | ",";
  authorizationParams: Record<string, string>;
  tokenParams: Record<string, string>;
  capabilities: string[];
  tools: RestProviderTool[];
};

const githubHeaders = {
  headers: {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  },
};

const notionHeaders = {
  headers: {
    accept: "application/json",
    "notion-version": "2022-06-28",
  },
};

export const REST_PROVIDERS: RestProviderRecipe[] = [
  {
    key: "github",
    name: "GitHub",
    provider: "github",
    documentationUrl: "https://docs.github.com/en/rest",
    authType: "oauth2",
    protocol: "rest",
    status: "active",
    scopes: ["repo", "read:user", "user:email"],
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    apiBaseUrl: "https://api.github.com",
    clientAuthMethod: "client_secret_post",
    supportsPkce: true,
    scopeSeparator: " ",
    authorizationParams: {},
    tokenParams: {},
    capabilities: ["repos", "issues", "pulls", "search"],
    tools: [
      {
        name: "get_authenticated_user",
        title: "Get authenticated user",
        description: "Return the GitHub account that authorized this connection.",
        httpMethod: "GET",
        pathTemplate: "/user",
        riskLevel: "read",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        requestConfig: githubHeaders,
      },
      {
        name: "list_repos",
        title: "List repositories",
        description: "List repositories for the authenticated GitHub user.",
        httpMethod: "GET",
        pathTemplate: "/user/repos",
        riskLevel: "read",
        inputSchema: {
          type: "object",
          properties: {
            per_page: { type: "integer", minimum: 1, maximum: 100 },
            page: { type: "integer", minimum: 1 },
            sort: {
              type: "string",
              enum: ["created", "updated", "pushed", "full_name"],
            },
            type: {
              type: "string",
              enum: ["all", "owner", "public", "private", "member"],
            },
          },
          additionalProperties: false,
        },
        requestConfig: githubHeaders,
      },
      {
        name: "list_issues",
        title: "List repository issues",
        description: "List issues in a GitHub repository.",
        httpMethod: "GET",
        pathTemplate: "/repos/{owner}/{repo}/issues",
        riskLevel: "read",
        inputSchema: {
          type: "object",
          required: ["owner", "repo"],
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            state: { type: "string", enum: ["open", "closed", "all"] },
            per_page: { type: "integer", minimum: 1, maximum: 100 },
          },
          additionalProperties: false,
        },
        requestConfig: githubHeaders,
      },
      {
        name: "create_issue",
        title: "Create issue",
        description: "Create an issue in a GitHub repository.",
        httpMethod: "POST",
        pathTemplate: "/repos/{owner}/{repo}/issues",
        riskLevel: "write",
        requiresConfirmation: true,
        inputSchema: {
          type: "object",
          required: ["owner", "repo", "title"],
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            labels: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        },
        requestConfig: githubHeaders,
      },
      {
        name: "search_issues",
        title: "Search issues and pull requests",
        description: "Search GitHub issues and pull requests with a query string.",
        httpMethod: "GET",
        pathTemplate: "/search/issues",
        riskLevel: "read",
        inputSchema: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string" },
            per_page: { type: "integer", minimum: 1, maximum: 100 },
          },
          additionalProperties: false,
        },
        requestConfig: githubHeaders,
      },
    ],
  },
  {
    key: "slack",
    name: "Slack",
    provider: "slack",
    documentationUrl: "https://docs.slack.dev/reference/methods",
    authType: "oauth2",
    protocol: "rest",
    status: "active",
    scopes: [
      "channels:read",
      "channels:history",
      "chat:write",
      "users:read",
      "users:read.email",
    ],
    authorizationEndpoint: "https://slack.com/oauth/v2/authorize",
    tokenEndpoint: "https://slack.com/api/oauth.v2.access",
    apiBaseUrl: "https://slack.com/api",
    clientAuthMethod: "client_secret_post",
    supportsPkce: false,
    scopeSeparator: ",",
    authorizationParams: {},
    tokenParams: {},
    capabilities: ["channels", "messages", "users"],
    tools: [
      {
        name: "list_conversations",
        title: "List conversations",
        description: "List Slack channels the connected workspace can see.",
        httpMethod: "GET",
        pathTemplate: "/conversations.list",
        riskLevel: "read",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 200 },
            types: { type: "string" },
            cursor: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      {
        name: "list_users",
        title: "List users",
        description: "List users in the connected Slack workspace.",
        httpMethod: "GET",
        pathTemplate: "/users.list",
        riskLevel: "read",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 200 },
            cursor: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      {
        name: "post_message",
        title: "Post message",
        description: "Post a message to a Slack channel.",
        httpMethod: "POST",
        pathTemplate: "/chat.postMessage",
        riskLevel: "write",
        requiresConfirmation: true,
        inputSchema: {
          type: "object",
          required: ["channel", "text"],
          properties: {
            channel: { type: "string" },
            text: { type: "string" },
            thread_ts: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    ],
  },
  {
    key: "notion",
    name: "Notion",
    provider: "notion",
    documentationUrl: "https://developers.notion.com/reference",
    authType: "oauth2",
    protocol: "rest",
    status: "active",
    scopes: [],
    authorizationEndpoint: "https://api.notion.com/v1/oauth/authorize",
    tokenEndpoint: "https://api.notion.com/v1/oauth/token",
    apiBaseUrl: "https://api.notion.com",
    clientAuthMethod: "client_secret_basic",
    supportsPkce: true,
    scopeSeparator: " ",
    authorizationParams: { owner: "user" },
    tokenParams: {},
    capabilities: ["search", "pages", "databases"],
    tools: [
      {
        name: "search",
        title: "Search workspace",
        description: "Search pages and databases in the connected Notion workspace.",
        httpMethod: "POST",
        pathTemplate: "/v1/search",
        riskLevel: "read",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            page_size: { type: "integer", minimum: 1, maximum: 100 },
          },
          additionalProperties: false,
        },
        requestConfig: notionHeaders,
      },
      {
        name: "get_page",
        title: "Get page",
        description: "Fetch a Notion page by id.",
        httpMethod: "GET",
        pathTemplate: "/v1/pages/{page_id}",
        riskLevel: "read",
        inputSchema: {
          type: "object",
          required: ["page_id"],
          properties: { page_id: { type: "string" } },
          additionalProperties: false,
        },
        requestConfig: notionHeaders,
      },
    ],
  },
  {
    key: "gmail",
    name: "Gmail",
    provider: "google",
    documentationUrl: "https://developers.google.com/gmail/api/reference/rest",
    authType: "oauth2",
    protocol: "rest",
    status: "active",
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ],
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://gmail.googleapis.com",
    clientAuthMethod: "client_secret_post",
    supportsPkce: true,
    scopeSeparator: " ",
    authorizationParams: { access_type: "offline", prompt: "consent" },
    tokenParams: {},
    capabilities: ["messages", "send"],
    tools: [
      {
        name: "list_messages",
        title: "List messages",
        description: "List Gmail messages for the connected account.",
        httpMethod: "GET",
        pathTemplate: "/gmail/v1/users/me/messages",
        riskLevel: "sensitive",
        requiresConfirmation: true,
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string" },
            maxResults: { type: "integer", minimum: 1, maximum: 100 },
            pageToken: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      {
        name: "get_message",
        title: "Get message",
        description: "Fetch a Gmail message by id.",
        httpMethod: "GET",
        pathTemplate: "/gmail/v1/users/me/messages/{id}",
        riskLevel: "sensitive",
        requiresConfirmation: true,
        inputSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
            format: {
              type: "string",
              enum: ["minimal", "full", "metadata", "raw"],
            },
          },
          additionalProperties: false,
        },
      },
    ],
  },
  {
    key: "google-drive",
    name: "Google Drive",
    provider: "google",
    documentationUrl: "https://developers.google.com/drive/api/reference/rest/v3",
    authType: "oauth2",
    protocol: "rest",
    status: "active",
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://www.googleapis.com",
    clientAuthMethod: "client_secret_post",
    supportsPkce: true,
    scopeSeparator: " ",
    authorizationParams: { access_type: "offline", prompt: "consent" },
    tokenParams: {},
    capabilities: ["files", "search"],
    tools: [
      {
        name: "list_files",
        title: "List files",
        description: "List Google Drive files for the connected account.",
        httpMethod: "GET",
        pathTemplate: "/drive/v3/files",
        riskLevel: "read",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string" },
            pageSize: { type: "integer", minimum: 1, maximum: 100 },
            pageToken: { type: "string" },
            fields: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      {
        name: "get_file",
        title: "Get file",
        description: "Fetch Google Drive file metadata by id.",
        httpMethod: "GET",
        pathTemplate: "/drive/v3/files/{fileId}",
        riskLevel: "read",
        inputSchema: {
          type: "object",
          required: ["fileId"],
          properties: {
            fileId: { type: "string" },
            fields: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    ],
  },
  {
    key: "figma",
    name: "Figma",
    provider: "figma",
    documentationUrl: "https://developers.figma.com/docs/rest-api",
    authType: "oauth2",
    protocol: "rest",
    status: "beta",
    scopes: ["files:read"],
    authorizationEndpoint: "https://www.figma.com/oauth",
    tokenEndpoint: "https://api.figma.com/v1/oauth/token",
    refreshEndpoint: "https://api.figma.com/v1/oauth/refresh",
    apiBaseUrl: "https://api.figma.com",
    clientAuthMethod: "client_secret_basic",
    supportsPkce: false,
    scopeSeparator: ",",
    authorizationParams: {},
    tokenParams: {},
    capabilities: ["files", "comments"],
    tools: [
      {
        name: "get_me",
        title: "Get current user",
        description: "Return the Figma user that authorized this connection.",
        httpMethod: "GET",
        pathTemplate: "/v1/me",
        riskLevel: "read",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "get_file",
        title: "Get file",
        description: "Fetch a Figma file by key.",
        httpMethod: "GET",
        pathTemplate: "/v1/files/{file_key}",
        riskLevel: "read",
        inputSchema: {
          type: "object",
          required: ["file_key"],
          properties: { file_key: { type: "string" } },
          additionalProperties: false,
        },
      },
    ],
  },
];

export const REST_PROVIDER_BY_KEY = new Map(
  REST_PROVIDERS.map((provider) => [provider.key, provider]),
);

export function oauthRecipeMetadata(
  recipe: RestProviderRecipe,
): Record<string, unknown> {
  return {
    oauth: {
      key: recipe.key,
      authorizationEndpoint: recipe.authorizationEndpoint,
      tokenEndpoint: recipe.tokenEndpoint,
      refreshUrl: recipe.refreshEndpoint ?? null,
      revocationEndpoint: recipe.revocationEndpoint ?? null,
      apiBaseUrl: recipe.apiBaseUrl,
      clientAuthMethod: recipe.clientAuthMethod,
      supportsPkce: recipe.supportsPkce,
      scopeSeparator: recipe.scopeSeparator,
      authorizationParams: recipe.authorizationParams,
      tokenParams: recipe.tokenParams,
    },
  };
}
