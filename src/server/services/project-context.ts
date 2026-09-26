import { getObject } from "@/server/storage/object-store";
import type { StoragePurpose } from "@/server/storage/object-store";
import { query } from "@/server/db/pool";
import { extractTextFromBuffer } from "@/server/services/text-extract.service";
import * as projectsRepo from "@/server/repositories/projects.repository";

const EXTRACT_BUDGET_MS = 1200;
const MAX_FILES = 4;
const MAX_CHARS = 6000;

function purposeFor(mime: string | null, bucket: string): StoragePurpose {
  if (bucket.includes("attachment") || mime?.startsWith("video/")) return "attachments";
  if (mime?.startsWith("image/")) return "images";
  return "documents";
}

export async function loadProjectPromptAppend(userId: string, chatId: string) {
  const link = await projectsRepo.getProjectForChat(chatId, userId);
  if (!link) return { text: "", projectOnly: false };

  const project = await projectsRepo.getProject(link.id, userId);
  if (!project) return { text: "", projectOnly: false };
  const mapped = projectsRepo.mapProject(project);

  const files = await query<{
    original_name: string;
    mime_type: string | null;
    size_bytes: number;
    storage_bucket: string;
    storage_path: string;
  }>(
    `select original_name, mime_type, size_bytes, storage_bucket, storage_path
     from public.user_files
     where user_id = $1 and project_id = $2
       and status = 'uploaded'
       and coalesce(metadata->>'purpose', '') = 'project-source'
     order by created_at desc
     limit $3`,
    [userId, project.id, MAX_FILES],
  );

  const extracted = await Promise.race([
    Promise.all(
      files.map(async (file) => {
        if (file.mime_type?.startsWith("image/")) {
          return `${file.original_name}: image source`;
        }
        if (Number(file.size_bytes) > 1_500_000) {
          return `${file.original_name}: file is large; use it by name`;
        }
        try {
          const bytes = await getObject(
            purposeFor(file.mime_type, file.storage_bucket),
            file.storage_path,
            file.storage_bucket,
          );
          const text = await extractTextFromBuffer(bytes, file.original_name);
          const clipped = text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
          return clipped
            ? `${file.original_name}:\n${clipped}`
            : `${file.original_name}: no readable text`;
        } catch {
          return `${file.original_name}: unavailable`;
        }
      }),
    ),
    new Promise<string[]>((resolve) => {
      setTimeout(() => resolve([]), EXTRACT_BUDGET_MS);
    }),
  ]);

  const lines = [
    "<project>",
    `Name: ${mapped.name}`,
    mapped.memory === "project"
      ? "Memory: project-only. Do not use memories from outside this project, and do not write this project's details into outside memory."
      : "Memory: default. This project may use memories from outside chats.",
    mapped.instructions.trim()
      ? `Instructions:\n${mapped.instructions.trim()}`
      : "",
    extracted.length
      ? `Sources:\n${extracted.join("\n\n")}`
      : files.length
        ? `Sources: ${files.map((file) => file.original_name).join(", ")}`
        : "",
    "</project>",
  ].filter(Boolean);

  return { text: lines.join("\n"), projectOnly: mapped.memory === "project" };
}
