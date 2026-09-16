import { resolvePluginLogo } from "@/connectors/catalog/local-icons";
import type { PluginCatalogItem, PluginSummary } from "@/connectors/catalog/types";
import { REST_PROVIDERS, type RestProviderRecipe } from "@/connectors/server/rest-providers";

type RestAbout = {
  shortDescription: string;
  longDescription: string;
  websiteUrl: string;
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
  developer: string;
  category: string;
  categories: string[];
  brandColor: string;
  defaultPrompts: string[];
  keywords: string[];
};

const ABOUT: Record<string, RestAbout> = {
  github: {
    shortDescription: "Repos, issues, and pull requests in chat",
    longDescription:
      "Connect GitHub so Clauxen can list your repositories, read issues, search pull requests, and open new issues on your behalf.\n\nAuthorization happens on GitHub. Clauxen’s Cloudflare gateway exchanges the code, seals the token, and stores it in Supabase. The agent then calls GitHub’s own API — nothing is routed through a third-party connector cloud.",
    websiteUrl: "https://github.com",
    privacyPolicyUrl: "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement",
    termsOfServiceUrl: "https://docs.github.com/site-policy/github-terms/github-terms-of-service",
    developer: "GitHub",
    category: "developer-tools",
    categories: ["clauxen-apps", "featured", "developer-tools"],
    brandColor: "#24292f",
    defaultPrompts: [
      "List my GitHub repositories",
      "Show open issues in my main repo",
      "Create a GitHub issue titled Fix login timeout",
    ],
    keywords: ["github", "git", "repos", "issues", "pull requests"],
  },
  slack: {
    shortDescription: "Channels, people, and messages",
    longDescription:
      "Connect Slack so Clauxen can list channels, look up people in your workspace, and post messages you confirm.\n\nYou sign in on Slack. Clauxen keeps the token sealed in Supabase and talks to Slack’s API directly.",
    websiteUrl: "https://slack.com",
    privacyPolicyUrl: "https://slack.com/trust/privacy/privacy-policy",
    termsOfServiceUrl: "https://slack.com/terms-of-service",
    developer: "Slack",
    category: "communication",
    categories: ["clauxen-apps", "featured", "communication"],
    brandColor: "#4a154b",
    defaultPrompts: [
      "List Slack channels I can see",
      "Find people in this Slack workspace",
      "Draft a Slack update for #general",
    ],
    keywords: ["slack", "chat", "channels", "messages", "workspace"],
  },
  notion: {
    shortDescription: "Search pages and databases",
    longDescription:
      "Connect Notion so Clauxen can search your workspace and open pages you already have access to.\n\nNotion’s OAuth screen shows Clauxen. Tokens stay in our vault; page content is fetched from Notion’s API when you ask.",
    websiteUrl: "https://www.notion.so",
    privacyPolicyUrl: "https://www.notion.so/help/privacy",
    termsOfServiceUrl: "https://www.notion.so/help/terms-and-privacy",
    developer: "Notion",
    category: "productivity",
    categories: ["clauxen-apps", "featured", "productivity"],
    brandColor: "#111111",
    defaultPrompts: [
      "Search my Notion workspace for the launch brief",
      "Open the Notion page for this project",
    ],
    keywords: ["notion", "wiki", "docs", "database", "pages"],
  },
  gmail: {
    shortDescription: "Read and send mail",
    longDescription:
      "Connect Gmail so Clauxen can list messages, open a thread, and help you send mail you confirm.\n\nGoogle’s consent screen names Clauxen. Mail never sits in a broker; the gateway calls Gmail’s API with a sealed token.",
    websiteUrl: "https://mail.google.com",
    privacyPolicyUrl: "https://policies.google.com/privacy",
    termsOfServiceUrl: "https://policies.google.com/terms",
    developer: "Google",
    category: "communication",
    categories: ["clauxen-apps", "featured", "communication"],
    brandColor: "#ea4335",
    defaultPrompts: [
      "List my unread Gmail messages",
      "Open the latest email from a teammate",
    ],
    keywords: ["gmail", "email", "inbox", "google mail"],
  },
  "google-drive": {
    shortDescription: "Find and open Drive files",
    longDescription:
      "Connect Google Drive so Clauxen can list files and fetch metadata for documents you already can access.\n\nYou authorize Clauxen on Google. The worker stores a sealed refresh token and calls Drive’s API directly.",
    websiteUrl: "https://drive.google.com",
    privacyPolicyUrl: "https://policies.google.com/privacy",
    termsOfServiceUrl: "https://policies.google.com/terms",
    developer: "Google",
    category: "productivity",
    categories: ["clauxen-apps", "featured", "productivity"],
    brandColor: "#0f9d58",
    defaultPrompts: [
      "List recent files in Google Drive",
      "Find the Google Drive doc about onboarding",
    ],
    keywords: ["google drive", "docs", "files", "sheets"],
  },
  figma: {
    shortDescription: "Open files and inspect designs",
    longDescription:
      "Connect Figma so Clauxen can identify you and fetch a file by key when you need design context in chat.\n\nFigma’s OAuth screen shows Clauxen. File JSON comes from Figma’s API after you authorize.",
    websiteUrl: "https://www.figma.com",
    privacyPolicyUrl: "https://www.figma.com/privacy/",
    termsOfServiceUrl: "https://www.figma.com/tos/",
    developer: "Figma",
    category: "creativity",
    categories: ["clauxen-apps", "featured", "creativity", "developer-tools"],
    brandColor: "#0d0c0a",
    defaultPrompts: [
      "Who am I on Figma?",
      "Open this Figma file and summarize the screens",
    ],
    keywords: ["figma", "design", "ui", "files"],
  },
};

function toCatalogItem(recipe: RestProviderRecipe): PluginCatalogItem {
  const about = ABOUT[recipe.key];
  const displayName = recipe.name;
  const shortDescription =
    about?.shortDescription || `Connect ${displayName} to Clauxen.`;
  const longDescription =
    about?.longDescription ||
    `Add ${displayName} to Clauxen. You authorize on ${displayName}; Cloudflare handles the OAuth exchange and seals the token in Supabase.`;
  return {
    id: recipe.key,
    name: recipe.key,
    displayName,
    description: shortDescription,
    shortDescription,
    longDescription,
    version: "",
    developer: about?.developer || displayName,
    category: about?.category || "other",
    capabilities: recipe.capabilities,
    websiteUrl: about?.websiteUrl || recipe.documentationUrl,
    privacyPolicyUrl: about?.privacyPolicyUrl || "",
    termsOfServiceUrl: about?.termsOfServiceUrl || "",
    defaultPrompts: about?.defaultPrompts || [
      `Use ${displayName} from this chat`,
    ],
    keywords: about?.keywords || [recipe.key, displayName.toLowerCase()],
    logoUrl: resolvePluginLogo({
      displayName,
      name: recipe.key,
      logoUrl: "",
    }),
    brandColor: about?.brandColor || "",
    requiresLocalExecutor: false,
    sourceUrl: recipe.documentationUrl,
    categories: about?.categories || ["clauxen-apps", recipe.capabilities[0] || "other"],
    directoryDescription: shortDescription,
    captureStatus: "detail-api",
    mcpUrl: "",
    kind: "rest",
    scopes: recipe.scopes,
    tools: recipe.tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
    })),
    documentationUrl: recipe.documentationUrl,
  };
}

export const REST_CONNECTORS: PluginCatalogItem[] = REST_PROVIDERS.map(
  toCatalogItem,
);

export const REST_CONNECTOR_BY_ID = new Map(
  REST_CONNECTORS.map((item) => [item.id, item]),
);

export const REST_CONNECTOR_IDS = new Set(REST_CONNECTORS.map((item) => item.id));

export const CLAUXEN_APPS_CATEGORY = {
  slug: "clauxen-apps",
  title: "Apps",
  description:
    "First-party Clauxen OAuth apps. Add one, authorize on the provider, then use it in chat.",
  searchPlaceholder: "Search apps",
  count: REST_CONNECTORS.length,
};

export function isRestConnectorId(id: string): boolean {
  return REST_CONNECTOR_IDS.has(id);
}

export function getRestConnector(segment: string): PluginCatalogItem | null {
  const decoded = decodeURIComponent(segment).trim().toLowerCase();
  return REST_CONNECTOR_BY_ID.get(decoded) ?? null;
}

export function restConnectorSummary(
  item: PluginCatalogItem,
): PluginSummary {
  return {
    id: item.id,
    name: item.name,
    displayName: item.displayName,
    description: item.shortDescription || item.description,
    shortDescription: item.shortDescription,
    logoUrl: item.logoUrl,
    brandColor: item.brandColor,
    categories: item.categories,
    captureStatus: item.captureStatus,
    kind: "rest",
  };
}

export function listRestConnectorSummaries(): PluginSummary[] {
  return REST_CONNECTORS.map(restConnectorSummary);
}

export function matchRestConnectors(query: string): PluginCatalogItem[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return REST_CONNECTORS;
  return REST_CONNECTORS.filter((item) =>
    [
      item.displayName,
      item.name,
      item.description,
      item.shortDescription,
      item.developer,
      ...(item.keywords || []),
      ...(item.categories || []),
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(q),
  );
}
