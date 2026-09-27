import { query } from "@/server/db/pool";
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
  const link = await projectsRepo.getProjectForChat(chatId, userId);
  if (!link) return { text: "", projectOnly: false };

  const project = await projectsRepo.getProject(link.id, userId);
  if (!project) return { text: "", projectOnly: false };
  const mapped = projectsRepo.mapProject(project);

  const files = await query<{
    id: string;
    original_name: string;
    mime_type: string | null;
  }>(
    `select id, original_name, mime_type
     from public.user_files
     where user_id = $1 and project_id = $2
       and status = 'uploaded'
       and coalesce(metadata->>'purpose', '') = 'project-source'
     order by created_at desc
     limit 20`,
    [userId, project.id],
  );

  const lines = [
    "Project context:",
    `Name: ${mapped.name}`,
    mapped.memory === "project"
      ? "Memory is limited to this project. Do not use memories from outside this project."
      : "This project may use memories from outside chats.",
    mapped.instructions.trim()
      ? `Instructions: ${mapped.instructions.trim()}`
      : "",
    files.length
      ? [
          "Project files are stored. Call read_attachment with file_id. Do not assume their contents.",
          ...files.map(
            (file) =>
              `- ${file.original_name} file_id=${file.id} type=${file.mime_type || "file"}`,
          ),
        ].join("\n")
      : "",
  ].filter(Boolean);

  return { text: lines.join("\n"), projectOnly: mapped.memory === "project" };
}
