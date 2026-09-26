import { query, queryOne } from "@/server/db/pool";

export type ProjectMemory = "default" | "project";
export type LibraryAccess = "enabled" | "disabled";

export type ProjectRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  system_prompt: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
  created_at: string;
};

export type ProjectChatRow = {
  id: string;
  title: string;
  preview: string | null;
  starred: boolean;
  updated_at: string;
};

export type ProjectSourceRow = {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
  metadata: Record<string, unknown>;
};

function metaString(metadata: Record<string, unknown>, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

export function mapProject(row: ProjectRow) {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    name: row.name,
    icon: {
      id: row.icon || metaString(metadata, "iconId") || "folder",
      color: row.color || "#14151a",
    },
    instructions: row.system_prompt ?? "",
    memory: metaString(metadata, "memory") === "project" ? "project" : "default",
    libraryAccess:
      metaString(metadata, "libraryAccess") === "disabled" ? "disabled" : "enabled",
    pinned: metadata.pinned === true,
    shared: metadata.shared === true,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export async function listProjects(userId: string) {
  return query<ProjectRow>(
    `select id, name, icon, color, system_prompt, metadata, created_at, updated_at
     from public.projects
     where user_id = $1 and status = 'active'
     order by updated_at desc
     limit 100`,
    [userId],
  );
}

export async function getProject(projectId: string, userId: string) {
  return queryOne<ProjectRow>(
    `select id, name, icon, color, system_prompt, metadata, created_at, updated_at
     from public.projects
     where id = $1 and user_id = $2 and status = 'active'`,
    [projectId, userId],
  );
}

export async function createProject(input: {
  userId: string;
  name: string;
  iconId: string;
  color: string;
  memory: ProjectMemory;
}) {
  return queryOne<ProjectRow>(
    `insert into public.projects (
       user_id, name, icon, color, status, metadata, workspace_id
     )
     select
       $1, $2, $3, $4, 'active', $5::jsonb,
       (select default_workspace_id from public.profiles where id = $1 limit 1)
     returning id, name, icon, color, system_prompt, metadata, created_at, updated_at`,
    [
      input.userId,
      input.name,
      input.iconId,
      input.color,
      JSON.stringify({ memory: input.memory, libraryAccess: "enabled", pinned: false }),
    ],
  );
}

export async function updateProject(
  projectId: string,
  userId: string,
  patch: {
    name?: string;
    iconId?: string;
    color?: string;
    instructions?: string;
    memory?: ProjectMemory;
    libraryAccess?: LibraryAccess;
    pinned?: boolean;
  },
) {
  const current = await getProject(projectId, userId);
  if (!current) return null;
  const metadata = {
    ...(current.metadata ?? {}),
    ...(patch.memory ? { memory: patch.memory } : {}),
    ...(patch.libraryAccess ? { libraryAccess: patch.libraryAccess } : {}),
    ...(patch.pinned === undefined ? {} : { pinned: patch.pinned }),
  };
  return queryOne<ProjectRow>(
    `update public.projects set
       name = $3,
       icon = $4,
       color = $5,
       system_prompt = $6,
       metadata = $7::jsonb,
       updated_at = now()
     where id = $1 and user_id = $2 and status = 'active'
     returning id, name, icon, color, system_prompt, metadata, created_at, updated_at`,
    [
      projectId,
      userId,
      patch.name ?? current.name,
      patch.iconId ?? current.icon,
      patch.color ?? current.color,
      patch.instructions === undefined ? current.system_prompt : patch.instructions,
      JSON.stringify(metadata),
    ],
  );
}

export async function deleteProject(projectId: string, userId: string) {
  return queryOne<{ id: string }>(
    `update public.projects
     set status = 'deleted', updated_at = now()
     where id = $1 and user_id = $2 and status = 'active'
     returning id`,
    [projectId, userId],
  );
}

export async function listProjectChats(projectId: string, userId: string) {
  return query<ProjectChatRow>(
    `select c.id, c.title, c.starred, c.updated_at,
       (
         select left(coalesce(m.content, ''), 160)
         from public.chat_messages m
         where m.chat_id = c.id and m.role = 'user'
         order by m.created_at asc
         limit 1
       ) as preview
     from public.chats c
     where c.project_id = $1
       and c.user_id = $2
       and c.status != 'deleted'
       and c.archived_at is null
     order by c.starred desc, c.updated_at desc
     limit 100`,
    [projectId, userId],
  );
}

export async function listProjectSources(projectId: string, userId: string) {
  return query<ProjectSourceRow>(
    `select id, original_name, mime_type, size_bytes, created_at, metadata
     from public.user_files
     where user_id = $1
       and project_id = $2
       and status not in ('deleted', 'failed')
       and coalesce(metadata->>'purpose', '') = 'project-source'
     order by created_at desc
     limit 100`,
    [userId, projectId],
  );
}

export async function getProjectForChat(chatId: string, userId: string) {
  return queryOne<{ id: string; name: string }>(
    `select p.id, p.name
     from public.chats c
     join public.projects p on p.id = c.project_id
     where c.id = $1 and c.user_id = $2 and p.user_id = $2 and p.status = 'active'`,
    [chatId, userId],
  );
}
