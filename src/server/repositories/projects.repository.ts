import { query, queryOne } from "@/server/db/pool";

// project sidebar / settings — full row shape
export type ProjectRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  system_prompt: string | null;
  color: string | null;
  icon: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function listProjects(userId: string) {
  return query<ProjectRow>(
    `select id, user_id, workspace_id, name, description, system_prompt,
            color, icon, status, created_at, updated_at
     from public.projects
     where user_id = $1 and status = 'active'
     order by updated_at desc`,
    [userId],
  );
}

export async function getProject(projectId: string, userId: string) {
  return queryOne<ProjectRow>(
    `select id, user_id, workspace_id, name, description, system_prompt,
            color, icon, status, created_at, updated_at
     from public.projects where id = $1 and user_id = $2 and status = 'active'`,
    [projectId, userId],
  );
}

export async function createProject(input: {
  userId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  workspaceId?: string | null;
}) {
  return queryOne<ProjectRow>(
    `insert into public.projects (user_id, workspace_id, name, description, color, icon)
     select $1::uuid, $2::uuid, $3, $4, $5, $6
     where $2::uuid is null
        or exists (
          select 1 from public.workspaces w
          where w.id = $2::uuid
            and (
              w.owner_id = $1::uuid
              or exists (
                select 1 from public.workspace_members wm
                where wm.workspace_id = w.id and wm.user_id = $1::uuid and wm.status = 'active'
              )
            )
        )
     returning id, user_id, workspace_id, name, description, system_prompt, color, icon, status, created_at, updated_at`,
    [
      input.userId,
      input.workspaceId ?? null, // personal project — workspace_id NULL
      input.name,
      input.description ?? null,
      input.color ?? null,
      input.icon ?? null,
    ],
  ); // unauthorized workspace_id → zero rows → null
}

export async function updateProject(
  projectId: string,
  userId: string,
  patch: {
    name?: string;
    description?: string;
    color?: string;
    system_prompt?: string | null;
    icon?: string;
  },
) {
  return queryOne<ProjectRow>(
    `update public.projects set
       name = coalesce($3, name),
       description = coalesce($4, description),
       color = coalesce($5, color),
       system_prompt = coalesce($6, system_prompt),
       icon = coalesce($7, icon),
       updated_at = now()
     where id = $1 and user_id = $2 and status = 'active'
     returning id, user_id, workspace_id, name, description, system_prompt, color, icon, status, created_at, updated_at`,
    [
      projectId,
      userId,
      patch.name ?? null,
      patch.description ?? null,
      patch.color ?? null,
      patch.system_prompt ?? null,
      patch.icon ?? null,
    ],
  );
}

export async function deleteProject(projectId: string, userId: string) {
  return queryOne<{ id: string }>(
    `update public.projects set status = 'deleted', updated_at = now()
     where id = $1 and user_id = $2 and status = 'active' returning id`,
    [projectId, userId],
  ); // already deleted or wrong owner → zero rows → null
}
