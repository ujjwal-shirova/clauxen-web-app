export type ProjectsApiResponse<T> = {
  data: T | null;
  error: string | null;
};

export type Project = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  systemPrompt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectFile = {
  id: string;
  projectId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

export type Conversation = {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
};

export type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AuthUser = {
  id: string;
  email: string;
};

const TOKEN_KEY = "projects-auth-token";

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function projectsFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, { ...init, headers });
  const json = (await res.json()) as ProjectsApiResponse<T>;

  if (!res.ok || json.error) {
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }
  if (json.data === null) {
    throw new Error("Empty response.");
  }
  return json.data;
}

export async function register(email: string, password: string) {
  return projectsFetch<{ user: AuthUser; token: string }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
  );
}

export async function login(email: string, password: string) {
  return projectsFetch<{ user: AuthUser; token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function listProjects() {
  return projectsFetch<{ projects: Project[] }>("/api/projects");
}

export async function createProject(input: {
  name: string;
  description?: string;
}) {
  return projectsFetch<{ project: Project }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getProject(projectId: string) {
  return projectsFetch<{ project: Project }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
  );
}

export async function updateProject(
  projectId: string,
  patch: { name?: string; description?: string | null },
) {
  return projectsFetch<{ project: Project }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

export async function deleteProject(projectId: string) {
  return projectsFetch<{ ok: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    { method: "DELETE" },
  );
}

export async function updateInstructions(
  projectId: string,
  system_prompt: string,
) {
  return projectsFetch<{ project: Project }>(
    `/api/projects/${encodeURIComponent(projectId)}/instructions`,
    { method: "PATCH", body: JSON.stringify({ system_prompt }) },
  );
}

export async function listProjectFiles(projectId: string) {
  return projectsFetch<{ files: ProjectFile[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/files`,
  );
}

export async function uploadProjectFiles(projectId: string, files: File[]) {
  const token = getStoredToken();
  const form = new FormData();
  for (const file of files) form.append("files", file);
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/files`,
    { method: "POST", headers, body: form },
  );
  const json = (await res.json()) as ProjectsApiResponse<{ files: ProjectFile[] }>;
  if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed.");
  return json.data!;
}

export async function addTextContent(
  projectId: string,
  title: string,
  content: string,
) {
  return projectsFetch<{ file: ProjectFile }>(
    `/api/projects/${encodeURIComponent(projectId)}/files`,
    {
      method: "POST",
      body: JSON.stringify({ title, content }),
    },
  );
}

export async function deleteProjectFile(projectId: string, fileId: string) {
  return projectsFetch<{ ok: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
}

export async function getFileStatus(projectId: string, fileId: string) {
  return projectsFetch<{
    file: Pick<ProjectFile, "id" | "status" | "errorMessage">;
  }>(
    `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/status`,
  );
}

export async function retryFileIngestion(projectId: string, fileId: string) {
  return projectsFetch<{ ok: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/status`,
    { method: "POST" },
  );
}

export async function listConversations(projectId: string) {
  return projectsFetch<{ conversations: Conversation[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/conversations`,
  );
}

export async function createConversation(
  projectId: string,
  title?: string,
) {
  return projectsFetch<{ conversation: Conversation }>(
    `/api/projects/${encodeURIComponent(projectId)}/conversations`,
    {
      method: "POST",
      body: JSON.stringify(title ? { title } : {}),
    },
  );
}

export async function updateConversation(
  projectId: string,
  convId: string,
  patch: { title?: string; starred?: boolean; project_id?: string },
) {
  return projectsFetch<{ conversation: Conversation }>(
    `/api/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(convId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

export async function deleteConversation(projectId: string, convId: string) {
  return projectsFetch<{ ok: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(convId)}`,
    { method: "DELETE" },
  );
}

export async function listMessages(projectId: string, convId: string) {
  return projectsFetch<{ messages: Message[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(convId)}/messages`,
  );
}

export async function streamMessage(
  projectId: string,
  convId: string,
  content: string,
  options?: { model?: string; thinking_level?: string },
  onToken?: (token: string) => void,
): Promise<string> {
  const token = getStoredToken();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(convId)}/messages`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ content, ...options }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as ProjectsApiResponse<unknown>).error ?? "Stream request failed.",
    );
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body.");

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return fullText;
      try {
        const parsed = JSON.parse(payload) as {
          token?: string;
          error?: string;
        };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.token) {
          fullText += parsed.token;
          onToken?.(parsed.token);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== payload) throw e;
      }
    }
  }

  return fullText;
}
