import { queryOne } from "@/server/db/pool";
import * as projectsRepo from "@/server/repositories/projects.repository";

export async function loadProjectPromptAppend(userId: string, chatId: string) {
  try {
    return await loadProjectPromptAppendInner(userId, chatId);
  } catch (error) {
    console.error("[chat] project context failed:", error);
    return { text: "", projectOnly: false };
  }
}

async function loadProjectPromptAppendInner(userId: string, chatId: string) {
  // Owner-scoped project, file metadata and memory notes in one query, with a
  // fast empty result for ordinary chats that do not belong to a project.
  const project = await queryOne<
    projectsRepo.ProjectRow & {
      files: Array<{
        id: string;
        original_name: string;
        mime_type: string | null;
      }>;
      notes: Array<{ summary: string }>;
    }
  >(
    `select p.id, p.name, p.description, p.icon, p.color, p.system_prompt,
            p.memory_scope, p.library_access, p.pinned, p.status,
            p.archived_at, p.created_at, p.updated_at,
            coalesce((select jsonb_agg(f) from (
              select id, original_name, mime_type from public.user_files
              where user_id = $2 and project_id = p.id and status = 'uploaded'
                and coalesce(metadata->>'purpose', '') = 'project-source'
              order by created_at desc limit 20
            ) f), '[]'::jsonb) as files,
            coalesce((select jsonb_agg(n) from (
              select summary from public.user_memories
              where user_id = $2 and project_id = p.id and status = 'active'
              order by pinned desc, created_at desc limit 50
            ) n), '[]'::jsonb) as notes
     from public.chats c join public.projects p on p.id = c.project_id
     where c.id = $1 and c.user_id = $2 and c.status <> 'deleted'
       and p.user_id = $2 and p.status <> 'deleted'`,
    [chatId, userId],
  );
  if (!project) return { text: "", projectOnly: false };
  const mapped = projectsRepo.mapProject(project);

  const lines = [
    "Project context:",
    `Name: ${mapped.name}`,
    mapped.description.trim() ? `About: ${mapped.description.trim()}` : "",
    mapped.memory === "project"
      ? "Memory is limited to this project. Do not use memories from outside this project."
      : "This project may use memories from outside chats.",
    mapped.libraryAccess === "disabled"
      ? "Library access is disabled for this project. Do not read the user file library."
      : "",
    mapped.instructions.trim()
      ? `Instructions: ${mapped.instructions.trim()}`
      : "",
    project.notes.length
      ? [
          "Project memory:",
          ...project.notes.map((note) => `- ${note.summary}`),
        ].join("\n")
      : "",
    project.files.length
      ? [
          "Project files are stored. Call read_attachment with file_id. Do not assume their contents.",
          ...project.files.map(
            (file) =>
              `- ${file.original_name} file_id=${file.id} type=${file.mime_type || "file"}`,
          ),
        ].join("\n")
      : "",
  ].filter(Boolean);

  return { text: lines.join("\n"), projectOnly: mapped.memory === "project" };
}
