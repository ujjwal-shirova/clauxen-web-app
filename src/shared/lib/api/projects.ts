import { apiFetch } from "@/lib/api/client";

export type ProjectIcon = { id: string; color: string };
export type ProjectMemory = "default" | "project";
export type LibraryAccess = "enabled" | "disabled";
export type ProjectLifecycle = "active" | "archived";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  icon: ProjectIcon;
  instructions: string;
  memory: ProjectMemory;
  libraryAccess: LibraryAccess;
  pinned: boolean;
  archived: boolean;
  archivedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type ProjectListItem = ProjectSummary & {
  chatCount: number;
  sourceCount: number;
};

export type ProjectChat = {
  id: string;
  title: string;
  preview: string;
  pinned: boolean;
  updatedAt: string;
  createdAt: string;
};

export type ProjectSource = {
  id: string;
  name: string;
  kind: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type ProjectNote = {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = ProjectSummary & {
  chatCount: number;
  sourceCount: number;
  chats: ProjectChat[];
  sources: ProjectSource[];
  notes: ProjectNote[];
};

export type ProjectInput = {
  name: string;
  description?: string;
  iconId: string;
  color: string;
  instructions?: string;
  memory: ProjectMemory;
};

export type ProjectPatch = Partial<{
  name: string;
  description: string;
  iconId: string;
  color: string;
  instructions: string;
  memory: ProjectMemory;
  libraryAccess: LibraryAccess;
  pinned: boolean;
  archived: boolean;
}>;

const base = "/api/v1/projects";
const projectPath = (projectId: string) =>
  `${base}/${encodeURIComponent(projectId)}`;

export function listProjects(lifecycle: ProjectLifecycle = "active") {
  return apiFetch<{ projects: ProjectListItem[] }>(
    `${base}?lifecycle=${lifecycle}`,
  );
}

export function createProject(input: ProjectInput) {
  return apiFetch<{ project: ProjectSummary }>(base, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getProject(projectId: string) {
  return apiFetch<{ project: ProjectDetail }>(projectPath(projectId));
}

export function updateProject(projectId: string, patch: ProjectPatch) {
  return apiFetch<{ project: ProjectSummary }>(projectPath(projectId), {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteProject(projectId: string) {
  return apiFetch<{ ok: boolean }>(projectPath(projectId), { method: "DELETE" });
}

export function listProjectNotes(projectId: string) {
  return apiFetch<{ notes: ProjectNote[] }>(`${projectPath(projectId)}/memory`);
}

export function createProjectNote(projectId: string, body: string) {
  return apiFetch<{ note: ProjectNote }>(`${projectPath(projectId)}/memory`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function updateProjectNote(
  projectId: string,
  noteId: string,
  patch: { body?: string; pinned?: boolean },
) {
  return apiFetch<{ note: ProjectNote }>(
    `${projectPath(projectId)}/memory/${encodeURIComponent(noteId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

export function deleteProjectNote(projectId: string, noteId: string) {
  return apiFetch<{ ok: boolean }>(
    `${projectPath(projectId)}/memory/${encodeURIComponent(noteId)}`,
    { method: "DELETE" },
  );
}

export function getChatProject(chatId: string) {
  return apiFetch<{
    project: { id: string; name: string; icon: string | null; color: string | null } | null;
  }>(`/api/v1/chats/${encodeURIComponent(chatId)}/project`);
}
