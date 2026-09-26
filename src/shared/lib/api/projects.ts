import { apiFetch } from "@/lib/api/client";

export type ProjectIcon = { id: string; color: string };
export type ProjectMemory = "default" | "project";
export type LibraryAccess = "enabled" | "disabled";

export type ProjectSummary = {
  id: string;
  name: string;
  icon: ProjectIcon;
  instructions: string;
  memory: ProjectMemory;
  libraryAccess: LibraryAccess;
  pinned: boolean;
  shared: boolean;
  updatedAt: string;
  createdAt: string;
};

export type ProjectChat = {
  id: string;
  title: string;
  preview: string;
  pinned: boolean;
  updatedAt: string;
};

export type ProjectSource = {
  id: string;
  name: string;
  kind: string;
  size: number;
  createdAt: string;
};

export type ProjectDetail = ProjectSummary & {
  chats: ProjectChat[];
  sources: ProjectSource[];
};

export function listProjects() {
  return apiFetch<{ projects: ProjectSummary[] }>("/api/v1/projects");
}

export function createProject(input: {
  name: string;
  iconId: string;
  color: string;
  memory: ProjectMemory;
}) {
  return apiFetch<{ project: ProjectSummary }>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getProject(projectId: string) {
  return apiFetch<{ project: ProjectDetail }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
  );
}

export function updateProject(
  projectId: string,
  patch: Partial<{
    name: string;
    iconId: string;
    color: string;
    instructions: string;
    memory: ProjectMemory;
    libraryAccess: LibraryAccess;
    pinned: boolean;
  }>,
) {
  return apiFetch<{ project: ProjectSummary }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

export function deleteProject(projectId: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
    { method: "DELETE" },
  );
}

export function getChatProject(chatId: string) {
  return apiFetch<{ project: { id: string; name: string } | null }>(
    `/api/v1/chats/${encodeURIComponent(chatId)}/project`,
  );
}
