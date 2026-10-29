import { AppError } from "@/server/db/errors";
import * as projectsRepo from "@/server/repositories/projects.repository";

export const PROJECT_NAME_MAX = 120;
export const PROJECT_DESCRIPTION_MAX = 500;
export const PROJECT_INSTRUCTIONS_MAX = 8000;
export const PROJECT_NOTE_MAX = 2000;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export type ProjectBody = {
  name?: unknown;
  description?: unknown;
  iconId?: unknown;
  color?: unknown;
  instructions?: unknown;
  memory?: unknown;
  libraryAccess?: unknown;
  pinned?: unknown;
  archived?: unknown;
};

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max);
}

function flag(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** Shapes an untrusted request body into a repository patch. */
export function parseProjectPatch(
  body: ProjectBody,
): projectsRepo.ProjectPatch {
  const name = text(body.name, PROJECT_NAME_MAX);
  if (body.name !== undefined && !name) {
    throw new AppError("Project name cannot be empty.", 400);
  }

  const color = typeof body.color === "string" ? body.color : undefined;
  if (color !== undefined && !HEX_COLOR.test(color)) {
    throw new AppError("Project color must be a #rrggbb hex value.", 400);
  }

  const iconId = text(body.iconId, 40);

  return {
    name,
    description: text(body.description, PROJECT_DESCRIPTION_MAX),
    iconId: iconId || undefined,
    color,
    instructions:
      typeof body.instructions === "string"
        ? body.instructions.slice(0, PROJECT_INSTRUCTIONS_MAX)
        : undefined,
    memory:
      body.memory === "project" || body.memory === "default"
        ? body.memory
        : undefined,
    libraryAccess:
      body.libraryAccess === "enabled" || body.libraryAccess === "disabled"
        ? body.libraryAccess
        : undefined,
    pinned: flag(body.pinned),
    archived: flag(body.archived),
  };
}

export function mapProjectChat(row: projectsRepo.ProjectChatRow) {
  return {
    id: row.id,
    title: row.title || "New chat",
    preview: row.preview || "",
    pinned: row.starred,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export function mapProjectSource(row: projectsRepo.ProjectSourceRow) {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    name: row.original_name,
    kind:
      typeof metadata.kind === "string"
        ? metadata.kind
        : typeof metadata.sourceKind === "string"
          ? metadata.sourceKind
          : "file",
    mimeType: row.mime_type ?? "",
    size: Number(row.size_bytes) || 0,
    createdAt: row.created_at,
  };
}

export function mapProjectNote(row: projectsRepo.ProjectNoteRow) {
  return {
    id: row.id,
    body: row.summary,
    pinned: row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
