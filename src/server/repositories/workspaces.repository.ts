import { query, queryOne } from "@/server/db/pool"; // Postgres pool — SQL injection safe $1 placeholders

export type WorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  plan_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMemberRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string | null;
  created_at: string;
  email: string | null;
  display_name: string | null;
};

export type SsoConnectionRow = {
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

export type WorkspaceDomainRow = {
  id: string;
  workspace_id: string;
  domain: string;
  verified_at: string | null;
  created_at: string;
};

export type ScimTokenRow = {
  id: string;
  workspace_id: string;
  token_prefix: string;
  status: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export async function getDefaultWorkspaceForUser(userId: string) {
  const profile = await queryOne<{ default_workspace_id: string | null }>(
    `select default_workspace_id from public.profiles where id = $1`,
    [userId],
  );

  if (profile?.default_workspace_id) {
    const workspace = await getWorkspaceById(
      profile.default_workspace_id,
      userId,
    );
    if (workspace) return workspace;
  }

  return queryOne<WorkspaceRow>(
    `select w.id, w.name, w.slug, w.owner_id, w.plan_id, w.metadata, w.created_at, w.updated_at
     from public.workspaces w
     inner join public.workspace_members wm on wm.workspace_id = w.id
     where wm.user_id = $1 and wm.status = 'active'
     order by w.created_at asc
     limit 1`,
    [userId],
  );
}

async function canManageWorkspaceSettings(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const row = await queryOne<{ allowed: boolean }>(
    `select exists (
       select 1
       from public.workspaces w
       where w.id = $1
         and (
           w.owner_id = $2
           or exists (
             select 1 from public.workspace_members wm
             where wm.workspace_id = w.id
               and wm.user_id = $2
               and wm.status = 'active'
               and wm.role in ('owner', 'admin')
           )
         )
     ) as allowed`,
    [workspaceId, userId],
  );
  return row?.allowed ?? false;
}

export async function getWorkspaceById(workspaceId: string, userId: string) {
  return queryOne<WorkspaceRow>(
    `select w.id, w.name, w.slug, w.owner_id, w.plan_id, w.metadata, w.created_at, w.updated_at
     from public.workspaces w
     where w.id = $1
       and (
         w.owner_id = $2
         or exists (
           select 1 from public.workspace_members wm
           where wm.workspace_id = w.id and wm.user_id = $2 and wm.status = 'active'
         )
       )`,
    [workspaceId, userId],
  );
}

export async function listWorkspaceMembers(
  workspaceId: string,
  userId: string,
) {
  const allowed = await getWorkspaceById(workspaceId, userId);
  if (!allowed) return [];

  return query<WorkspaceMemberRow>(
    `select
       wm.id,
       wm.workspace_id,
       wm.user_id,
       wm.role,
       wm.status,
       wm.joined_at,
       wm.created_at,
       p.email,
       p.display_name
     from public.workspace_members wm
     left join public.profiles p on p.id = wm.user_id
     where wm.workspace_id = $1 and wm.status <> 'removed'
     order by wm.role asc, wm.created_at asc`,
    [workspaceId],
  );
}

export async function listSsoConnections(workspaceId: string, userId: string) {
  const allowed = await canManageWorkspaceSettings(workspaceId, userId);
  if (!allowed) return [];

  return query<SsoConnectionRow>(
    `select id, workspace_id, provider, issuer_url, metadata_url, entity_id, status, settings, created_at, updated_at
     from public.sso_connections
     where workspace_id = $1
     order by created_at desc`,
    [workspaceId],
  );
}

export async function listWorkspaceDomains(
  workspaceId: string,
  userId: string,
) {
  const allowed = await getWorkspaceById(workspaceId, userId);
  if (!allowed) return [];

  return query<WorkspaceDomainRow>(
    `select id, workspace_id, domain, verified_at, created_at
     from public.workspace_domains
     where workspace_id = $1
     order by created_at desc`,
    [workspaceId],
  );
}

export async function listScimTokens(workspaceId: string, userId: string) {
  const allowed = await canManageWorkspaceSettings(workspaceId, userId);
  if (!allowed) return [];

  return query<ScimTokenRow>(
    `select id, workspace_id, token_prefix, status, last_used_at, expires_at, created_at
     from public.scim_tokens
     where workspace_id = $1
     order by created_at desc`,
    [workspaceId],
  );
}
