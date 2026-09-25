export type ProjectIcon =
  | { kind: "preset"; id: string }
  | { kind: "photo"; dataUrl: string };

export type ProjectFile = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export type ProjectDraft = {
  id: string;
  name: string;
  description: string;
  icon: ProjectIcon;
  instructions: string;
  files: ProjectFile[];
  createdAt: string;
};

const STORAGE_KEY = "clauxen_project_drafts";

function readAll(): ProjectDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(projects: ProjectDraft[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    /* quota or private mode */
  }
}

export function listProjectDrafts(): ProjectDraft[] {
  return readAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getProjectDraft(id: string): ProjectDraft | null {
  return readAll().find((project) => project.id === id) ?? null;
}

export function saveProjectDraft(project: ProjectDraft) {
  const next = readAll().filter((row) => row.id !== project.id);
  next.unshift(project);
  writeAll(next);
}

export function createProjectId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
