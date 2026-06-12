import { requireSession } from "@/backend/auth/require-session";
// SessionUser — authenticated user minimal profile (id, email, …)
import type { SessionUser } from "@/backend/auth/session";
// workspaces repository — default workspace, members, SSO, domains, SCIM tokens
import * as workspacesRepo from "@/backend/repositories/workspaces.repository";

export async function getCurrentWorkspace(session: SessionUser | null) {
  const user = requireSession(session);
  const workspace = await workspacesRepo.getDefaultWorkspaceForUser(user.id);
  return { workspace, userId: user.id };
}

export async function getCurrentWorkspaceMembers(session: SessionUser | null) {
  const user = requireSession(session);
  const workspace = await workspacesRepo.getDefaultWorkspaceForUser(user.id);
  if (!workspace) return { workspace: null, members: [] };

  const members = await workspacesRepo.listWorkspaceMembers(
    workspace.id,
    user.id,
  );
  return { workspace, members };
}

// listCurrentSsoConnections — enterprise SSO connections metadata (read)
export async function listCurrentSsoConnections(session: SessionUser | null) {
  const user = requireSession(session);
  const workspace = await workspacesRepo.getDefaultWorkspaceForUser(user.id);
  if (!workspace) return { workspace: null, connections: [] };

  const connections = await workspacesRepo.listSsoConnections(
    workspace.id,
    user.id,
  );
  return { workspace, connections };
}

// listCurrentWorkspaceDomains — verified custom domains for workspace
export async function listCurrentWorkspaceDomains(session: SessionUser | null) {
  const user = requireSession(session);
  const workspace = await workspacesRepo.getDefaultWorkspaceForUser(user.id);
  if (!workspace) return { workspace: null, domains: [] };

  const domains = await workspacesRepo.listWorkspaceDomains(
    workspace.id,
    user.id,
  );
  return { workspace, domains };
}

export async function listCurrentScimTokens(session: SessionUser | null) {
  const user = requireSession(session);
  const workspace = await workspacesRepo.getDefaultWorkspaceForUser(user.id);
  if (!workspace) return { workspace: null, tokens: [], stub: true as const };

  const tokens = await workspacesRepo.listScimTokens(workspace.id, user.id);
  return {
    workspace,
    tokens,
    stub: true as const,
    message:
      "SCIM provisioning API is not enabled yet. Token metadata is read-only.",
  };
}
