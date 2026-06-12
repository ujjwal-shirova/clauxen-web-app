import { query, queryOne } from "@/backend/db/pool";

// project sidebar / settings — full row shape
export type ProjectRow = {
  id: string;
  user_id: string;
  workspace_id: string | null; // optional team workspace link
  name: string;
  description: string | null;
  color: string | null; // UI accent
  icon: string | null;
  status: string; // active | deleted
  created_at: string;
  updated_at: string;
};

export async function listProjects(userId: string) {
  return query<ProjectRow>(
    `select id, user_id, workspace_id, name, description, color, icon, status, created_at, updated_at
     from public.projects
     where user_id = $1 and status = 'active'
     order by updated_at desc`,
    [userId],
  ); // $1 owner id — cross-user leak impossible
}

// single project by id — owner match required
export async function getProject(projectId: string, userId: string) {
  return queryOne<ProjectRow>(
    `select id, user_id, workspace_id, name, description, color, icon, status, created_at, updated_at
     from public.projects where id = $1 and user_id = $2 and status = 'active'`,
    [projectId, userId],
  );
}

export async function createProject(input: {
  userId: string;
  name: string;
  description?: string;
  color?: string;
  workspaceId?: string | null;
}) {
  return queryOne<ProjectRow>(
    `insert into public.projects (user_id, workspace_id, name, description, color)
     select $1, $2, $3, $4, $5
     where $2 is null
        or exists (
          select 1 from public.workspaces w
          where w.id = $2
            and (
              w.owner_id = $1
              or exists (
                select 1 from public.workspace_members wm
                where wm.workspace_id = w.id and wm.user_id = $1 and wm.status = 'active'
              )
            )
        )
     returning id, user_id, workspace_id, name, description, color, icon, status, created_at, updated_at`,
    [
      input.userId,
      input.workspaceId ?? null, // personal project — workspace_id NULL
      input.name,
      input.description ?? null,
      input.color ?? null,
    ],
  ); // unauthorized workspace_id → zero rows → null
}

export async function updateProject(
  projectId: string,
  userId: string,
  patch: { name?: string; description?: string; color?: string },
) {
  return queryOne<ProjectRow>(
    `update public.projects set
       name = coalesce($3, name),
       description = coalesce($4, description),
       color = coalesce($5, color),
       updated_at = now()
     where id = $1 and user_id = $2 and status = 'active'
     returning id, user_id, workspace_id, name, description, color, icon, status, created_at, updated_at`,
    [
      projectId,
      userId,
      patch.name ?? null,
      patch.description ?? null,
      patch.color ?? null,
    ],
  ); // wrong owner or deleted → zero rows → null
}

export async function deleteProject(projectId: string, userId: string) {
  return queryOne<{ id: string }>(
    `update public.projects set status = 'deleted', updated_at = now()
     where id = $1 and user_id = $2 and status = 'active' returning id`,
    [projectId, userId],
  ); // already deleted or wrong owner → zero rows → null
}
