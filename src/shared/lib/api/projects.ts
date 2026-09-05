import { apiFetch } from "@/lib/api/client";

export type ApiProject = {
  id: string;
  name: string;
  description: string | null;
  system_prompt?: string | null;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
};

export async function listProjects() {
  return apiFetch<{ projects: ApiProject[] }>("/api/v1/projects");
}

export async function getProject(projectId: string) {
  return apiFetch<{ project: ApiProject }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
  );
}

export async function updateProject(
  projectId: string,
  input: {
    name?: string;
    description?: string;
    color?: string;
    system_prompt?: string;
    icon?: string;
  },
) {
  return apiFetch<{ project: ApiProject }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function createProject(input: {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}) {
  return apiFetch<{ project: ApiProject }>("/api/v1/projects", {
    method: "POST",
    // JSON.stringify — request body serialize
    body: JSON.stringify(input),
  });
}

export async function deleteProject(projectId: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function linkChatToProject(projectId: string, chatId: string) {
  return apiFetch<{ chat: unknown }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/chats`,
    {
      method: "POST",
      // JSON.stringify — request body serialize
      body: JSON.stringify({ chatId }),
    },
  );
}

export type ApiProjectChat = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  starred: boolean;
  created_at: string;
  updated_at: string;
};

export async function listProjectChats(projectId: string) {
  return apiFetch<{ chats: ApiProjectChat[] }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/chats`,
  );
}
