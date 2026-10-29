import { query, queryOne } from "@/server/db/pool";

export type ProjectMemoryScope = "default" | "project";
export type LibraryAccess = "enabled" | "disabled";
export type ProjectLifecycle = "active" | "archived";

const PROJECT_COLUMNS = `id, name, description, icon, color, system_prompt,
       memory_scope, library_access, pinned, status, archived_at,
       created_at, updated_at`;

const PROJECT_COLUMNS_P = `p.id, p.name, p.description, p.icon, p.color,
       p.system_prompt, p.memory_scope, p.library_access, p.pinned, p.status,
       p.archived_at, p.created_at, p.updated_at`;

export type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  system_prompt: string | null;
  memory_scope: string;
  library_access: string;
  pinned: boolean;
  status: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectRowWithCounts = ProjectRow & {
  chat_count: number;
  source_count: number;
};

export type ProjectChatRow = {
  id: string;
  title: string;
  preview: string | null;
  starred: boolean;
  updated_at: string;
  created_at: string;
};

export type ProjectSourceRow = {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type ProjectNoteRow = {
  id: string;
  summary: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export function mapProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    icon: {
      id: row.icon || "folder",
      color: row.color || "#14151a",
    },
    instructions: row.system_prompt ?? "",
    memory: row.memory_scope === "project" ? "project" : "default",
    libraryAccess: row.library_access === "disabled" ? "disabled" : "enabled",
    pinned: row.pinned,
    archived: row.status === "archived",
    archivedAt: row.archived_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  } as const;
}

export function mapProjectWithCounts(row: ProjectRowWithCounts) {
  return {
    ...mapProject(row),
    chatCount: Number(row.chat_count) || 0,
    sourceCount: Number(row.source_count) || 0,
  };
}

/**
 * Gallery read path. Counts are subqueries rather than joins so a project with
 * no chats still returns one row and the pinned/updated ordering stays on the
 * `projects_owner_browse_idx` index.
 */
export async function listProjects(
  userId: string,
  lifecycle: ProjectLifecycle = "active",
) {
  return query<ProjectRowWithCounts>(
    `select ${PROJECT_COLUMNS_P},
            (
              select count(*) from public.chats c
              where c.project_id = p.id and c.user_id = $1
                and c.status <> 'deleted' and c.archived_at is null
            ) as chat_count,
            (
              select count(*) from public.user_files f
              where f.project_id = p.id and f.user_id = $1
                and f.status not in ('deleted', 'failed')
            ) as source_count
     from public.projects p
     where p.user_id = $1 and p.status = $2
     order by p.pinned desc, p.updated_at desc
     limit 200`,
    [userId, lifecycle],
  );
}

export async function getProject(projectId: string, userId: string) {
  return queryOne<ProjectRow>(
    `select ${PROJECT_COLUMNS}
     from public.projects
     where id = $1 and user_id = $2 and status <> 'deleted'`,
    [projectId, userId],
  );
}

export async function createProject(input: {
  userId: string;
  name: string;
  description: string;
  iconId: string;
  color: string;
  instructions: string;
  memory: ProjectMemoryScope;
}) {
  return queryOne<ProjectRow>(
    `insert into public.projects (
       user_id, workspace_id, name, description, icon, color,
       system_prompt, memory_scope, library_access, pinned, status
     )
     select
       $1,
       (select default_workspace_id from public.profiles where id = $1 limit 1),
       $2, nullif($3, ''), $4, $5, nullif($6, ''), $7, 'enabled', false, 'active'
     returning ${PROJECT_COLUMNS}`,
    [
      input.userId,
      input.name,
      input.description,
      input.iconId,
      input.color,
      input.instructions,
      input.memory,
    ],
  );
}

export type ProjectPatch = {
  name?: string;
  description?: string;
  iconId?: string;
  color?: string;
  instructions?: string;
  memory?: ProjectMemoryScope;
  libraryAccess?: LibraryAccess;
  pinned?: boolean;
  archived?: boolean;
};

/**
 * Builds a partial UPDATE so an untouched field is never rewritten — two
 * concurrent dashboard edits (say instructions and pin) cannot clobber each
 * other the way a read-modify-write of every column would.
 */
export async function updateProject(
  projectId: string,
  userId: string,
  patch: ProjectPatch,
) {
  const sets: string[] = [];
  const values: unknown[] = [projectId, userId];

  const assign = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (patch.name !== undefined) assign("name", patch.name);
  if (patch.description !== undefined) {
    assign("description", patch.description || null);
  }
  if (patch.iconId !== undefined) assign("icon", patch.iconId);
  if (patch.color !== undefined) assign("color", patch.color);
  if (patch.instructions !== undefined) {
    assign("system_prompt", patch.instructions || null);
  }
  if (patch.memory !== undefined) assign("memory_scope", patch.memory);
  if (patch.libraryAccess !== undefined) {
    assign("library_access", patch.libraryAccess);
  }
  if (patch.pinned !== undefined) assign("pinned", patch.pinned);
  if (patch.archived !== undefined) {
    assign("status", patch.archived ? "archived" : "active");
    assign("archived_at", patch.archived ? new Date().toISOString() : null);
  }

  if (!sets.length) return getProject(projectId, userId);

  return queryOne<ProjectRow>(
    `update public.projects set ${sets.join(", ")}, updated_at = now()
     where id = $1 and user_id = $2 and status <> 'deleted'
     returning ${PROJECT_COLUMNS}`,
    values,
  );
}

export async function deleteProject(projectId: string, userId: string) {
  return queryOne<{ id: string }>(
    `update public.projects
     set status = 'deleted', updated_at = now()
     where id = $1 and user_id = $2 and status <> 'deleted'
     returning id`,
    [projectId, userId],
  );
}

export async function listProjectChats(projectId: string, userId: string) {
  return query<ProjectChatRow>(
    `select c.id, c.title, c.starred, c.updated_at, c.created_at,
       (
         select left(coalesce(m.preview, m.content, ''), 160)
         from public.chat_messages m
         where m.chat_id = c.id and m.role = 'user'
         order by m.created_at asc
         limit 1
       ) as preview
     from public.chats c
     where c.project_id = $1
       and c.user_id = $2
       and c.status <> 'deleted'
       and c.archived_at is null
     order by c.starred desc, c.updated_at desc
     limit 200`,
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
     limit 200`,
    [userId, projectId],
  );
}

export async function getProjectForChat(chatId: string, userId: string) {
  return queryOne<{ id: string; name: string; icon: string | null; color: string | null }>(
    `select p.id, p.name, p.icon, p.color
     from public.chats c
     join public.projects p on p.id = c.project_id
     where c.id = $1 and c.user_id = $2 and p.user_id = $2 and p.status <> 'deleted'`,
    [chatId, userId],
  );
}

/** Project name for the server-rendered document title. */
export async function getProjectName(projectId: string, userId: string) {
  const row = await queryOne<{ name: string }>(
    `select name from public.projects
     where id = $1 and user_id = $2 and status <> 'deleted'`,
    [projectId, userId],
  );
  return row?.name ?? null;
}

// -----------------------------------------------------------------------------
// Project memory notes — rows in public.user_memories scoped by project_id.
// -----------------------------------------------------------------------------

export async function listProjectNotes(projectId: string, userId: string) {
  return query<ProjectNoteRow>(
    `select id, summary, pinned, created_at, updated_at
     from public.user_memories
     where project_id = $1 and user_id = $2 and status = 'active'
     order by pinned desc, created_at desc
     limit 200`,
    [projectId, userId],
  );
}

export async function createProjectNote(input: {
  projectId: string;
  userId: string;
  summary: string;
}) {
  return queryOne<ProjectNoteRow>(
    `insert into public.user_memories (
       user_id, workspace_id, project_id, memory_type, summary, confidence, status
     )
     select $2,
       (select workspace_id from public.projects where id = $1 and user_id = $2),
       $1, 'project-note', $3, 1.0, 'active'
     where exists (
       select 1 from public.projects
       where id = $1 and user_id = $2 and status <> 'deleted'
     )
     returning id, summary, pinned, created_at, updated_at`,
    [input.projectId, input.userId, input.summary],
  );
}

export async function updateProjectNote(input: {
  projectId: string;
  noteId: string;
  userId: string;
  summary?: string;
  pinned?: boolean;
}) {
  return queryOne<ProjectNoteRow>(
    `update public.user_memories set
       summary = coalesce($4, summary),
       pinned = coalesce($5, pinned),
       updated_at = now()
     where id = $3 and project_id = $1 and user_id = $2 and status = 'active'
     returning id, summary, pinned, created_at, updated_at`,
    [
      input.projectId,
      input.userId,
      input.noteId,
      input.summary ?? null,
      input.pinned ?? null,
    ],
  );
}

export async function deleteProjectNote(input: {
  projectId: string;
  noteId: string;
  userId: string;
}) {
  return queryOne<{ id: string }>(
    `update public.user_memories
     set status = 'deleted', updated_at = now()
     where id = $3 and project_id = $1 and user_id = $2 and status = 'active'
     returning id`,
    [input.projectId, input.userId, input.noteId],
  );
}
