export type ProjectMemory = "default" | "project";
export type LibraryAccess = "enabled" | "disabled";

export type ProjectIcon = {
  id: string;
  color: string;
};

export type ProjectChat = {
  id: string;
  title: string;
  preview: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSourceKind = "file" | "text" | "library" | "drive" | "slack";

export type ProjectSource = {
  id: string;
  name: string;
  kind: ProjectSourceKind;
  body?: string;
  size?: number;
  createdAt: string;
};

export type ProjectDraft = {
  id: string;
  name: string;
  icon: ProjectIcon;
  instructions: string;
  memory: ProjectMemory;
  libraryAccess: LibraryAccess;
  pinned: boolean;
  shared: boolean;
  chats: ProjectChat[];
  sources: ProjectSource[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "clauxen_project_drafts";

let snapshot: ProjectDraft[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function createId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeIcon(value: unknown): ProjectIcon {
  if (value && typeof value === "object") {
    const icon = value as { id?: string; color?: string; kind?: string };
    if (icon.kind === "photo") return { id: "folder", color: "#14151a" };
    if (typeof icon.id === "string") {
      return { id: icon.id, color: icon.color || "#14151a" };
    }
  }
  return { id: "folder", color: "#14151a" };
}

function normalize(raw: Partial<ProjectDraft> & { id?: string; name?: string }): ProjectDraft | null {
  if (!raw.id || !raw.name) return null;
  const createdAt = raw.createdAt || new Date().toISOString();
  return {
    id: raw.id,
    name: raw.name,
    icon: normalizeIcon(raw.icon),
    instructions: raw.instructions || "",
    memory: raw.memory === "project" ? "project" : "default",
    libraryAccess: raw.libraryAccess === "disabled" ? "disabled" : "enabled",
    pinned: Boolean(raw.pinned),
    shared: Boolean(raw.shared),
    chats: Array.isArray(raw.chats) ? raw.chats : [],
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
  };
}

function readAll(): ProjectDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalize(row as Partial<ProjectDraft>))
      .filter((row): row is ProjectDraft => Boolean(row));
  } catch {
    return [];
  }
}

function persist(next: ProjectDraft[]) {
  snapshot = next;
  hydrated = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota or private mode */
  }
  listeners.forEach((listener) => listener());
}

function ensure(): ProjectDraft[] {
  if (!hydrated && typeof window !== "undefined") {
    snapshot = readAll();
    hydrated = true;
  }
  return snapshot;
}

export function subscribeProjects(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProjectSnapshot() {
  return ensure();
}

export function getServerProjectSnapshot(): ProjectDraft[] {
  return [];
}

export function listProjectDrafts() {
  return ensure();
}

export function getProjectDraft(id: string) {
  return ensure().find((project) => project.id === id) ?? null;
}

export function projectTabTitle(id: string) {
  return getProjectDraft(id)?.name?.trim() || null;
}

export function createProjectDraft(input: {
  name: string;
  icon: ProjectIcon;
  memory: ProjectMemory;
}): ProjectDraft {
  const now = new Date().toISOString();
  const project: ProjectDraft = {
    id: createId(),
    name: input.name.trim(),
    icon: input.icon,
    instructions: "",
    memory: input.memory,
    libraryAccess: "enabled",
    pinned: false,
    shared: false,
    chats: [],
    sources: [],
    createdAt: now,
    updatedAt: now,
  };
  persist([project, ...ensure().filter((row) => row.id !== project.id)]);
  return project;
}

export function updateProjectDraft(id: string, patch: Partial<ProjectDraft>) {
  const current = getProjectDraft(id);
  if (!current) return null;
  const next: ProjectDraft = {
    ...current,
    ...patch,
    id: current.id,
    chats: patch.chats ?? current.chats,
    sources: patch.sources ?? current.sources,
    updatedAt: new Date().toISOString(),
  };
  persist(ensure().map((row) => (row.id === id ? next : row)));
  return next;
}

export function deleteProjectDraft(id: string) {
  persist(ensure().filter((row) => row.id !== id));
}

export function addProjectChat(projectId: string, prompt: string) {
  const project = getProjectDraft(projectId);
  if (!project) return null;
  const now = new Date().toISOString();
  const title = prompt.trim().slice(0, 48) || "New chat";
  const chat: ProjectChat = {
    id: createId(),
    title,
    preview: prompt.trim(),
    pinned: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  return updateProjectDraft(projectId, {
    chats: [chat, ...project.chats],
  });
}

export function updateProjectChat(
  projectId: string,
  chatId: string,
  patch: Partial<ProjectChat>,
) {
  const project = getProjectDraft(projectId);
  if (!project) return null;
  return updateProjectDraft(projectId, {
    chats: project.chats.map((chat) =>
      chat.id === chatId ? { ...chat, ...patch, id: chat.id } : chat,
    ),
  });
}

export function removeProjectChat(projectId: string, chatId: string) {
  const project = getProjectDraft(projectId);
  if (!project) return null;
  return updateProjectDraft(projectId, {
    chats: project.chats.filter((chat) => chat.id !== chatId),
  });
}

export function addProjectSource(
  projectId: string,
  source: Omit<ProjectSource, "id" | "createdAt">,
) {
  const project = getProjectDraft(projectId);
  if (!project) return null;
  const next: ProjectSource = {
    ...source,
    id: createId(),
    createdAt: new Date().toISOString(),
  };
  return updateProjectDraft(projectId, {
    sources: [next, ...project.sources],
  });
}

export function removeProjectSource(projectId: string, sourceId: string) {
  const project = getProjectDraft(projectId);
  if (!project) return null;
  return updateProjectDraft(projectId, {
    sources: project.sources.filter((source) => source.id !== sourceId),
  });
}
