import { apiFetch } from "@/lib/api/client";

export type Workspace = {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  plan_id: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ApiWorkspace = Workspace;

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string | null;
  created_at?: string;
  email: string | null;
  display_name: string | null;
};

export type ApiWorkspaceMember = WorkspaceMember;

export type SsoConnection = {
  id: string;
  workspace_id: string;
  provider: string;
  issuer_url: string | null;
  metadata_url: string | null;
  entity_id: string | null;
  status: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WorkspaceDomain = {
  id: string;
  workspace_id: string;
  domain: string;
  verified_at: string | null;
  created_at: string;
};

export async function getCurrentWorkspace() {
  return apiFetch<{ workspace: Workspace | null; userId: string }>(
    "/api/v1/workspaces/current",
  );
}

export async function getWorkspaceMembers() {
  return apiFetch<{ workspace: Workspace | null; members: WorkspaceMember[] }>(
    "/api/v1/workspaces/members",
  );
}

export async function getSsoConnections() {
  return apiFetch<{
    workspace: Workspace | null;
    connections: SsoConnection[];
  }>("/api/v1/workspaces/sso-connections");
}

export async function getWorkspaceDomains() {
  return apiFetch<{ workspace: Workspace | null; domains: WorkspaceDomain[] }>(
    "/api/v1/workspaces/domains",
  );
}

export async function getScimTokens() {
  return apiFetch<{
    workspace: Workspace | null;
    tokens: unknown[];
    stub?: boolean;
    message?: string;
  }>("/api/v1/workspaces/scim-tokens");
}
